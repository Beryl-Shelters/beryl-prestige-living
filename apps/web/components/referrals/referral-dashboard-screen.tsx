"use client";

import Link from "next/link";
import type { Route } from "next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useEffect, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, Plus, WalletCards, X } from "lucide-react";
import { MarketplaceHeader } from "@/components/marketplace/marketplace-header";
import { referralApi } from "@/lib/api/client";
import type { ReferralDashboardItem } from "@/lib/contracts";
import { CopyReferralLink } from "./copy-referral-link";

const money = (value: number | null) => value === null ? "—" : new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(value);
const shortDate = (value: string) => new Intl.DateTimeFormat("en-NG", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));

function ReferralRow({ item }: { item: ReferralDashboardItem }) {
  return <article className="referral-dashboard-row">
    <div><strong>{item.referredName}</strong><span>{item.referenceId}</span></div>
    <span className="referral-purpose-pill">{item.purpose === "BUYING" ? "Buying" : "Selling"}</span>
    <time dateTime={item.submittedAt}>{shortDate(item.submittedAt)}</time>
    <span className={`referral-status referral-status-${item.status.toLowerCase()}`}>{item.statusLabel}</span>
    <div className="referral-reward"><strong>{money(item.rewardAmount)}</strong><span>{item.paymentStatus === "PAID" ? "Paid" : item.paymentStatus === "OUTSTANDING" ? "Not paid yet" : "Not eligible"}</span></div>
  </article>;
}

function PayoutDialog({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const directory = useQuery({ queryKey: ["referral-banks"], queryFn: referralApi.banks });
  const payout = useQuery({ queryKey: ["referral-payout"], queryFn: referralApi.payout, retry: false });
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const details = payout.data?.data.payoutDetails;
  useEffect(() => {
    if (!payout.isLoading && !details) setEditing(true);
  }, [details, payout.isLoading]);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError(""); setSaving(true);
    const form = new FormData(event.currentTarget);
    try {
      await referralApi.savePayout({ bankCode: String(form.get("bankCode") || ""), accountNumber: String(form.get("accountNumber") || ""), accountName: String(form.get("accountName") || "") });
      await queryClient.invalidateQueries({ queryKey: ["referral-payout"] });
      setEditing(false);
    } catch (nextError) {
      const value = nextError as { response?: { data?: { message?: string } } };
      setError(value.response?.data?.message || "We could not save your payment details.");
    } finally { setSaving(false); }
  };
  return <div className="referral-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="referral-modal" role="dialog" aria-modal="true" aria-labelledby="payout-title">
      <button className="referral-modal-close" type="button" onClick={onClose} aria-label="Close payment details"><X aria-hidden="true" /></button>
      <WalletCards size={38} aria-hidden="true" />
      <h2 id="payout-title">{editing ? "Add your bank details" : "Payment details"}</h2>
      {editing ? <>
        <p>We’ll use these details when an approved referral reward is ready for payment.</p>
        <form className="referral-payout-form" onSubmit={(event) => { void submit(event); }}>
          <label>Bank<select name="bankCode" required defaultValue=""><option value="" disabled>Select your bank</option>{directory.data?.data.banks.map((bank) => <option key={bank.code} value={bank.code}>{bank.name}</option>)}</select></label>
          <label>Account Number<input name="accountNumber" required inputMode="numeric" pattern="\d{10}" maxLength={10} placeholder="10 digits" /></label>
          <label>Account Name<input name="accountName" required minLength={2} maxLength={100} /><small>Enter the name exactly as it appears on the account.</small></label>
          <div className="referral-info-note">Account-name confirmation is manual.</div>
          {error ? <div className="referral-error" role="alert">{error}</div> : null}
          <button className="referral-primary-action" type="submit" disabled={saving}>{saving ? "Saving…" : "Save bank details"}</button>
        </form>
      </> : details ? <div className="referral-payout-summary">
        <dl><div><dt>Account Name</dt><dd>{details.accountName}</dd></div><div><dt>Bank</dt><dd>{details.bankName}</dd></div><div><dt>Account Number</dt><dd>{details.maskedAccountNumber}</dd></div></dl>
        <button className="referral-primary-action" type="button" onClick={() => setEditing(true)}>Change</button>
      </div> : <p>Payment details have not been added.</p>}
    </section>
  </div>;
}

