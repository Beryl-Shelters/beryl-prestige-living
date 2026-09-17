"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { authRequest, type Customer } from "../../lib/auth-api";
import { BrandLogo } from "./brand-logo";

const navigation = [
  ["Home", "/"],
  ["About", "/about"],
  ["Referrals", "/referrals"],
  ["Buy", "/buy"],
  ["Sell / List a Property", "/login?next=/dashboard/listings/new"],
  ["Analytics & Insights", "/analytics"],
  ["Careers", "/careers"],
  ["Support", "/support"],
] as const;

export function PublicHeader({ sessionAware = false, mobileMenu = false, accountMenu = false, onSessionChange }: { sessionAware?: boolean; mobileMenu?: boolean; accountMenu?: boolean; onSessionChange?: (customer: Customer | null) => void }) {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    if (!sessionAware) return;
    const controller = new AbortController();
    void authRequest<{ customer: Customer }>("/me")
      .then((value) => { if (!controller.signal.aborted) { setCustomer(value.customer); onSessionChange?.(value.customer); } })
      .catch(() => { if (!controller.signal.aborted) onSessionChange?.(null); });
    return () => controller.abort();
  }, [sessionAware, onSessionChange]);

  function logout() {
    void authRequest("/logout", {}).then(() => { setCustomer(null); onSessionChange?.(null); }).catch(() => {});
  }

  return (
    <header className={`public-header${mobileMenu ? " public-site-header" : ""}`}>
      <Link className="brand" href="/" aria-label="Beryl Shelter home">
        <BrandLogo />
      </Link>
      {mobileMenu && <button className="public-menu-button" type="button" aria-label="Toggle navigation" aria-expanded={open} onClick={() => setOpen(value => !value)}><span/><span/><span/></button>}
      <div className={`public-site-menu${open ? " open" : ""}`}>
        <nav className="public-nav" aria-label="Public navigation">
          {navigation.map(([label, href]) => <Link className={pathname === href ? "active" : undefined} href={href} key={label} onClick={() => setOpen(false)}>{label}</Link>)}
        </nav>
        <div className="header-actions">
        {sessionAware && customer && accountMenu ? <details className="public-account-menu"><summary>{[customer.first_name, customer.last_name].filter(Boolean).join(" ") || "My Account"}<span aria-hidden="true">⌄</span></summary><div className="public-account-dropdown">
          <Link href="/dashboard" onClick={() => setOpen(false)}>My Dashboard</Link>
          <Link href="/dashboard/listings/new" onClick={() => setOpen(false)}>List Property</Link>
          <Link href="/dashboard/referrals" onClick={() => setOpen(false)}>Referrals</Link>
          <span aria-disabled="true">Saved Property — unavailable</span><span aria-disabled="true">Compare Property — unavailable</span><span aria-disabled="true">Mortgage Calculator — unavailable</span>
          <button type="button" onClick={logout}>Log Out</button>
        </div></details> : sessionAware && customer ? <>
          <Link className="button button-outline header-button" href="/dashboard" onClick={() => setOpen(false)}>Dashboard</Link>
          <button className="button button-primary header-button" type="button" onClick={logout}>Log Out</button>
        </> : <>
          <Link className="button button-outline header-button" href="/login" onClick={() => setOpen(false)}>Login</Link>
          <Link className="button button-primary header-button" href="/register" onClick={() => setOpen(false)}>Register</Link>
        </>}
        </div>
      </div>
    </header>
  );
}
