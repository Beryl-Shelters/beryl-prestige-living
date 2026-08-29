"use client";

import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { referralApi } from "@/lib/api/client";
import { normalizePhone } from "@/lib/phone";

export function ReferralTrackingScreen() {
  const router = useRouter();
  const [requested, setRequested] = useState(false);
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const request = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError(""); setLoading(true);
    const form = new FormData(event.currentTarget);
    try {
      const normalized = normalizePhone(String(form.get("phone") || ""));
      await referralApi.requestTracking({ fullName: String(form.get("fullName") || ""), phone: normalized });
      setPhone(normalized); setRequested(true);
    } catch (nextError) {
      const value = nextError as { response?: { data?: { code?: string; message?: string } } };
      setError(value.response?.data?.code === "REFERRAL_TRACKING_UNAVAILABLE" ? "WhatsApp tracking codes are not configured yet. Please keep your referral reference safe." : value.response?.data?.message || "We could not request a tracking code.");
    } finally { setLoading(false); }
  };
  const verify = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError(""); setLoading(true);
    const form = new FormData(event.currentTarget);
    try { await referralApi.verifyTracking({ phone, otp: String(form.get("otp") || "") }); router.push("/referrals"); }
    catch (nextError) { const value = nextError as { response?: { data?: { message?: string } } }; setError(value.response?.data?.message || "That code is not valid."); }
    finally { setLoading(false); }
  };
  return <main className="referral-tracking-page"><section className="referral-access-card">
    <Link className="referral-back" href={"/refer" as Route}><ArrowLeft size={18} aria-hidden="true" />Back</Link>
    <MessageCircle size={44} aria-hidden="true" /><h1>{requested ? "Enter your tracking code" : "Track your referral earnings"}</h1>
    <p>{requested ? "Enter the six-digit code sent to your phone." : "Enter the name and phone number used for your referral. We’ll send a code on WhatsApp."}</p>
    {!requested ? <form onSubmit={(event) => { void request(event); }}><label>Full Name<input name="fullName" required minLength={2} /></label><label>Phone Number<input name="phone" required inputMode="tel" placeholder="0801 234 5678" /></label><button className="referral-primary-action" disabled={loading}>{loading ? "Checking…" : "Send tracking code"}</button></form> : <form onSubmit={(event) => { void verify(event); }}><label>Six-digit code<input name="otp" required inputMode="numeric" pattern="\d{6}" maxLength={6} autoComplete="one-time-code" /></label><button className="referral-primary-action" disabled={loading}>{loading ? "Verifying…" : "View my referrals"}</button></form>}
    {error ? <div className="referral-error" role="alert">{error}</div> : null}
    <p className="referral-login-option">Already have a Beryl account? <Link href={"/login?returnTo=%2Freferrals" as Route}>Log in</Link></p>
  </section></main>;
}