export function ReferralDashboardScreen() {
  const [page, setPage] = useState(1);
  const [payoutOpen, setPayoutOpen] = useState(false);
  const dashboard = useQuery({ queryKey: ["referral-dashboard", page], queryFn: () => referralApi.dashboard(page), retry: false });
  const data = dashboard.data?.data;
  if (dashboard.isLoading) return <main className="referral-dashboard-page"><MarketplaceHeader returnTo="/referrals" /><div className="referral-dashboard-shell"><div className="referral-dashboard-loading" aria-live="polite">Loading your referrals…</div></div></main>;
  if (dashboard.isError || !data) return <main className="referral-dashboard-page"><MarketplaceHeader returnTo="/referrals" /><section className="referral-access-card"><h1>Track your referrals</h1><p>Verify your referral-only phone number to view progress, or log in with your Beryl customer account.</p><Link className="referral-primary-action" href={"/referrals/track" as Route}>Track with phone</Link><Link href={"/login?returnTo=%2Freferrals" as Route}>Log in</Link></section></main>;
  return <main className="referral-dashboard-page">
    <MarketplaceHeader returnTo="/referrals" />
    <section className="referral-dashboard-shell">
      <Link className="referral-back" href={"/refer" as Route}><ArrowLeft size={18} aria-hidden="true" />Referral home</Link>
      <div className="referral-dashboard-heading"><div><p className="referral-kicker">REFERRAL DASHBOARD</p><h1>Your referrals</h1><p>Welcome back, {data.referrer.fullName}.</p></div><Link className="referral-primary-action" href={"/refer/direct" as Route}><Plus size={18} aria-hidden="true" />Refer someone</Link></div>
      {data.summary.outstandingAmount > 0 ? <button className="referral-bank-banner" type="button" onClick={() => setPayoutOpen(true)}><WalletCards aria-hidden="true" /><span><strong>Add or check your bank details</strong><small>Make sure we can pay an approved referral reward.</small></span><ChevronRight aria-hidden="true" /></button> : null}
      <div className="referral-dashboard-summary">
        <div><span>Commission earned</span><strong>{money(data.summary.earnedAmount)}</strong><small>Completed, authoritative rewards only</small></div>
        <div><span>Referral link</span><CopyReferralLink value={data.referrer.referralLink} compact /></div>
      </div>
      {data.referrals.length ? <>
        <div className="referral-list-head"><span>Person</span><span>Interest</span><span>Date</span><span>Status</span><span>Reward</span></div>
        <div className="referral-dashboard-list">{data.referrals.map((item) => <ReferralRow key={item.id} item={item} />)}</div>
        {data.pagination.totalPages > 1 ? <nav className="referral-pagination" aria-label="Referral pages"><button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page === 1}><ChevronLeft aria-hidden="true" />Previous</button><span>Page {page} of {data.pagination.totalPages}</span><button type="button" onClick={() => setPage((value) => Math.min(data.pagination.totalPages, value + 1))} disabled={page === data.pagination.totalPages}>Next<ChevronRight aria-hidden="true" /></button></nav> : null}
      </> : <div className="referral-empty"><ImagePlaceholder /><h2>No referrals yet</h2><p>Know someone buying or selling property? Introduce them to Beryl.</p><Link className="referral-primary-action" href={"/refer/direct" as Route}>Refer someone</Link></div>}
      <button className="referral-payment-link" type="button" onClick={() => setPayoutOpen(true)}>View payment details</button>
    </section>
    {payoutOpen ? <PayoutDialog onClose={() => setPayoutOpen(false)} /> : null}
  </main>;
}

function ImagePlaceholder() { return <div className="referral-empty-art" aria-hidden="true"><WalletCards /></div>; }
