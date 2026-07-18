"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ObjectId } from "mongodb";
import bcrypt from "bcryptjs";
import { requireRole } from "@/lib/session";
import { getCollection } from "@/lib/mongodb";
import type { MemberDoc, ServiceDoc, UserDoc, AttendanceDoc, DeviceDoc, SyncQueueDoc } from "@/lib/models";
import { writeAudit } from "@/lib/audit";
import { createHash, randomBytes } from "crypto";
import { toId } from "@/lib/types";

export async function createMember(formData: FormData) {
  const session = await requireRole("admin", "officer");
  const first = String(formData.get("first_name") ?? "").trim();
  const last = String(formData.get("last_name") ?? "").trim();
  let code = String(formData.get("member_code") ?? "").trim();
  if (!first || !last) redirect("/members/new?error=required");
  if (!code) code = `APC-${randomBytes(3).toString("hex").toUpperCase()}`;

  const now = new Date();
  const members = await getCollection<MemberDoc>("members");
  try {
    const result = await members.insertOne({
      member_code: code,
      first_name: first,
      last_name: last,
      other_names: String(formData.get("other_names") ?? "").trim() || null,
      gender: (["male", "female", "other"].includes(String(formData.get("gender")))
        ? String(formData.get("gender"))
        : null) as MemberDoc["gender"],
      phone: String(formData.get("phone") ?? "").trim() || null,
      email: String(formData.get("email") ?? "").trim() || null,
      address: String(formData.get("address") ?? "").trim() || null,
      membership_status: "active",
      enrolled_face: false,
      enrolled_fingerprint: false,
      notes: String(formData.get("notes") ?? "").trim() || null,
      created_at: now,
      updated_at: now,
      synced_at: null,
    });
    await writeAudit({
      actor_user_id: session.user.id,
      action: "member.create",
      entity_type: "members",
      entity_id: result.insertedId.toHexString(),
    });
  } catch {
    redirect("/members/new?error=duplicate");
  }
  revalidatePath("/members");
  redirect("/members");
}

export async function updateMember(id: string, formData: FormData) {
  const session = await requireRole("admin", "officer");
  if (!ObjectId.isValid(id)) redirect("/members");
  const first = String(formData.get("first_name") ?? "").trim();
  const last = String(formData.get("last_name") ?? "").trim();
  const status = String(formData.get("membership_status") ?? "active");
  if (!first || !last) redirect(`/members/${id}?error=required`);

  const members = await getCollection<MemberDoc>("members");
  await members.updateOne(
    { _id: new ObjectId(id) },
    {
      $set: {
        first_name: first,
        last_name: last,
        other_names: String(formData.get("other_names") ?? "").trim() || null,
        gender: (["male", "female", "other"].includes(String(formData.get("gender")))
          ? String(formData.get("gender"))
          : null) as MemberDoc["gender"],
        phone: String(formData.get("phone") ?? "").trim() || null,
        email: String(formData.get("email") ?? "").trim() || null,
        address: String(formData.get("address") ?? "").trim() || null,
        membership_status: status as MemberDoc["membership_status"],
        notes: String(formData.get("notes") ?? "").trim() || null,
        synced_at: null,
        updated_at: new Date(),
      },
    },
  );
  await writeAudit({
    actor_user_id: session.user.id,
    action: "member.update",
    entity_type: "members",
    entity_id: id,
  });
  revalidatePath("/members");
  redirect("/members");
}

export async function createService(formData: FormData) {
  const session = await requireRole("admin", "officer");
  const title = String(formData.get("title") ?? "").trim();
  const starts = String(formData.get("starts_at") ?? "");
  const type = String(formData.get("service_type") ?? "sunday");
  if (!title || !starts) redirect("/services?error=required");

  const now = new Date();
  const ends = String(formData.get("ends_at") ?? "");
  const services = await getCollection<ServiceDoc>("services");
  const result = await services.insertOne({
    title,
    service_type: type as ServiceDoc["service_type"],
    location: String(formData.get("location") ?? "").trim() || null,
    starts_at: new Date(starts),
    ends_at: ends ? new Date(ends) : null,
    late_after_minutes: Math.max(0, Number(formData.get("late_after_minutes") ?? 15)),
    is_active: true,
    notes: null,
    created_at: now,
    updated_at: now,
  });
  await writeAudit({
    actor_user_id: session.user.id,
    action: "service.create",
    entity_type: "services",
    entity_id: result.insertedId.toHexString(),
  });
  revalidatePath("/services");
  redirect("/services");
}

export async function createUser(formData: FormData) {
  const session = await requireRole("admin");
  const name = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").toLowerCase().trim();
  const role = String(formData.get("role") ?? "officer");
  const password = String(formData.get("password") ?? "");
  if (!name || !email || password.length < 8) {
    redirect("/users?error=required");
  }
  const now = new Date();
  const users = await getCollection<UserDoc>("users");
  try {
    const result = await users.insertOne({
      email,
      password_hash: await bcrypt.hash(password, 10),
      full_name: name,
      role: role as UserDoc["role"],
      is_active: true,
      member_id: null,
      last_login_at: null,
      created_at: now,
      updated_at: now,
    });
    await writeAudit({
      actor_user_id: session.user.id,
      action: "user.create",
      entity_type: "users",
      entity_id: result.insertedId.toHexString(),
    });
  } catch {
    redirect("/users?error=duplicate");
  }
  revalidatePath("/users");
  redirect("/users");
}

