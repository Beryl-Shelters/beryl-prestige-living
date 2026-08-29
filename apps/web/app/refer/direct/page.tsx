import type { Metadata } from "next";
import { DirectReferralScreen } from "@/components/referrals/direct-referral-screen";

export const metadata: Metadata = { title: "Submit a referral", robots: { index: false, follow: false } };
export default function DirectReferralPage() { return <DirectReferralScreen />; }
