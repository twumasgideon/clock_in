import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getCollection } from "@/lib/mongodb";
import type { AttendanceDoc, ServiceDoc } from "@/lib/models";
import { serializeDocs } from "@/lib/types";
import { requireRoles } from "@/lib/rbac";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user || !requireRoles(session.user.role, ["admin", "officer", "pastor"])) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";
  const fromDt = new Date(`${from}T00:00:00`);
  const toDt = new Date(`${to}T23:59:59`);

  const services = serializeDocs(
    await (await getCollection<ServiceDoc>("services"))
      .find({ starts_at: { $gte: fromDt, $lte: toDt } })
      .sort({ starts_at: -1 })
      .toArray(),
  );
  const attendance = await getCollection<AttendanceDoc>("attendance");

  const lines = [
    "Service,Starts,Total,Present,Late,Offline,Synced from offline",
  ];
  for (const svc of services) {
    const rows = await attendance.find({ service_id: svc.id }).toArray();
    lines.push(
      [
        JSON.stringify(svc.title),
        svc.starts_at.toISOString(),
        rows.length,
        rows.filter((r) => r.status === "present").length,
        rows.filter((r) => r.status === "late").length,
        rows.filter((r) => r.source_mode === "offline").length,
        rows.filter((r) => r.synced_from_offline).length,
      ].join(","),
    );
  }

  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="attendance-report-${from}-to-${to}.csv"`,
    },
  });
}
