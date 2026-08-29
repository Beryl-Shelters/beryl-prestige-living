"use client";

import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { useAuth } from "@/context/auth-provider";
import { referralApi } from "@/lib/api/client";
import { normalizePhone } from "@/lib/phone";
import type { DirectReferralResult, ReferralContactMethod, ReferralPurpose } from "@/lib/contracts";
import { CopyReferralLink } from "./copy-referral-link";

const errorMessage = (error: unknown) => {
  const value = error as { response?: { data?: { message?: string } } };
  return value.response?.data?.message || "We could not submit this referral. Please try again.";
};

export function DirectReferralScreen({ referralCode }: { referralCode?: string }) {
  const { session } = useAuth();
  const [contactMethod, setContactMethod] = useState<ReferralContactMethod>("WHATSAPP");
  const [purpose, setPurpose] = useState<ReferralPurpose>("BUYING");
  const [privateDisclosure, setPrivateDisclosure] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<DirectReferralResult | null>(null);
  const customerPhone = session?.user.phone || "";
  const defaultReferrer = useMemo(() => ({ fullName: session?.user.fullName || "", phone: customerPhone }), [session, customerPhone]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError("");
    setSubmitting(true);
    try {
      const referrerPhone = normalizePhone(String(form.get("referrerPhone") || ""));
      const referredPhone = contactMethod === "EMAIL" ? undefined : normalizePhone(String(form.get("referredContact") || ""));
      const response = await referralApi.submit({
        ...(!session ? { referrer: { fullName: String(form.get("referrerName") || ""), phone: referrerPhone } } : {}),
        referred: {
          fullName: String(form.get("referredName") || ""),
          contactMethod,
          ...(contactMethod === "EMAIL" ? { email: String(form.get("referredContact") || "") } : { phone: referredPhone })
        },
        purpose,
        notes: String(form.get("notes") || "") || undefined,
        privateReferrerDisclosure: privateDisclosure,
        consent: true,
        ...(referralCode ? { referralCode } : {})
      });
      setResult(response.data);
    } catch (nextError) { setError(errorMessage(nextError)); }
    finally { setSubmitting(false); }
  };

  if (result) return <main className="referral-success-page">
    <div className="referral-success-card">
      <Image src="/images/referrals/referral-success.png" alt="" width={180} height={180} />
      <CheckCircle2 className="referral-success-check" size={34} aria-hidden="true" />
      <p className="referral-kicker">{result.referral.referenceId}</p>
      <h1>Referral submitted</h1>
      <p>Thanks. We’ll contact {result.referral.referredFirstName}. Commission is earned only if their property deal completes.</p>
      <CopyReferralLink value={result.referrer.referralLink} compact />
      {result.nextAction === "OPEN_REFERRAL_DASHBOARD" ? <Link className="referral-primary-action" href={"/referrals" as Route}>View your referrals</Link> : result.trackingAvailable ? <Link className="referral-primary-action" href={"/referrals/track" as Route}>Send tracking code on WhatsApp</Link> : <div className="referral-info-note" role="status">Phone tracking is not available yet. Keep your referral link and reference safe.</div>}
      <Link className="referral-secondary-link" href={"/refer/direct" as Route}>Refer someone else</Link>
    </div>
  </main>;

  return <main className="referral-form-page">
    <aside className="referral-form-art" aria-hidden="true"><Image src="/images/referrals/referral-form-portrait.png" alt="" fill sizes="50vw" priority /></aside>
    <section className="referral-form-panel">
      <Link className="referral-back" href={"/refer" as Route}><ArrowLeft size={18} aria-hidden="true" />Back</Link>
      <div className="referral-form-content">
        <h1>Do you know someone buying or selling a property?</h1>
        <p>Introduce them to Beryl and earn up to 25% commission when the deal completes.</p>
        <form onSubmit={(event) => { void submit(event); }}>
          <fieldset><legend>About you</legend>
            <label>Full Name<input name="referrerName" defaultValue={defaultReferrer.fullName} readOnly={Boolean(session)} required={!session} minLength={2} /></label>
            <label>Your phone number<span className="referral-phone-input"><span>+234</span><input name="referrerPhone" defaultValue={defaultReferrer.phone.replace(/^\+234/, "")} readOnly={Boolean(session && customerPhone)} inputMode="tel" required={!session} placeholder="801 234 5678" /></span></label>
          </fieldset>
          <fieldset><legend>Who you’re referring</legend>
            <label>Their Full Name<input name="referredName" required minLength={2} /></label>
            <div className="referral-field"><span>How should we contact them?</span><div className="referral-choice-row">{(["WHATSAPP", "CALL", "EMAIL"] as ReferralContactMethod[]).map((method) => <button type="button" className={contactMethod === method ? "selected" : ""} onClick={() => setContactMethod(method)} key={method}>{method === "WHATSAPP" ? "WhatsApp" : method === "CALL" ? "Call" : "Email"}</button>)}</div></div>
            <label>{contactMethod === "EMAIL" ? "Their email address" : "Their phone number"}<input name="referredContact" key={contactMethod} required type={contactMethod === "EMAIL" ? "email" : "tel"} inputMode={contactMethod === "EMAIL" ? "email" : "tel"} /></label>
            <div className="referral-field"><span>Are they buying or selling?</span><div className="referral-choice-row referral-purpose-row"><button type="button" className={purpose === "BUYING" ? "selected" : ""} onClick={() => setPurpose("BUYING")}>Buying</button><button type="button" className={purpose === "SELLING" ? "selected" : ""} onClick={() => setPurpose("SELLING")}>Selling</button></div></div>
            <label>Anything else we should know? <small>Optional</small><textarea name="notes" maxLength={600} rows={4} /></label>
          </fieldset>
          <label className="referral-check"><input type="checkbox" checked={privateDisclosure} onChange={(event) => setPrivateDisclosure(event.target.checked)} /><span><strong>Don’t tell them I referred them</strong><small>We’ll keep your name private when we reach out.</small></span></label>
          <label className="referral-check"><input type="checkbox" required /><span>I have permission to share these details and accept the <Link href="/terms">Referral Terms</Link>.</span></label>
          {error ? <div className="referral-error" role="alert">{error}</div> : null}
          <button className="referral-primary-action referral-submit" type="submit" disabled={submitting}>{submitting ? "Submitting referral…" : "Submit Referral"}</button>
        </form>
      </div>
    </section>
  </main>;
}
