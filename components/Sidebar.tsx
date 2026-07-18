"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandBanner } from "@/components/BrandBanner";
import { canAccess } from "@/lib/rbac";
import type { Role } from "@/lib/types";

const NAV: {
  href: string;
  label: string;
  area: Parameters<typeof canAccess>[1];
}[] = [
  { href: "/", label: "Dashboard", area: "dashboard" },
  { href: "/members", label: "Members", area: "members" },
  { href: "/services", label: "Services", area: "services" },
  { href: "/attendance", label: "Attendance", area: "attendance" },
  { href: "/kiosk", label: "Kiosk", area: "kiosk" },
  { href: "/devices", label: "Devices & Sync", area: "devices" },
  { href: "/reports", label: "Reports", area: "reports" },
  { href: "/users", label: "Users", area: "users" },
];

export function Sidebar({ role }: { role: Role }) {
  const pathname = usePathname();

  return (
    <aside className="app-sidebar">
      <BrandBanner variant="compact" />
      <nav className="side-nav">
        {NAV.filter((item) => canAccess(role, item.area)).map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`side-link ${active ? "is-active" : ""}`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="sidebar-foot">
        <p style={{ fontWeight: 600, marginBottom: 4 }}>Modes</p>
        <p style={{ margin: 0 }}>Online: live MongoDB write</p>
        <p style={{ margin: 0 }}>Offline: SyncQueue → push</p>
      </div>
    </aside>
  );
}
