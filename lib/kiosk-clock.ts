import { ObjectId } from "mongodb";
import { randomBytes } from "crypto";
import { getCollection } from "@/lib/mongodb";
import type {
  AttendanceDoc,
  DeviceDoc,
  ServiceDoc,
  SyncQueueDoc,
} from "@/lib/models";
import { writeAudit } from "@/lib/audit";
import { toId } from "@/lib/types";

export type KioskClockInput = {
  action: "clock_in" | "clock_out";
  memberId: string;
  serviceId: string;
  verifyMethod: "face" | "thumbprint" | "manual";
  forceOffline?: boolean;
  clientEventId?: string;
  userId: string;
};

export type KioskClockResult =
  | { ok: true; queued?: boolean; status?: string; memberId: string }
  | { ok: false; error: string };

export async function performKioskClock(
  input: KioskClockInput,
): Promise<KioskClockResult> {
  const {
    action,
    memberId,
    serviceId,
    verifyMethod,
    forceOffline = false,
    userId,
  } = input;
  let clientEventId = input.clientEventId || "";
  if (!clientEventId) clientEventId = randomBytes(16).toString("hex");

  if (!ObjectId.isValid(memberId) || !ObjectId.isValid(serviceId)) {
    return { ok: false, error: "Invalid member or service" };
  }

  const devices = await getCollection<DeviceDoc>("devices");
  const device = await devices.findOne(
    { is_active: true },
    { sort: { created_at: 1 } },
  );
  const now = new Date();

  if (forceOffline) {
    if (!device) return { ok: false, error: "No device configured" };
    if (action === "clock_in") {
      const attendance = await getCollection<AttendanceDoc>("attendance");
      const already = await attendance.findOne({
        member_id: memberId,
        service_id: serviceId,
        clock_in_at: { $ne: null },
      });
      if (already) {
        return { ok: false, error: "Already clocked in for this service" };
      }
    }
    const queue = await getCollection<SyncQueueDoc>("sync_queue");
    const existing = await queue.findOne({
      device_id: toId(device._id),
      client_event_id: clientEventId,
    });
    if (!existing) {
      await queue.insertOne({
        device_id: toId(device._id),
        client_event_id: clientEventId,
        event_type: action === "clock_out" ? "clock_out" : "clock_in",
        payload: {
          member_id: memberId,
          service_id: serviceId,
          verify_method: verifyMethod,
          status: "present",
          action,
        },
        status: "pending",
        attempts: 0,
        last_error: null,
        device_timestamp: now,
        received_at: now,
        synced_at: null,
      });
    }
    await writeAudit({
      actor_user_id: userId,
      action: "kiosk.offline_queue",
      meta: { memberId, serviceId, verifyMethod },
    });
    return { ok: true, queued: true, memberId };
  }

  const attendance = await getCollection<AttendanceDoc>("attendance");
  const services = await getCollection<ServiceDoc>("services");

  if (action === "clock_out") {
    const existingOut = await attendance.findOne({
      member_id: memberId,
      service_id: serviceId,
    });
    if (!existingOut?.clock_in_at) {
      return { ok: false, error: "Not clocked in yet for this service" };
    }
    if (existingOut.clock_out_at) {
      return { ok: false, error: "Already clocked out for this service" };
    }
    await attendance.updateOne(
      { _id: existingOut._id },
      { $set: { clock_out_at: now, updated_at: now } },
    );
    await writeAudit({
      actor_user_id: userId,
      action: "kiosk.clock_out",
      meta: { memberId, serviceId, verifyMethod },
    });
    return { ok: true, memberId };
  }

  const existing = await attendance.findOne({
    member_id: memberId,
    service_id: serviceId,
  });
  if (existing?.clock_in_at) {
    return { ok: false, error: "Already clocked in for this service" };
  }

  const service = await services.findOne({ _id: new ObjectId(serviceId) });
  let status: AttendanceDoc["status"] = "present";
  if (service) {
    const lateAt =
      new Date(service.starts_at).getTime() +
      (service.late_after_minutes ?? 15) * 60 * 1000;
    if (Date.now() > lateAt) status = "late";
  }

  if (existing) {
    await attendance.updateOne(
      { _id: existing._id },
      {
        $set: {
          clock_in_at: now,
          status,
          verify_method: verifyMethod,
          updated_at: now,
        },
      },
    );
  } else {
    await attendance.insertOne({
      member_id: memberId,
      service_id: serviceId,
      clock_in_at: now,
      clock_out_at: null,
      status,
      verify_method: verifyMethod,
      source_mode: "online",
      device_id: device ? toId(device._id) : null,
      client_event_id: clientEventId,
      synced_from_offline: false,
      notes: null,
      created_at: now,
      updated_at: now,
    });
  }

  await writeAudit({
    actor_user_id: userId,
    action: "kiosk.clock_in",
    meta: { memberId, serviceId, status, verifyMethod },
  });

  return { ok: true, status, memberId };
}
