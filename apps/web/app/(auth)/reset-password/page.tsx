import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ResetPasswordScreen } from "@/components/auth/reset-password-screen";
import { SESSION_COOKIES } from "@/lib/server/session-cookies";
export const metadata: Metadata = { title: "Set a new password" };
export default async function ResetPasswordPage() {
  const cookieStore = await cookies();
  if (!cookieStore.get(SESSION_COOKIES.resetProof)?.value) redirect("/forgot-password");
  return <ResetPasswordScreen />;
}
