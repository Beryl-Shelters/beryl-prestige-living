"use client";

import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Bell,
  Building2,
  ChevronDown,
  CircleDollarSign,
  Gift,
  HandCoins,
  Headphones,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  Settings,
  WalletCards,
  X,
} from "lucide-react";
import { PersonaSwitcher } from "@/components/persona/persona-switcher";
import { useAuth } from "@/context/auth-provider";

const primaryNavigation: Array<{ label: string; icon: typeof LayoutDashboard; href?: Route }> = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/seller" },
  { label: "My Listings", icon: ListChecks, href: "/seller/listings" },
  { label: "Payments", icon: WalletCards },
  { label: "Subaccounts", icon: Building2 },
  { label: "Save-as-you-earn", icon: HandCoins },
  { label: "Invest", icon: CircleDollarSign },
  { label: "Refer & earn", icon: Gift, href: "/refer" },
];

export function SellerShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { session, logout, logoutPending } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [personaOpen, setPersonaOpen] = useState(false);
  const name = session?.user.fullName || "Seller";
  const initials = name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();

  const signOut = async () => {
    await logout();
    router.replace("/login");
    router.refresh();
  };

  return (
    <div className="seller-app-shell">
      <button className="seller-mobile-menu" type="button" aria-label="Open Seller navigation" onClick={() => setMenuOpen(true)}><Menu size={21} /></button>
      {menuOpen ? <button className="seller-sidebar-backdrop" type="button" aria-label="Close Seller navigation" onClick={() => setMenuOpen(false)} /> : null}
      <aside className={`seller-sidebar${menuOpen ? " is-open" : ""}`} aria-label="Seller navigation">
        <div className="seller-sidebar-brand"><Image src="/brand/android-chrome-192x192.png" alt="" width={34} height={34} /><strong>Beryl Shelter</strong><button type="button" aria-label="Close Seller navigation" onClick={() => setMenuOpen(false)}><X size={19} /></button></div>
        <nav className="seller-sidebar-nav">
          {primaryNavigation.map(({ label, icon: Icon, href }) => href ? <Link key={label} href={href} className={label === "My Listings" ? "is-active" : ""} onClick={() => setMenuOpen(false)}><Icon size={19} aria-hidden="true" /><span>{label}</span></Link> : <button key={label} type="button" disabled title="Coming soon"><Icon size={19} aria-hidden="true" /><span>{label}</span></button>)}
        </nav>
        <nav className="seller-sidebar-secondary" aria-label="Seller support">
          <button type="button" disabled title="Coming soon"><Headphones size={19} aria-hidden="true" /><span>Support</span></button>
          <button type="button" disabled title="Coming soon"><Settings size={19} aria-hidden="true" /><span>Settings</span></button>
        </nav>
        <div className="seller-sidebar-profile">
          <span className="seller-avatar" aria-hidden="true">{initials}</span><span><strong>{name}</strong><small>{session?.user.email || "Seller account"}</small></span>
          <button type="button" disabled={logoutPending} onClick={() => void signOut()}><LogOut size={18} aria-hidden="true" /><span>{logoutPending ? "Logging out…" : "Log out"}</span></button>
        </div>
      </aside>
      <div className="seller-app-main">
        <header className="seller-topbar">
          <button type="button" aria-label="Notifications"><Bell size={19} /><span className="seller-notification-dot" /></button>
          <button type="button" className="seller-account-control" aria-label="Open profile switcher" onClick={() => setPersonaOpen(true)}><span className="seller-avatar" aria-hidden="true">{initials}</span><strong>{name}</strong><ChevronDown size={17} /></button>
        </header>
        <div className="seller-app-content">{children}</div>
      </div>
      <PersonaSwitcher open={personaOpen} onClose={() => setPersonaOpen(false)} />
    </div>
  );
}
