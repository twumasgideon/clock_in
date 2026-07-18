import { auth } from "./auth";
import { redirect } from "next/navigation";
import type { Role } from "./types";
import { requireRoles } from "./rbac";

export async function requireSession() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  return session;
}

export async function requireRole(...roles: Role[]) {
  const session = await requireSession();
  if (!requireRoles(session.user.role, roles)) {
    redirect("/");
  }
  return session;
}
