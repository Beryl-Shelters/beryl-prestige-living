import type { Metadata } from "next";
import { BuyerOnboardingScreen } from "@/components/onboarding/buyer-onboarding-screen";
export const metadata: Metadata = { title: "Buyer onboarding" };
export default function BuyerOnboardingPage() { return <BuyerOnboardingScreen />; }
