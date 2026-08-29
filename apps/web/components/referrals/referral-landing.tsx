"use client";

import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";
import { ArrowLeft, ArrowRight, Link2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { MarketplaceHeader } from "@/components/marketplace/marketplace-header";
import { referralApi } from "@/lib/api/client";
import { publicWebUrl } from "@/lib/site-urls";
import { CopyReferralLink } from "./copy-referral-link";

export function ReferralLanding({ referralCode }: { referralCode?: string }) {
  const context = useQuery({ queryKey: ["referral-context"], queryFn: referralApi.context, retry: false });
  const referrer = context.data?.data.referrer;
  const link = referrer?.referralLink ?? (referralCode ? publicWebUrl(`/r/${referralCode}`) : null);
  return <main className="referral-page referral-landing-page">
    <MarketplaceHeader returnTo={referralCode ? `/r/${referralCode}` : "/refer"} />
    <section className="referral-landing-shell">
      <div className="referral-landing-topline">
        <Link href="/marketplace"><ArrowLeft size={18} aria-hidden="true" />Back</Link>
        <a href="#how-it-works">See how it works</a>
      </div>
      <div className="referral-hero">
        <div className="referral-hero-copy">
          <p className="referral-kicker">BERYL REFERRALS</p>
          <h1>Refer someone and earn up to <span className="text-[#70521b]">₦2,500,000.</span></h1>
          <p>Know anyone buying or selling property in Nigeria? Introduce them to Beryl and earn up to 25% when the deal closes.</p>
          <p className="referral-plain-note">No account needed. Takes a minute. Refer as many as you like.</p>
          <div className="referral-link-block">
            <h2><Link2 size={20} aria-hidden="true" />Copy and share your referral link</h2>
            {context.isLoading ? <div className="referral-skeleton" aria-label="Loading referral link" /> : null}
            {link ? <CopyReferralLink value={link} /> : <div className="referral-link-unavailable">
              <p>Submit your first referral to receive your own shareable link.</p>
              <Link href={"/refer/direct" as Route}>Get your referral link</Link>
            </div>}
          </div>
          <div className="referral-or"><span>or</span></div>
          <div className="referral-direct-card" id="how-it-works">
            <div><h2>Refer them directly</h2><p>Give us their name &amp; contact, and we’ll reach out.</p></div>
            <Link className="referral-primary-action" href={"/refer/direct" as Route}>Fill in their details<ArrowRight size={18} aria-hidden="true" /></Link>
          </div>
          <p className="referral-track-link">To track your earnings, <Link href={"/referrals/track" as Route}>click here</Link></p>
        </div>
        <div className="referral-hero-art"><Image src="/images/referrals/referral-hero-collage.png" alt="People sharing Beryl Shelter property referrals" width={618} height={595} priority /></div>
      </div>
    </section>
  </main>;
}
