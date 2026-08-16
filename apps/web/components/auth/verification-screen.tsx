"use client";

import { ArrowLeft, Mail } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { AuthShell } from "./auth-shell";
import { OtpInput } from "./otp-input";
import { ApiAlert, Spinner, SuccessState } from "@/components/ui/feedback";
import { customerApi } from "@/lib/api/client";
import { apiErrorOf } from "@/lib/api/errors";
import { routeForNextAction } from "@/lib/navigation";
import { useAuth } from "@/context/auth-provider";
import type { ApiSuccess, ResetOtpResult, VerifyEmailResult } from "@/lib/contracts";
import { customerPersonaForAnalytics, trackCustomerEvent } from "@/lib/analytics/customer";
import { prepareOnboardingAnalyticsTrigger } from "@/lib/analytics/onboarding-trigger";

export function VerificationScreen({ mode }: { mode: "email" | "reset" }) {
  const trackedView = useRef(false);
  const resendCount = useRef(0);
  const verificationAttempts = useRef(0);
  const router = useRouter();
  const { pendingSignup, resetEmail, login, setPendingSignup } = useAuth();
  const email = mode === "email" ? pendingSignup?.email ?? "" : resetEmail;
  const maskedEmail = mode === "email" ? pendingSignup?.maskedEmail ?? email : email.replace(/^(.).+(@.*)$/, "$1•••$2");
  const [countdown, setCountdown] = useState(60);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [attempts, setAttempts] = useState<number | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const verify = useMutation({ mutationFn: async (otp: string): Promise<ApiSuccess<VerifyEmailResult | ResetOtpResult>> => mode === "email" ? customerApi.verifyEmail({ email, otp }) : customerApi.verifyResetOtp({ email, otp }) });
  const resend = useMutation({ mutationFn: () => mode === "email" ? customerApi.resendVerificationOtp({ email }) : customerApi.forgotPassword({ email }) });

  useEffect(() => {
    if (trackedView.current || !email) return;
    trackedView.current = true;
    void trackCustomerEvent("Verification Screen Viewed", { otp_context: mode === "email" ? "signup" : "forgot_password" });
  }, [email, mode]);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = window.setInterval(() => setCountdown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [countdown]);

  const submitOtp = async (otp: string) => {
    if (!email || verify.isPending) return;
    verificationAttempts.current += 1;
    setError("");
    try {
      const response = await verify.mutateAsync(otp);
      setSuccess(true);
      if (mode === "reset") {
        window.setTimeout(() => router.push("/reset-password"), 650);
        return;
      }
      let nextAction = response.data.nextAction;
      if (pendingSignup?.password) {
        const authenticated = await login(pendingSignup.email, pendingSignup.password);
        nextAction = authenticated.nextAction;
      } else {
        nextAction = "LOGIN";
      }
      setPendingSignup(pendingSignup ? { ...pendingSignup, password: undefined } : null);
      if (nextAction === "COMPLETE_BUYER_ONBOARDING" || nextAction === "COMPLETE_SELLER_ONBOARDING") {
        prepareOnboardingAnalyticsTrigger({ persona: customerPersonaForAnalytics(nextAction === "COMPLETE_BUYER_ONBOARDING" ? "BUYER" : "SELLER_DEVELOPER"), source: "signup" });
      }
      window.setTimeout(() => router.push(routeForNextAction(nextAction)), 650);
    } catch (caught) {
      const apiError = apiErrorOf(caught);
      if (apiError.code === "INVALID_OTP" || apiError.code === "OTP_EXPIRED") {
        void trackCustomerEvent("OTP Verification Failed", { otp_context: mode === "email" ? "signup" : "forgot_password", attempt_number: verificationAttempts.current, failure_reason: apiError.code === "INVALID_OTP" ? "invalid" : "expired" });
      }
      setAttempts(apiError.attemptsRemaining ?? null);
      setError(apiError.code === "INVALID_OTP" ? `That code was not right.${apiError.attemptsRemaining !== undefined ? ` ${apiError.attemptsRemaining} attempts left.` : ""}` : apiError.code === "OTP_EXPIRED" ? "That code has expired. Request a new one." : apiError.code === "OTP_ATTEMPTS_EXCEEDED" ? "Too many tries. Request a new code to continue." : apiError.code === "OTP_NO_LONGER_VALID" ? "That code is no longer valid. Request a new one." : apiError.message);
      setResetKey((value) => value + 1);
    }
  };

  const resendCode = async () => {
    if (countdown > 0) return;
    setError("");
    resendCount.current += 1;
    void trackCustomerEvent("OTP Resend Requested", { otp_context: mode === "email" ? "signup" : "forgot_password", resend_count: resendCount.current });
    try {
      const response = await resend.mutateAsync();
      setCountdown(response.data.resendAvailableIn);
      setAttempts(null);
      setResetKey((value) => value + 1);
    } catch (caught) {
      const apiError = apiErrorOf(caught);
      if (apiError.code === "OTP_RESEND_COOLDOWN" && apiError.retryAfter) setCountdown(apiError.retryAfter);
      setError(apiError.message);
    }
  };

  if (!email) return <AuthShell><ApiAlert tone="info">This verification session is no longer available. Start again.</ApiAlert><Link className="btn btn-primary mt-4" href={mode === "email" ? "/signup" : "/forgot-password"}>Start again</Link></AuthShell>;
  if (success) return <AuthShell intent={pendingSignup?.intent}><SuccessState title={mode === "email" ? "Verification successful" : "Code verified"} message={mode === "email" ? "Preparing your Beryl Shelter experience…" : "Taking you to set a new password…"} /></AuthShell>;

  return <AuthShell intent={pendingSignup?.intent}><Link className="eyebrow-link" href={mode === "email" ? "/signup" : "/forgot-password"}><ArrowLeft size={14} aria-hidden />Back</Link><div className="mx-auto my-6 grid h-20 w-28 place-items-center rounded-xl bg-brand-cream"><Mail size={42} color="var(--color-brand-brown)" aria-hidden /></div><h1 className="page-title">{mode === "email" ? "Check your email for OTP" : "Check your email for the password reset code"}</h1><p className="page-copy">We sent a 6-digit code to <strong>{maskedEmail}</strong>. Enter it below to continue.</p><div className="form-stack"><span className="field-label">Enter OTP here</span><OtpInput onComplete={submitOtp} disabled={verify.isPending} resetKey={resetKey} />{verify.isPending ? <div className="flex items-center justify-center gap-2 py-5 text-brand-muted" role="status"><Spinner />Verifying…</div> : null}{error ? <ApiAlert>{error}</ApiAlert> : null}<p className="text-center text-sm text-brand-muted">Didn&apos;t get it? <button type="button" className="font-bold text-brand-brown disabled:text-brand-muted" disabled={countdown > 0 || resend.isPending || attempts === 0} onClick={resendCode}>{resend.isPending ? "Sending…" : countdown > 0 ? `Resend code in 0:${String(countdown).padStart(2, "0")}` : "Resend code"}</button></p>{mode === "email" ? <Link className="btn bg-brand-cream text-brand-brown" href="/signup">Wrong email? Change it</Link> : null}</div></AuthShell>;
}
