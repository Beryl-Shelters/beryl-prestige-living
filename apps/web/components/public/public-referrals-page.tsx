"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
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
  const onSessionChange = useCallback((value: Customer | null) => { if (value) { setSession("signed-in"); router.replace("/dashboard/referrals"); } else setSession("guest"); }, [router]);

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
            <Link href={`/login?next=${card.destination}`}>Click Here <span aria-hidden="true">→</span></Link>
          </article>)}
        </div>
      </div>
    </main>}
    {session === "guest" && <PublicSiteFooter />}
  </div>;
}
