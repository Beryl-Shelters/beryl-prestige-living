import type { Metadata } from "next";
import { ReferralTrackingScreen } from "@/components/referrals/referral-tracking-screen";

export const metadata: Metadata = { title: "Track referrals", robots: { index: false, follow: false } };
export default function ReferralTrackingPage() { return <ReferralTrackingScreen />; }
