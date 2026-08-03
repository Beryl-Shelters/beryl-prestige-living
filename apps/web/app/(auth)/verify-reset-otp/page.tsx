import type { Metadata } from "next";
import { VerificationScreen } from "@/components/auth/verification-screen";
export const metadata: Metadata = { title: "Verify password reset code" };
export default function VerifyResetOtpPage() { return <VerificationScreen mode="reset" />; }
