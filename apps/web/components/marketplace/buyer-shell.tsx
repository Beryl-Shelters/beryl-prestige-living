"use client";

import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Gift, Heart, House, LogOut, Menu, X } from "lucide-react";
import { useAuth } from "@/context/auth-provider";

const buyerNavigation: Array<{
  label: string;
  href: Route;
  icon: typeof House;
  active: (pathname: string) => boolean;
}> = [
  {
    label: "Marketplace",
    href: "/marketplace",
    icon: House,
    active: (pathname) =>
      pathname === "/marketplace" || pathname.startsWith("/marketplace/"),
  },
  {
    label: "Saved Properties",
    href: "/saved",
    icon: Heart,
    active: (pathname) => pathname === "/saved",
  },
  {
    label: "Refer & Earn",
    href: "/refer",
    icon: Gift,
    active: (pathname) =>
      pathname === "/refer" || pathname === "/referrals",
  },
];

const buyerShellRoute = (pathname: string) =>
  pathname === "/marketplace" ||
  pathname.startsWith("/marketplace/") ||
  pathname === "/saved" ||
  pathname === "/refer" ||
  pathname === "/referrals";

export function BuyerShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { session, logout, logoutPending } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const sidebar = useRef<HTMLElement>(null);
  const showBuyerShell =
    buyerShellRoute(pathname) &&
    session?.activePersona === "BUYER" &&
    session.nextAction === "OPEN_BUYER_DASHBOARD";

  useEffect(() => {
    if (!menuOpen || !showBuyerShell) return;
    const root = sidebar.current;
    const previous = document.activeElement as HTMLElement | null;
    root?.querySelector<HTMLElement>("a, button:not([disabled])")?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
      if (event.key !== "Tab" || !root) return;
      const items = Array.from(
        root.querySelectorAll<HTMLElement>("a, button:not([disabled])"),
      );
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      document.removeEventListener("keydown", keydown);
      previous?.focus();
    };
  }, [menuOpen, showBuyerShell]);

  if (!showBuyerShell) return children;

  const name = session.user.fullName;
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  const signOut = async () => {
    if (logoutPending) return;
    await logout();
    router.replace("/login");
    router.refresh();
  };

  return (
    <div className="buyer-app-shell">
      <button
        className="buyer-mobile-menu"
        type="button"
        aria-label="Open Buyer navigation"
        aria-expanded={menuOpen}
        aria-controls="buyer-navigation"
        onClick={() => setMenuOpen(true)}
      >
        <Menu size={21} aria-hidden="true" />
      </button>
      {menuOpen ? (
        <button
          className="buyer-sidebar-backdrop"
          type="button"
          aria-label="Close Buyer navigation"
          onClick={() => setMenuOpen(false)}
        />
      ) : null}
      <aside
        ref={sidebar}
        id="buyer-navigation"
        className={`buyer-sidebar${menuOpen ? " is-open" : ""}`}
        aria-label="Buyer navigation"
      >
        <div className="buyer-sidebar-brand">
          <Image
            src="/brand/android-chrome-192x192.png"
            alt=""
            width={34}
            height={34}
          />
          <strong>Beryl Shelter</strong>
          <button
            type="button"
            aria-label="Close Buyer navigation"
            onClick={() => setMenuOpen(false)}
          >
            <X size={19} aria-hidden="true" />
          </button>
        </div>
        <nav className="buyer-sidebar-nav" aria-label="Buyer destinations">
          {buyerNavigation.map(({ label, href, icon: Icon, active }) => {
            const current = active(pathname);
            return (
              <Link
                key={label}
                href={href}
                className={current ? "is-active" : undefined}
                aria-current={current ? "page" : undefined}
                onClick={() => setMenuOpen(false)}
              >
                <Icon size={19} aria-hidden="true" />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="buyer-sidebar-profile">
          <span className="buyer-avatar" aria-hidden="true">{initials}</span>
          <span>
            <strong>{name}</strong>
            <small>{session.user.email}</small>
          </span>
          <button
            type="button"
            disabled={logoutPending}
            onClick={() => void signOut()}
          >
            <LogOut size={18} aria-hidden="true" />
            <span>{logoutPending ? "Logging out…" : "Log out"}</span>
          </button>
        </div>
      </aside>
      <div className="buyer-app-main">{children}</div>
    </div>
  );
}
