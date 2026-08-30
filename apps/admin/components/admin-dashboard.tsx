"use client";
import { Bell, Building2, Gift, LayoutDashboard, LogOut, Settings, ShieldCheck, UsersRound, Waypoints } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { AdminSessionState } from "@/lib/contracts";
import { identifyAdminAnalytics, resetAdminAnalytics, trackAdminEvent } from "@/lib/analytics/admin";
import { BrandLogo } from "./brand-logo";
export function AdminShell({ session, children }: { session: AdminSessionState; children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [logoutPending, setLogoutPending] = useState(false);
  const logoutInFlight = useRef(false);
  useEffect(() => { void identifyAdminAnalytics(session.admin); }, [session.admin]);
  const logout = async () => {
    if (logoutInFlight.current) return;
    logoutInFlight.current = true;
    setLogoutPending(true);
    void trackAdminEvent("Logout", {});
    try { await resetAdminAnalytics(); } catch { /* Admin cookie cleanup still proceeds. */ }
    try {
      await fetch("/api/admin/logout", { method: "POST" });
    } finally {
      router.replace("/login");
      router.refresh();
    }
  };
  const { admin } = session;
  const initials = admin.fullName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  return (
    <main className="dashboard">
      <aside className="sidebar">
        <BrandLogo href="/dashboard" dark />
        <nav className="sidebar-nav" aria-label="Admin navigation">
          <Link href="/dashboard" data-active={pathname === "/dashboard"}>
            <LayoutDashboard size={17} />
            Dashboard
          </Link>
          <Link href={"/dashboard/users" as never} data-active={pathname.startsWith("/dashboard/users")}><UsersRound size={17} />Users</Link>
          <Link href={"/dashboard/properties" as never} data-active={pathname.startsWith("/dashboard/properties")}><Building2 size={17} />Properties</Link>
          <Link href={"/dashboard/leads" as never} data-active={pathname.startsWith("/dashboard/leads")}><Waypoints size={17} />Leads</Link>
          <Link href={"/dashboard/referrers" as never} data-active={pathname.startsWith("/dashboard/referrers")}><Gift size={17} />Referrers</Link>
          {admin.adminRole === "SUPER_ADMIN" ? <Link href={"/dashboard/admins" as never} data-active={pathname.startsWith("/dashboard/admins")}><ShieldCheck size={17} />Admin Management</Link> : null}
        </nav>
        <div className="sidebar-footer"><Link href="/dashboard/change-password" data-active={pathname === "/dashboard/change-password"}><Settings size={17} />Settings</Link><div className="sidebar-profile"><span className="sidebar-avatar" aria-hidden>{initials}</span><div><strong>{admin.fullName}</strong><span>{admin.department || "Beryl Shelter"}</span><small>{admin.adminRole.replaceAll("_", " ")}</small></div></div><button type="button" disabled={logoutPending} onClick={() => void logout()}><LogOut size={16} />{logoutPending ? "Logging out…" : "Log out"}</button></div>
      </aside>
      <div className="dashboard-main">
        <header className="topbar">
          <span style={{ fontWeight: 800 }}>Admin Portal</span>
          <div className="admin-meta">
            <Bell size={18} aria-label="Notifications" />
            <span className="role-badge">
              {admin.adminRole.replaceAll("_", " ")}
            </span>
          </div>
        </header>
        <section className="dashboard-content">{children}</section>
      </div>
    </main>
  );
}

export function AdminDashboard({ session }: { session: AdminSessionState }) {
  return <AdminShell session={session}><div className="welcome-card"><p className="eyebrow">Welcome</p><h1>Welcome to the Beryl Shelter Admin Portal.</h1><p>Dashboard modules will appear here as they are connected.</p></div></AdminShell>;
}
