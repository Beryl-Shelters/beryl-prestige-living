import type { Metadata } from "next";
import { SellerOnboardingScreen } from "@/components/onboarding/seller-onboarding-screen";
export const metadata: Metadata = { title: "Seller onboarding" };
export default function SellerOnboardingPage() { return <SellerOnboardingScreen />; }
