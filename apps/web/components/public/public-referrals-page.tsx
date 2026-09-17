"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useState } from "react";
import { PublicHeader } from "../auth/public-header";
import type { Customer } from "../../lib/auth-api";
import { PublicSiteFooter } from "./public-site-footer";

const cards = [
  { title: "Refer someone to buy a property", description: "Are you referring someone to buy a property(ies)?", destination: "/dashboard/listings" },
  { title: "Refer someone to sell a property", description: "Are you referring someone to sell a property(ies)?", destination: "/dashboard/referrals" },
] as const;

export function PublicReferralsPage() {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const onSessionChange = useCallback((value: Customer | null) => setCustomer(value), []);

  return <div className="public-page public-referrals-page">
    <PublicHeader sessionAware mobileMenu onSessionChange={onSessionChange} />
    <main>
      <div className="public-referrals-content">
        <header className="public-referrals-heading"><p>PROPERTY REFERRALS</p><h1>Refer a transaction</h1></header>
        <div className="public-referrals-cards">
          {cards.map(card => <article className="public-referrals-card" key={card.title}>
            <Image src="/referrals/referral-network.png" alt="" width={52} height={49} />
            <h2>{card.title}</h2>
            <p>{card.description}</p>
            <Link href={customer ? card.destination : `/login?next=${card.destination}`}>Click Here <span aria-hidden="true">→</span></Link>
          </article>)}
        </div>
      </div>
    </main>
    <PublicSiteFooter />
  </div>;
}
