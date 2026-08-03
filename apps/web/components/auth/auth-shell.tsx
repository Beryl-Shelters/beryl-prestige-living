"use client";

import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";
import { CheckCircle2, X } from "lucide-react";
import type { GettingStartedAs } from "@/lib/contracts";

const content = {
  FIND_PROPERTY: {
    image: "/images/auth/buyer-home.jpg",
    title: "Find a home you can trust with Beryl Shelter today",
    description: "Verified listings, real people, and a team that has served Nigeria since 2001.",
    benefits: ["Every listing verified before it is live", "Talk to a real agent, anytime", "Buy or sell from anywhere"]
  },
  LIST_PROPERTY: {
    image: "/images/auth/seller-property.jpg",
    title: "List your property with Beryl Shelter today",
    description: "Reach the right buyers and stay in control, from listing to close.",
    benefits: ["Reach verified buyers across Nigeria and the diaspora", "List your property in minutes, not days", "Track every enquiry and manage listings in one place"]
  }
} satisfies Record<GettingStartedAs, { image: string; title: string; description: string; benefits: string[] }>;

export function AuthShell({ children, intent = "FIND_PROPERTY", backHref }: { children: React.ReactNode; intent?: GettingStartedAs; backHref?: Route }) {
  const selected = content[intent];
  return <main className="auth-shell"><aside className="auth-artwork" aria-label={`${intent === "FIND_PROPERTY" ? "Buyer" : "Seller"} welcome`}><Image className="auth-artwork-image" src={selected.image} alt="" fill priority sizes="50vw" /><div className="auth-artwork-copy"><h2>{selected.title}</h2><p>{selected.description}</p><ul>{selected.benefits.map((benefit) => <li key={benefit}><CheckCircle2 size={18} fill="white" color="white" aria-hidden />{benefit}</li>)}</ul></div></aside><section className="auth-panel"><header className="flex items-center justify-between"><span className="brand-wordmark">Beryl Shelter</span>{backHref ? <Link className="eyebrow-link" href={backHref}>Keep browsing homes <X size={14} aria-hidden /></Link> : null}</header><div className="auth-content">{children}</div></section></main>;
}
