"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { PublicHeader } from "../auth/public-header";
import type { Customer } from "../../lib/auth-api";
import { PublicSiteFooter } from "./public-site-footer";

const cards = [
  { title: "Refer someone to buy a property", description: "Are you referring someone to buy a property(ies)?", destination: "/buy" },
  { title: "Refer someone to sell a property", description: "Are you referring someone to sell a property(ies)?", destination: "/dashboard/referrals" },
] as const;

export function PublicReferralsPage() {
  const router = useRouter();
  const [session, setSession] = useState<"checking" | "guest" | "signed-in">("checking");
  const [destination, setDestination] = useState<string | null>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const onSessionChange = useCallback((value: Customer | null) => { if (value) { setSession("signed-in"); router.replace("/dashboard/referrals"); } else setSession("guest"); }, [router]);
  useEffect(() => {
    if (!destination) return;
    const previous = document.body.style.overflow; document.body.style.overflow = "hidden"; closeButton.current?.focus();
    return () => { document.body.style.overflow = previous; };
  }, [destination]);
  function close() { setDestination(null); setTimeout(() => trigger.current?.focus(), 0); }
  function keys(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") { event.preventDefault(); close(); return; }
    if (event.key !== "Tab" || !dialog.current) return;
    const items = [...dialog.current.querySelectorAll<HTMLElement>('button:not([disabled]),a[href]')]; const first = items[0], last = items.at(-1);
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  return <div className="public-page public-referrals-page">
    <PublicHeader sessionAware mobileMenu onSessionChange={onSessionChange} />
    {session === "guest" && <main>
      <div className="public-referrals-content">
        <header className="public-referrals-heading"><p>PROPERTY REFERRALS</p><h1>Refer a transaction</h1></header>
        <div className="public-referrals-cards">
          {cards.map(card => <article className="public-referrals-card" key={card.title}>
            <svg className="public-referral-icon" viewBox="0 0 52 49" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 22 31 13M20 27l11 9"/><circle cx="14" cy="25" r="10"/><circle cx="36" cy="10" r="9"/><circle cx="36" cy="39" r="9"/><circle cx="14" cy="22" r="2.5"/><path d="M9 30c.6-3 2.3-4 5-4s4.4 1 5 4"/><circle cx="36" cy="7" r="2.2"/><path d="M31.5 14c.6-2.8 2.1-3.8 4.5-3.8s3.9 1 4.5 3.8"/><circle cx="36" cy="36" r="2.2"/><path d="M31.5 43c.6-2.8 2.1-3.8 4.5-3.8s3.9 1 4.5 3.8"/></svg>
            <h2>{card.title}</h2>
            <p>{card.description}</p>
            <button type="button" onClick={event => { trigger.current = event.currentTarget; setDestination(card.destination); }}>Click Here <span aria-hidden="true">→</span></button>
          </article>)}
        </div>
      </div>
    </main>}
    {session === "guest" && <PublicSiteFooter />}
    {destination && <div className="referral-auth-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) close(); }}><div ref={dialog} className="referral-auth-dialog" role="dialog" aria-modal="true" aria-labelledby="referral-auth-title" onKeyDown={keys}>
      <button ref={closeButton} className="referral-auth-close" type="button" aria-label="Close referral sign-in prompt" onClick={close}>×</button>
      <span className="referral-auth-icon" aria-hidden="true"><svg viewBox="0 0 40 40" fill="none"><circle cx="20" cy="14" r="7" fill="currentColor" opacity=".55"/><path d="M8 32c0-7 5-11 12-11s12 4 12 11" fill="currentColor" opacity=".55"/><path d="m28 25 3 3 6-7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg></span>
      <h2 id="referral-auth-title">Sign in to refer a friend</h2><p>Please log in to your account to start referring and track your earnings. If you don&apos;t have an account yet, you can easily create one to get started.</p>
      <Link className="referral-auth-register" href={`/register?next=${encodeURIComponent(destination)}`}>Create free account</Link>
      <Link className="referral-auth-login" href={`/login?next=${encodeURIComponent(destination)}`}>Log In</Link>
    </div></div>}
  </div>;
}
