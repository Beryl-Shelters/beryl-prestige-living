import type { Metadata } from "next";
import { ResetPasswordScreen } from "@/components/auth/reset-password-screen";
export const metadata: Metadata = { title: "Set a new password" };
export default function ResetPasswordPage() { return <ResetPasswordScreen />; }
