import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireRoles } from "@/lib/rbac";
import { performKioskClock } from "@/lib/kiosk-clock";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || !requireRoles(session.user.role, ["admin", "officer"])) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const action = body.action === "clock_out" ? "clock_out" : "clock_in";
  const verifyRaw = String(body.verify_method ?? "face");
  const verifyMethod =
    verifyRaw === "face" || verifyRaw === "thumbprint" || verifyRaw === "manual"
      ? verifyRaw
      : "face";

  const result = await performKioskClock({
    action,
    memberId: String(body.member_id ?? ""),
    serviceId: String(body.service_id ?? ""),
    verifyMethod,
    forceOffline: Boolean(body.force_offline),
    clientEventId: body.client_event_id
      ? String(body.client_event_id)
      : undefined,
    userId: session.user.id,
  });

  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
