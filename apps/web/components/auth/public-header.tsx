"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { authRequest, type Customer } from "../../lib/auth-api";
import { BrandLogo } from "./brand-logo";
import { FloatingHelp } from "../public/floating-help";
import { SellAssistanceDecision } from "../public/sell-assistance-decision";

const navigation = [
  ["Home", "/"],
  ["About", "/about"],
  ["Referrals", "/referrals"],
  ["Buy", "/buy"],
  ["Sell / List a Property", "/sell"],
  ["Analytics & Insights", "/analytics"],
  ["Careers", "/careers"],
  ["Support", "/support"],
] as const;

type AccountIconName = "dashboard" | "listing" | "referrals" | "saved" | "compare" | "mortgage" | "logout";
function AccountIcon({ name }: { name: AccountIconName }) {
  const paths = {
    dashboard: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    listing: <path d="m3 11 9-7 9 7v9H3z"/>, referrals: <path d="M4 17c4-6 8-6 14-6m-4-4 4 4-4 4"/>,
    saved: <path d="M12 20 4.5 12.5a5 5 0 0 1 7.5-6.6 5 5 0 0 1 7.5 6.6Z"/>,
    compare: <><path d="M5 10a7 7 0 0 1 12-4l2 2M19 14a7 7 0 0 1-12 4l-2-2"/><path d="M19 3v5h-5M5 21v-5h5"/></>,
    mortgage: <><rect x="3" y="3" width="18" height="18" rx="1"/><path d="M7 8h10M8 13h2m4 0h2M8 17h2m4 0h2"/></>,
    logout: <><path d="M10 3H4v18h6M10 12h11m-4-4 4 4-4 4"/></>,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

export function PublicHeader({ sessionAware = false, mobileMenu = false, onSessionChange }: { sessionAware?: boolean; mobileMenu?: boolean; onSessionChange?: (customer: Customer | null) => void }) {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [open, setOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [sellPromptOpen, setSellPromptOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  const accountTrigger = useRef<HTMLButtonElement>(null);
  const sellTrigger = useRef<HTMLAnchorElement>(null);
  const pathname = usePathname();
  const router = useRouter();
  const helpExcluded = ["/login","/register","/verify-email","/forgot-password","/reset-password","/auth","/account"].some(path => pathname === path || pathname.startsWith(`${path}/`));

  useEffect(() => {
    if (!sessionAware) return;
    const controller = new AbortController();
    void authRequest<{ customer: Customer }>("/me")
      .then((value) => { if (!controller.signal.aborted) { setCustomer(value.customer); onSessionChange?.(value.customer); } })
      .catch(() => { if (!controller.signal.aborted) onSessionChange?.(null); });
    return () => controller.abort();
  }, [sessionAware, onSessionChange]);

  useEffect(() => {
    if (!accountOpen) return;
    const outside = (event: PointerEvent) => { if (!accountRef.current?.contains(event.target as Node)) setAccountOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { setAccountOpen(false); accountTrigger.current?.focus(); } };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [accountOpen]);

  function logout() {
    setAccountOpen(false); setOpen(false);
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
          {navigation.map(([label, href]) => {
            const isSell = label === "Sell / List a Property";
            return <Link ref={isSell ? sellTrigger : undefined} className={pathname === href || isSell && pathname.startsWith("/sell") ? "active" : undefined} href={href} key={label} onClick={event => {
              if (isSell) { event.preventDefault(); setOpen(false); setAccountOpen(false); setSellPromptOpen(true); return; }
              setOpen(false);
            }}>{label}</Link>;
          })}
        </nav>
        <div className="header-actions">
        {sessionAware && customer ? <div className="public-account-menu" ref={accountRef}>
          <button ref={accountTrigger} className="public-account-trigger" type="button" aria-haspopup="true" aria-expanded={accountOpen} aria-controls="public-account-dropdown" onClick={() => setAccountOpen(value => !value)}>
            <span className="public-account-avatar" aria-hidden="true"><svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="8" r="3.5"/><path d="M5 19a7 7 0 0 1 14 0Z"/></svg></span>
            <span className="public-account-name">{[customer.first_name, customer.last_name].filter(Boolean).join(" ") || "My Account"}</span>
            <svg className="public-account-chevron" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="m3 7 7 6 7-6"/></svg>
          </button>
          {accountOpen && <nav id="public-account-dropdown" className="public-account-dropdown" aria-label="Account navigation">
            <Link href="/dashboard" onClick={() => { setAccountOpen(false); setOpen(false); }}><AccountIcon name="dashboard"/>My Dashboard</Link>
            <Link href="/dashboard/listings/new" onClick={() => { setAccountOpen(false); setOpen(false); }}><AccountIcon name="listing"/>List Property</Link>
            <Link href="/dashboard/referrals" onClick={() => { setAccountOpen(false); setOpen(false); }}><AccountIcon name="referrals"/>Referrals</Link>
            <Link href="/saved-properties" onClick={() => { setAccountOpen(false); setOpen(false); }}><AccountIcon name="saved"/>Saved Property</Link>
            <Link href="/compare-properties" onClick={() => { setAccountOpen(false); setOpen(false); }}><AccountIcon name="compare"/>Compare Property</Link>
            <Link href="/mortgage-calculator" onClick={() => { setAccountOpen(false); setOpen(false); }}><AccountIcon name="mortgage"/>Mortgage Calculator</Link>
            <button type="button" onClick={logout}><AccountIcon name="logout"/>Log Out</button>
          </nav>}
        </div> : <>
          <Link className="button button-outline header-button" href="/login" onClick={() => setOpen(false)}>Login</Link>
          <Link className="button button-primary header-button" href="/register" onClick={() => setOpen(false)}>Register</Link>
        </>}
        </div>
      </div>
      {!helpExcluded&&<FloatingHelp key={pathname} pathname={pathname} customer={customer}/>}
      <SellAssistanceDecision open={sellPromptOpen} onClose={() => { setSellPromptOpen(false); setTimeout(() => sellTrigger.current?.focus(), 0); }} onNo={() => { setSellPromptOpen(false); router.push("/sell"); }} onYes={() => { setSellPromptOpen(false); router.push("/sell/assistance"); }}/>
    </header>
  );
}
