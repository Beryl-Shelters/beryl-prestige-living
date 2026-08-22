"use client";
import { Bell, Building2, LayoutDashboard, LogOut, Settings, UsersRound, Waypoints } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import type { AdminSessionState } from "@/lib/contracts";
import { identifyAdminAnalytics, resetAdminAnalytics, trackAdminEvent } from "@/lib/analytics/admin";
import { BrandLogo } from "./brand-logo";
export function AdminShell({ session, children }: { session: AdminSessionState; children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => { void identifyAdminAnalytics(session.admin); }, [session.admin]);
  const logout = async () => {
    void trackAdminEvent("Logout", {});
    await resetAdminAnalytics();
    await fetch("/api/admin/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
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
          <span aria-disabled="true"><UsersRound size={17} />Users</span>
          <span aria-disabled="true"><Building2 size={17} />Properties</span>
          <Link href={"/dashboard/leads" as never} data-active={pathname.startsWith("/dashboard/leads")}><Waypoints size={17} />Leads</Link>
        </nav>
        <div className="sidebar-footer"><Link href="/dashboard/change-password" data-active={pathname === "/dashboard/change-password"}><Settings size={17} />Settings</Link><div className="sidebar-profile"><span className="sidebar-avatar" aria-hidden>{initials}</span><div><strong>{admin.fullName}</strong><span>{admin.department || "Beryl Shelter"}</span><small>{admin.adminRole.replaceAll("_", " ")}</small></div></div><button type="button" onClick={logout}><LogOut size={16} />Log out</button></div>
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
