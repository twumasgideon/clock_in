import type { Role } from "./types";

const ROLE_ACCESS: Record<string, Role[]> = {
  dashboard: ["admin", "officer", "pastor", "member"],
  members: ["admin", "officer"],
  services: ["admin", "officer", "pastor"],
  attendance: ["admin", "officer", "pastor"],
  "follow-up": ["admin", "officer", "pastor"],
  kiosk: ["admin", "officer"],
  devices: ["admin"],
  reports: ["admin", "officer", "pastor"],
  users: ["admin"],
  admin: ["admin", "pastor"],
};

export function canAccess(role: string | undefined | null, area: keyof typeof ROLE_ACCESS): boolean {
  if (!role) return false;
  return ROLE_ACCESS[area]?.includes(role as Role) ?? false;
}

export function requireRoles(
  role: string | undefined | null,
  allowed: Role[],
): boolean {
  if (!role) return false;
  return allowed.includes(role as Role);
}
