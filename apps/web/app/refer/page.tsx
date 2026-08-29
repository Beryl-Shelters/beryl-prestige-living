import type { Metadata } from "next";
import { ReferralLanding } from "@/components/referrals/referral-landing";

export const metadata: Metadata = { title: "Refer someone", robots: { index: false, follow: false } };
export default function ReferPage() { return <ReferralLanding />; }
