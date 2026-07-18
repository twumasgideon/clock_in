import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { getCollection } from "@/lib/mongodb";
import type { DeviceDoc, MemberDoc, ServiceDoc } from "@/lib/models";
import { serializeDocs } from "@/lib/types";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const deviceCode =
    searchParams.get("device_code") ?? req.headers.get("x-device-code") ?? "";
  const token =
    searchParams.get("device_token") ?? req.headers.get("x-device-token") ?? "";
  const since = searchParams.get("since");

  if (deviceCode && token) {
    const devices = await getCollection<DeviceDoc>("devices");
    const device = await devices.findOne({ device_code: deviceCode });
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const valid =
      device &&
      device.is_active &&
      (device.device_token_hash === tokenHash ||
        device.device_token_hash === token);
    if (!valid) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized device" },
        { status: 401 },
      );
    }
    await devices.updateOne(
      { _id: device!._id },
      {
        $set: {
          last_seen_at: new Date(),
          mode: "online",
          updated_at: new Date(),
        },
      },
    );
  }

  const memberFilter: Record<string, unknown> = {
    membership_status: "active",
  };
  if (since) memberFilter.updated_at = { $gt: new Date(since) };

  const members = serializeDocs(
    await (await getCollection<MemberDoc>("members"))
      .find(memberFilter)
      .project({
        member_code: 1,
        first_name: 1,
        last_name: 1,
        membership_status: 1,
        enrolled_face: 1,
        enrolled_fingerprint: 1,
        face_template_ref: 1,
        fingerprint_template_ref: 1,
        updated_at: 1,
      })
      .sort({ updated_at: 1 })
      .limit(1000)
      .toArray(),
  );

  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const services = serializeDocs(
    await (await getCollection<ServiceDoc>("services"))
      .find({ is_active: true, starts_at: { $gte: dayAgo } })
      .sort({ starts_at: 1 })
      .limit(50)
      .toArray(),
  );

  const version = createHash("sha256")
    .update(
      JSON.stringify({
        members: members.length,
        services: services.length,
        ts: new Date().toISOString(),
      }),
    )
    .digest("hex");

  return NextResponse.json({
    ok: true,
    roster_version: version,
    server_time: new Date().toISOString(),
    members,
    services,
    conflict_policy: "server_wins_profile_merge_attendance",
  });
}
