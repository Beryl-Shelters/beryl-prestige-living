"use client";
import { LogOut, LayoutDashboard, UsersRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { AdminSessionState } from "@/lib/contracts";
import { BrandLogo } from "./brand-logo";
export function AdminShell({ session, children }: { session: AdminSessionState; children: React.ReactNode }) {
  const router = useRouter();
  const logout = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  };
  const { admin } = session;
  return (
    <main className="dashboard">
      <aside className="sidebar">
        <BrandLogo href="/dashboard" dark />
        <nav className="sidebar-nav" aria-label="Admin navigation">
          <Link href="/dashboard">
            <LayoutDashboard size={17} />
            Dashboard
          </Link>
          {admin.adminRole === "SUPER_ADMIN" ? <Link href={"/dashboard/admins" as never}><UsersRound size={17} />Admins</Link> : null}
          {['Customers', 'Properties', 'Listings', 'Reports', 'Transactions', 'Analytics'].map((item) => <span key={item}>{item}</span>)}
          <Link href={"/dashboard/change-password" as never}>Settings</Link>
        </nav>
      </aside>
      <div className="dashboard-main">
        <header className="topbar">
          <span style={{ fontWeight: 800 }}>Admin Portal</span>
          <div className="admin-meta">
            <strong>{admin.fullName}</strong>
            <span>{admin.department || "Beryl Shelter"}</span>
            <span className="role-badge">
              {admin.adminRole.replaceAll("_", " ")}
            </span>
          </div>
        </header>
        <section className="dashboard-content">{children}<button className="button button-secondary logout-button" type="button" onClick={logout}><LogOut size={16} /> Log out</button></section>
      </div>
    </main>
  );
}

export function AdminDashboard({ session }: { session: AdminSessionState }) {
  return <AdminShell session={session}><div className="welcome-card"><p className="eyebrow">Welcome</p><h1>Welcome to the Beryl Shelter Admin Portal.</h1><p>Dashboard modules will appear here as they are connected.</p></div></AdminShell>;
}
