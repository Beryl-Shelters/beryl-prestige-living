import type { Metadata } from "next";
import { ReferralDashboardScreen } from "@/components/referrals/referral-dashboard-screen";

export const metadata: Metadata = { title: "Your referrals", robots: { index: false, follow: false } };
export default function ReferralsPage() { return <ReferralDashboardScreen />; }