export async function kioskClock(formData: FormData) {
  const session = await requireRole("admin", "officer");
  const action = String(formData.get("action") ?? "clock_in");
  const memberId = String(formData.get("member_id") ?? "");
  const serviceId = String(formData.get("service_id") ?? "");
  const forceOffline = formData.get("force_offline") === "1";
  let clientEventId = String(formData.get("client_event_id") ?? "");
  if (!clientEventId) clientEventId = randomBytes(16).toString("hex");

  if (!ObjectId.isValid(memberId) || !ObjectId.isValid(serviceId)) {
    redirect("/kiosk?error=select");
  }

  const devices = await getCollection<DeviceDoc>("devices");
  const device = await devices.findOne({ is_active: true }, { sort: { created_at: 1 } });
  const now = new Date();

  if (forceOffline) {
    if (!device) redirect("/kiosk?error=nodevice");
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
          verify_method: "manual",
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
      actor_user_id: session.user.id,
      action: "kiosk.offline_queue",
      meta: { memberId, serviceId },
    });
    revalidatePath("/kiosk");
    revalidatePath("/devices");
    redirect("/kiosk?queued=1");
  }

  const attendance = await getCollection<AttendanceDoc>("attendance");
  const services = await getCollection<ServiceDoc>("services");

  if (action === "clock_out") {
    await attendance.updateOne(
      { member_id: memberId, service_id: serviceId },
      { $set: { clock_out_at: now, updated_at: now } },
    );
    await writeAudit({
      actor_user_id: session.user.id,
      action: "kiosk.clock_out",
      meta: { memberId, serviceId },
    });
  } else {
    const service = await services.findOne({ _id: new ObjectId(serviceId) });
    let status: AttendanceDoc["status"] = "present";
    if (service) {
      const lateAt =
        new Date(service.starts_at).getTime() +
        (service.late_after_minutes ?? 15) * 60 * 1000;
      if (Date.now() > lateAt) status = "late";
    }
    const existing = await attendance.findOne({
      member_id: memberId,
      service_id: serviceId,
    });
    if (existing) {
      await attendance.updateOne(
        { _id: existing._id },
        {
          $set: {
            clock_in_at: existing.clock_in_at ?? now,
            status,
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
        verify_method: "manual",
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
      actor_user_id: session.user.id,
      action: "kiosk.clock_in",
      meta: { memberId, serviceId, status },
    });
  }

  revalidatePath("/kiosk");
  revalidatePath("/");
  revalidatePath("/attendance");
  redirect("/kiosk?ok=1");
}

export async function registerDevice(formData: FormData) {
  const session = await requireRole("admin");
  const code = String(formData.get("device_code") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const token = String(formData.get("device_token") ?? "").trim();
  if (!code || !name || !token) redirect("/devices?error=required");

  const now = new Date();
  const devices = await getCollection<DeviceDoc>("devices");
  try {
    const result = await devices.insertOne({
      device_code: code,
      name,
      location: String(formData.get("location") ?? "").trim() || null,
      device_token_hash: createHash("sha256").update(token).digest("hex"),
      mode: "online",
      last_seen_at: null,
      last_sync_at: null,
      roster_version: null,
      is_active: true,
      created_at: now,
      updated_at: now,
    });
    await writeAudit({
      actor_user_id: session.user.id,
      action: "device.register",
      entity_type: "devices",
      entity_id: result.insertedId.toHexString(),
    });
  } catch {
    redirect("/devices?error=duplicate");
  }
  revalidatePath("/devices");
  redirect("/devices");
}

export async function processSyncQueue() {
  await requireRole("admin");
  const queue = await getCollection<SyncQueueDoc>("sync_queue");
  const attendance = await getCollection<AttendanceDoc>("attendance");
  const pending = await queue
    .find({ status: "pending" })
    .sort({ device_timestamp: 1 })
    .limit(100)
    .toArray();

  let applied = 0;
  for (const row of pending) {
    const payload = row.payload ?? {};
    const memberId = String(payload.member_id ?? "");
    const serviceId = String(payload.service_id ?? "");
    if (!memberId || !serviceId) {
      await queue.updateOne(
        { _id: row._id },
        {
          $set: { status: "failed", last_error: "Invalid payload" },
          $inc: { attempts: 1 },
        },
      );
      continue;
    }
    try {
      const ts = row.device_timestamp ?? new Date();
      if (row.event_type === "clock_out") {
        await attendance.updateOne(
          { member_id: memberId, service_id: serviceId },
          {
            $set: {
              clock_out_at: ts,
              synced_from_offline: true,
              updated_at: new Date(),
            },
          },
        );
      } else {
        const existing = await attendance.findOne({
          member_id: memberId,
          service_id: serviceId,
        });
        if (existing) {
          await attendance.updateOne(
            { _id: existing._id },
            {
              $set: {
                clock_in_at: existing.clock_in_at ?? ts,
                synced_from_offline: true,
                updated_at: new Date(),
              },
            },
          );
        } else {
          const now = new Date();
          await attendance.insertOne({
            member_id: memberId,
            service_id: serviceId,
            clock_in_at: ts,
            clock_out_at: null,
            status: (payload.status as AttendanceDoc["status"]) ?? "present",
            verify_method: "offline_queue",
            source_mode: "offline",
            device_id: row.device_id,
            client_event_id: row.client_event_id,
            synced_from_offline: true,
            notes: null,
            created_at: now,
            updated_at: now,
          });
        }
      }
      await queue.updateOne(
        { _id: row._id },
        { $set: { status: "synced", synced_at: new Date() } },
      );
      applied++;
    } catch (e) {
      await queue.updateOne(
        { _id: row._id },
        {
          $set: {
            status: "failed",
            last_error: String(e).slice(0, 500),
          },
          $inc: { attempts: 1 },
        },
      );
    }
  }
  revalidatePath("/devices");
  revalidatePath("/attendance");
  revalidatePath("/");
  redirect(`/devices?processed=${applied}`);
}
