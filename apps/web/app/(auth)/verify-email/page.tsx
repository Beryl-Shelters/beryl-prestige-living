import type { Metadata } from "next";
import { VerificationScreen } from "@/components/auth/verification-screen";
export const metadata: Metadata = { title: "Verify your email" };
export default function VerifyEmailPage() { return <VerificationScreen mode="email" />; }
