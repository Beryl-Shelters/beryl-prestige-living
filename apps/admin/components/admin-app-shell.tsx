"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { adminApi, type AdminProfile } from "../lib/api";

const AdminAccountContext = createContext<AdminProfile | null>(null);

function Icon({ kind }: { kind: "dashboard" | "users" | "properties" | "leads" | "referrers" | "menu" | "logout" }) {
  const paths = {
    dashboard: <><path d="m3 11 9-8 9 8"/><path d="M5 10v10h5v-6h4v6h5V10"/></>,
    users: <><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/></>,
    properties: <><path d="m3 8 9-4 9 4-9 4-9-4Z"/><path d="m5 10 7 4 7-4v7l-7 4-7-4v-7Z"/></>,
    leads: <><path d="M4 20h16M6 20v-9h12v9M4 11l8-7 8 7"/><path d="M9 14h6"/></>,
    referrers: <><circle cx="8" cy="8" r="3"/><circle cx="17" cy="7" r="2"/><path d="M3 20c0-4 2-6 5-6s5 2 5 6M14 14c4 0 6 2 6 5"/><path d="m13 9 2 2 4-4"/></>,
    menu: <path d="M4 7h16M4 12h16M4 17h16"/>,
    logout: <><path d="M10 4H5v16h5M14 8l4 4-4 4M18 12H9"/></>,
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24">{paths[kind]}</svg>;
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

export function useAdminAccount() {
  const account = useContext(AdminAccountContext);
  if (!account) throw new Error("Admin account is unavailable outside the Admin shell.");
  return account;
}

export function AdminAppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [admin, setAdmin] = useState<AdminProfile | null>(null);
  const [ready, setReady] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [shellError, setShellError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    adminApi<{ admin: AdminProfile }>("/auth/me", { signal: controller.signal })
      .then((data) => setAdmin(data.admin))
      .catch(() => {
        if (!controller.signal.aborted) router.replace("/login");
      })
      .finally(() => {
        if (!controller.signal.aborted) setReady(true);
      });
    return () => controller.abort();
  }, [router]);

  useEffect(() => {
    if (!menuOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [menuOpen]);

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  async function logout() {
    if (loggingOut) return;
    setLoggingOut(true);
    setShellError("");
    try {
      await adminApi("/auth/logout", { method: "POST", body: JSON.stringify({}) });
      router.replace("/login");
      router.refresh();
    } catch (error) {
      setShellError(error instanceof Error ? error.message : "Sign out failed.");
      setLoggingOut(false);
    }
  }

  if (!ready) {
    return <main className="admin-shell-loading" aria-live="polite">Loading Admin portal…</main>;
  }
  if (!admin) return null;

  const usersActive = pathname.startsWith("/dashboard/users");
  const propertiesActive = pathname.startsWith("/dashboard/properties");
  const leadsActive = pathname.startsWith("/dashboard/leads");
  const referrersActive = pathname.startsWith("/dashboard/referrers");
  return (
    <AdminAccountContext.Provider value={admin}>
      <div className="admin-app-shell">
        <button
          aria-label="Dismiss navigation"
          className={`admin-nav-backdrop${menuOpen ? " is-open" : ""}`}
          onClick={closeMenu}
          type="button"
        />
        <aside className={`admin-sidebar${menuOpen ? " is-open" : ""}`}>
          <button aria-label="Close navigation" className="admin-sidebar-close" onClick={closeMenu} type="button">×</button>
          <Link className="admin-brand" href="/" onClick={closeMenu}>
            <span className="admin-brand-mark" aria-hidden="true">⌂</span>
            <span>Beryl Shelters</span>
          </Link>
          <nav aria-label="Admin navigation" className="admin-primary-nav">
            <Link className={pathname === "/" ? "is-active" : ""} href="/" onClick={closeMenu}>
              <Icon kind="dashboard"/><span>Dashboard</span>
            </Link>
            <Link className={usersActive ? "is-active" : ""} href="/dashboard/users" onClick={closeMenu}>
              <Icon kind="users"/><span>Users</span>
            </Link>
            <Link className={propertiesActive ? "is-active" : ""} href="/dashboard/properties" onClick={closeMenu}>
              <Icon kind="properties"/><span>Properties</span>
            </Link>
            <Link className={leadsActive ? "is-active" : ""} href="/dashboard/leads" onClick={closeMenu}>
              <Icon kind="leads"/><span>Leads</span>
            </Link>
            <Link className={referrersActive ? "is-active" : ""} href="/dashboard/referrers" onClick={closeMenu}>
              <Icon kind="referrers"/><span>Referrers</span>
            </Link>
          </nav>
          <div className="admin-sidebar-account">
            <span className="admin-avatar">{initials(admin.fullName)}</span>
            <span><strong>{admin.fullName}</strong><small>{admin.email}</small></span>
            <button aria-label="Sign out" disabled={loggingOut} onClick={() => void logout()} type="button">
              <Icon kind="logout"/>
            </button>
          </div>
        </aside>

        <div className="admin-shell-main">
          <header className="admin-topbar">
            <button aria-expanded={menuOpen} aria-label="Open navigation" className="admin-menu-button" onClick={() => setMenuOpen(true)} type="button">
              <Icon kind="menu"/>
            </button>
            <span className="admin-topbar-title">Admin Portal</span>
            <div className="admin-profile-menu">
              <button aria-expanded={profileOpen} onClick={() => setProfileOpen((open) => !open)} type="button">
                <span className="admin-avatar">{initials(admin.fullName)}</span>
                <span>{admin.fullName}</span>
                <span aria-hidden="true">⌄</span>
              </button>
              {profileOpen && (
                <div className="admin-profile-popover">
                  <strong>{admin.fullName}</strong>
                  <span>{admin.role === "SUPER_ADMIN" ? "Super Admin" : "Admin"}</span>
                  <button disabled={loggingOut} onClick={() => void logout()} type="button">
                    {loggingOut ? "Signing out…" : "Sign out"}
                  </button>
                </div>
              )}
            </div>
          </header>
          {shellError && <p className="admin-shell-error" role="alert">{shellError}</p>}
          <div className="admin-shell-content">{children}</div>
        </div>
      </div>
    </AdminAccountContext.Provider>
  );
}
