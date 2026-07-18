import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { getCollection } from "@/lib/mongodb";
import type { DeviceDoc, SyncQueueDoc } from "@/lib/models";
import { toId } from "@/lib/types";

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    const deviceCode = String(payload.device_code ?? "");
    const token = String(payload.device_token ?? "");
    const events = Array.isArray(payload.events) ? payload.events : null;

    if (!deviceCode || !token || !events) {
      return NextResponse.json(
        { ok: false, error: "Invalid push payload" },
        { status: 400 },
      );
    }

    const devices = await getCollection<DeviceDoc>("devices");
    const device = await devices.findOne({ device_code: deviceCode });
    if (!device || !device.is_active) {
      return NextResponse.json(
        { ok: false, error: "Unknown or inactive device" },
        { status: 400 },
      );
    }

    const tokenHash = createHash("sha256").update(token).digest("hex");
    if (
      tokenHash !== device.device_token_hash &&
      token !== device.device_token_hash
    ) {
      return NextResponse.json(
        { ok: false, error: "Invalid device token" },
        { status: 400 },
      );
    }

    const queue = await getCollection<SyncQueueDoc>("sync_queue");
    let inserted = 0;
    let duplicates = 0;
    const deviceId = toId(device._id);

    for (const event of events) {
      const clientId = String(event.client_event_id ?? "");
      const type = String(event.event_type ?? "");
      if (!clientId || !type) continue;

      const existing = await queue.findOne({
        device_id: deviceId,
        client_event_id: clientId,
      });
      if (existing) {
        await queue.updateOne({ _id: existing._id }, { $inc: { attempts: 1 } });
        duplicates++;
        continue;
      }

      await queue.insertOne({
        device_id: deviceId,
        client_event_id: clientId,
        event_type: type as SyncQueueDoc["event_type"],
        payload: event.payload ?? {},
        status: "pending",
        attempts: 0,
        last_error: null,
        device_timestamp: event.device_timestamp
          ? new Date(event.device_timestamp)
          : new Date(),
        received_at: new Date(),
        synced_at: null,
      });
      inserted++;
    }

    await devices.updateOne(
      { _id: device._id },
      {
        $set: {
          mode: "syncing",
          last_seen_at: new Date(),
          last_sync_at: new Date(),
          updated_at: new Date(),
        },
      },
    );

    return NextResponse.json({
      ok: true,
      accepted: inserted,
      duplicates,
      conflict_policy: "server_wins_profile_merge_attendance",
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: String(e) },
      { status: 500 },
    );
  }
}
