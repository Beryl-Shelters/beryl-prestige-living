"use client";

import Link from "next/link";
import type { Route } from "next";
import { useQuery } from "@tanstack/react-query";
import { referralApi } from "@/lib/api/client";
import { ReferralLanding } from "./referral-landing";

export function ReferralCodeLanding({ code }: { code: string }) {
  const resolved = useQuery({ queryKey: ["referral-link", code], queryFn: () => referralApi.resolveCode(code), retry: false });
  if (resolved.isLoading) return <main className="referral-code-state" aria-live="polite">Checking referral link…</main>;
  if (resolved.isError) return <main className="referral-code-state"><h1>This referral link is unavailable</h1><p>It may be incomplete or no longer valid.</p><Link className="referral-primary-action" href={"/refer" as Route}>Open Beryl referrals</Link></main>;
  return <ReferralLanding referralCode={code} />;
}
