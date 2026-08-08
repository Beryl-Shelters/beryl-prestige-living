"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthLayout } from "./auth-layout";
import { OtpInput } from "./otp-input";
import { errorMessage, postApi } from "@/lib/client-api";

type Challenge = { challengeId: string; maskedEmail: string; resendAvailableIn: number };
const read = () => { try { return JSON.parse(sessionStorage.getItem("beryl_admin_activation_challenge") ?? "") as Challenge; } catch { return null; } };
export function ActivationOtpScreen() {
  const router = useRouter(); const [challenge] = useState<Challenge | null>(() => typeof window === "undefined" ? null : read()); const [remaining, setRemaining] = useState(() => typeof window === "undefined" ? 0 : read()?.resendAvailableIn ?? 0); const [busy, setBusy] = useState(false); const [message, setMessage] = useState(""); const [resetKey, setResetKey] = useState(0);
  useEffect(() => { if (!challenge) router.replace("/login"); }, [challenge, router]);
  useEffect(() => { if (!remaining) return; const timer = window.setTimeout(() => setRemaining((value) => Math.max(0, value - 1)), 1_000); return () => window.clearTimeout(timer); }, [remaining]);
  const verify = async (otp: string) => { if (!challenge || busy) return; setBusy(true); setMessage(""); try { await postApi("/api/admin/verify-activation-otp", { challengeId: challenge.challengeId, otp }); sessionStorage.removeItem("beryl_admin_activation_challenge"); router.replace("/set-password" as never); } catch (error) { setMessage(errorMessage(error, "Unable to verify this code.")); setResetKey((value) => value + 1); } finally { setBusy(false); } };
  const resend = async () => { if (!challenge || remaining || busy) return; setBusy(true); try { const response = await postApi<{ resendAvailableIn: number }>("/api/admin/resend-activation-otp", { challengeId: challenge.challengeId }); const next = response.data?.resendAvailableIn ?? 60; setRemaining(next); setMessage("A new activation code has been sent."); } catch (error) { setMessage(errorMessage(error, "Unable to resend the code.")); } finally { setBusy(false); } };
  return <AuthLayout title="Confirm your invitation."><h1 className="page-title">Check your email for OTP</h1><p className="page-copy">We sent a 6-digit code to <strong>{challenge?.maskedEmail ?? "your email"}</strong>. Enter it below to activate your account.</p><label className="field-label">Enter OTP here</label><OtpInput key={resetKey} onComplete={verify} disabled={busy} /><div aria-live="polite" style={{ minHeight: 44, marginTop: 16 }}>{message ? <p className="alert alert-error" role="alert">{message}</p> : null}</div><button className="button button-primary" type="button" style={{ width: "100%" }} disabled={busy || remaining > 0} onClick={resend}>{remaining ? `Resend code in 0:${String(remaining).padStart(2, "0")}` : "Resend code"}</button></AuthLayout>;
}
