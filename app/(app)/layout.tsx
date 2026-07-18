import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { ConnectivityBadge } from "@/components/ConnectivityBadge";
import { SignOutButton } from "@/components/SignOutButton";
import { roleLabel } from "@/lib/types";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="app-shell">
      <Sidebar role={session.user.role} />      <div className="app-main">
        <header className="app-topbar">
          <div>
            <p className="eyebrow">Asokwa Pentecost Church</p>
            <h1 className="topbar-title">Attendance</h1>
          </div>
          <div className="topbar-actions">
            <ConnectivityBadge />
            <div className="user-chip">
              <span className="user-name">{session.user.name}</span>
              <span className="user-role">{roleLabel(session.user.role)}</span>
            </div>
            <SignOutButton />
          </div>
        </header>
        <main className="app-content">{children}</main>
      </div>
    </div>
  );
}
