"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { accountTypeLabel, customerInitials, customerName } from "../../lib/dashboard-format";
import { BrandLogo } from "../auth/brand-logo";
import { DashboardIcon } from "./dashboard-icon";
import { useDashboard } from "./dashboard-provider";
import { dashboardNavigation } from "./navigation";

function Sidebar({ close }: { close?: () => void }) {
  const pathname = usePathname();
  const { overview, logout, loggingOut } = useDashboard();
  return <aside className="dashboard-sidebar" aria-label="Customer dashboard sidebar">
    <div className="dashboard-brand"><Link href="/dashboard" aria-label="Beryl Shelter dashboard" onClick={() => close?.()}><BrandLogo /></Link>
      {close && <button className="dashboard-close" aria-label="Close navigation" onClick={close}><DashboardIcon name="close" /></button>}
    </div>
    <nav className="dashboard-navigation" aria-label="Dashboard navigation">
      {dashboardNavigation.map((item) => <Link key={item.href} href={item.href} onClick={() => close?.()} aria-current={pathname === item.href ? "page" : undefined}>
        <DashboardIcon name={item.icon} /><span>{item.label}</span>
      </Link>)}
      <button type="button" disabled={loggingOut} onClick={logout}><DashboardIcon name="logout" /><span>Log Out</span></button>
      <Link href="/" onClick={() => close?.()}><DashboardIcon name="home" /><span>Back Home</span></Link>
    </nav>
    <div className="dashboard-identity">
      <span className="dashboard-avatar" aria-hidden="true">{customerInitials(overview.customer)}</span>
      <div><strong>{customerName(overview.customer) || "—"}</strong><span>{accountTypeLabel(overview.customer.account_type) || "—"}</span></div>
    </div>
  </aside>;
}

export function DashboardShell({ children }: { children: ReactNode }) {
  const [mobile, setMobile] = useState(false);
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 800px)");
    const update = () => { setMobile(media.matches); if (!media.matches) setOpen(false); };
    update(); media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (mobile && open) dialog.current?.showModal();
    else dialog.current?.close();
    if (!mobile || !open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [mobile, open]);
  return <div className="dashboard-shell">
    {mobile ? <dialog className="dashboard-drawer" aria-label="Dashboard navigation" ref={dialog} onCancel={() => setOpen(false)} onClick={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <Sidebar close={() => setOpen(false)} />
    </dialog> : <Sidebar />}
    <main className="dashboard-main">
      <button className="dashboard-menu" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}><DashboardIcon name="menu" />Menu</button>
      {children}
    </main>
  </div>;
}
