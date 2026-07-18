import { NextResponse } from "next/server";
import { getCollection } from "@/lib/mongodb";
import type { DeviceDoc, SyncQueueDoc } from "@/lib/models";
import { serializeDocs } from "@/lib/types";

export async function GET() {
  const pending = await (
    await getCollection<SyncQueueDoc>("sync_queue")
  ).countDocuments({ status: { $in: ["pending", "processing", "failed"] } });

  const devices = serializeDocs(
    await (await getCollection<DeviceDoc>("devices"))
      .find({ is_active: true })
      .toArray(),
  );

  const failures = serializeDocs(
    await (await getCollection<SyncQueueDoc>("sync_queue"))
      .find({ status: "failed" })
      .sort({ received_at: -1 })
      .limit(5)
      .toArray(),
  );

  return NextResponse.json({
    ok: true,
    pending,
    devices: {
      total: devices.length,
      online_count: devices.filter((d) => d.mode === "online").length,
      offline_count: devices.filter((d) => d.mode === "offline").length,
      syncing_count: devices.filter((d) => d.mode === "syncing").length,
    },
    failures,
    server_time: new Date().toISOString(),
  });
}
