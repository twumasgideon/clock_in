import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

export const runtime = "nodejs";

export async function GET() {
  const hasSecret = Boolean(
    process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  );
  const hasMongo = Boolean(process.env.MONGODB_URI);
  const dbName = process.env.MONGODB_DATABASE || "apc_attendance";

  let mongo: "ok" | "error" = "error";
  let mongoError: string | null = null;
  let userCount: number | null = null;

  try {
    const db = await getDb();
    userCount = await db.collection("users").countDocuments();
    mongo = "ok";
  } catch (err) {
    mongoError = err instanceof Error ? err.message : String(err);
  }

  const ok = hasSecret && hasMongo && mongo === "ok";
  return NextResponse.json(
    {
      ok,
      authSecret: hasSecret ? "set" : "missing",
      mongodbUri: hasMongo ? "set" : "missing",
      database: dbName,
      mongo,
      userCount,
      mongoError,
    },
    { status: ok ? 200 : 503 },
  );
}
