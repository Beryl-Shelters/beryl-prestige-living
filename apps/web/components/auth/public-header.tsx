"use client";

import Link from "next/link";
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

export function PublicHeader({ sessionAware = false }: { sessionAware?: boolean }) {
  const [customer, setCustomer] = useState<Customer | null>(null);

  useEffect(() => {
    if (!sessionAware) return;
    const controller = new AbortController();
    void authRequest<{ customer: Customer }>("/me")
      .then((value) => { if (!controller.signal.aborted) setCustomer(value.customer); })
      .catch(() => {});
    return () => controller.abort();
  }, [sessionAware]);

  function logout() {
    void authRequest("/logout", {}).then(() => setCustomer(null)).catch(() => {});
  }

  return (
    <header className="public-header">
      <Link className="brand" href="/" aria-label="Beryl Shelter home">
        <BrandLogo />
      </Link>
      <nav className="public-nav" aria-label="Public navigation">
        {navigation.map(([label, href]) => <Link href={href} key={label}>{label}</Link>)}
      </nav>
      <div className="header-actions">
        {sessionAware && customer ? <>
          <Link className="button button-outline header-button" href="/dashboard">Dashboard</Link>
          <button className="button button-primary header-button" type="button" onClick={logout}>Log Out</button>
        </> : <>
          <Link className="button button-outline header-button" href="/login">Login</Link>
          <Link className="button button-primary header-button" href="/register">Register</Link>
        </>}
      </div>
    </header>
  );
}
