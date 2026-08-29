import type { Metadata } from "next";
import { ReferralCodeLanding } from "@/components/referrals/referral-code-landing";

export const metadata: Metadata = { title: "Beryl referral", robots: { index: false, follow: false } };
export default async function ReferralCodePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <ReferralCodeLanding code={code} />;
}
