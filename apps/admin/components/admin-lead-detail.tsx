"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { getAdminLead, moveAdminLead, type LeadDetail, type LeadStage } from "../lib/admin-leads-api";
import { AdminAppShell } from "./admin-app-shell";

const labels: Record<LeadStage, string> = { NEW: "New", CONTACTED: "Contacted", WON: "Won", LOST: "Lost" };
const sourceLabels = { REAL_ESTATE_INQUIRY: "Real Estate Inquiry", BUY_ASSISTANCE: "Buy Assistance", PROPERTY_VIEWING: "Property Viewing" } as const;

function date(value: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}
function money(value: number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(value / 100);
}
function initials(value: string) {
  return value.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join("") || "?";
}

function Confirmation({ lead, stage, close, confirm, pending }: { lead: LeadDetail; stage: Exclude<LeadStage, "NEW">; close: () => void; confirm: () => void; pending: boolean }) {
  const dialog = useRef<HTMLDivElement>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    cancelButton.current?.focus();
    const keys = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pending) close();
      if (event.key === "Tab" && dialog.current) {
        const controls = [...dialog.current.querySelectorAll<HTMLElement>("button:not(:disabled)")];
        const first = controls[0], last = controls.at(-1);
        if (!first || !last) return;
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", keys);
    return () => { document.removeEventListener("keydown", keys); document.body.style.overflow = overflow; previous?.focus(); };
  }, [close, pending]);
  const property = lead.property?.title ?? (lead.request.propertyType ? `${lead.request.propertyType} ${lead.request.propertySubtype ?? "property"}` : "No specific property recorded");
  return <div className="lead-confirm-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !pending) close(); }} role="presentation">
    <div aria-labelledby="lead-confirm-title" aria-modal="true" className={`lead-confirm lead-confirm--${stage.toLowerCase()}`} ref={dialog} role="dialog">
      <h2 id="lead-confirm-title">Move this enquiry to a <strong>{labels[stage]} Lead?</strong></h2>
      <div className="lead-confirm-summary"><strong>{lead.requester.name}</strong><span>{lead.publicId} · {property}</span></div>
      {lead.message && <blockquote><small>Message</small>{lead.message}</blockquote>}
      {stage === "WON" && <p className="lead-outcome-warning">Won records only a CRM enquiry outcome. It does not create a purchase, payment, commission, ownership transfer, or listing-status change.</p>}
      {stage === "LOST" && <p className="lead-outcome-warning">Lost is a terminal CRM stage and cannot be reversed in the current workflow.</p>}
      <div><button className="lead-confirm-action" disabled={pending} onClick={confirm}>{pending ? "Saving…" : "Confirm"}</button><button disabled={pending} onClick={close} ref={cancelButton}>Cancel</button></div>
    </div>
  </div>;
}

function StagePanel({ lead, changed }: { lead: LeadDetail; changed: (lead: LeadDetail) => void }) {
  const [target, setTarget] = useState<Exclude<LeadStage, "NEW"> | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const choices: Exclude<LeadStage, "NEW">[] = lead.stage === "NEW" ? ["CONTACTED", "WON", "LOST"] : lead.stage === "CONTACTED" ? ["WON", "LOST"] : [];
  async function confirm() {
    if (!target || pending) return;
    setPending(true); setError("");
    try { changed(await moveAdminLead(lead.publicId, target, lead.version)); setTarget(null); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "The lead could not be moved."); }
    finally { setPending(false); }
  }
  return <aside className={`lead-stage-panel lead-stage-panel--${lead.stage.toLowerCase()}`}>
    <small>Current Stage</small><h2><span/> {labels[lead.stage]}</h2>
    {choices.length ? <><p>Move this lead to</p>{choices.map(stage => <button className={`lead-stage-choice lead-stage-choice--${stage.toLowerCase()}`} key={stage} onClick={() => setTarget(stage)}><span/> {labels[stage]}</button>)}</> : <p>This is a final CRM stage. No further transitions are available.</p>}
    {error && <p className="admin-data-error" role="alert">{error}</p>}
    {target && <Confirmation close={() => setTarget(null)} confirm={() => void confirm()} lead={lead} pending={pending} stage={target}/>} 
  </aside>;
}

function RequestDetails({ lead }: { lead: LeadDetail }) {
  const request = lead.request;
  const rows: [string, ReactNode][] = [];
  if (request.inquiryType) rows.push(["Inquiry Type", request.inquiryType]);
  if (request.sourcePage) rows.push(["Submitted From", request.sourcePage]);
  if (request.propertyType) rows.push(["Property Type", [request.propertyType, request.propertySubtype].filter(Boolean).join(" · ")]);
  if (request.bedrooms) rows.push(["Bedrooms", request.bedrooms]);
  if (request.bathrooms) rows.push(["Bathrooms", request.bathrooms]);
  const location = [request.locality, request.city, request.state].filter(Boolean).join(", ");
  if (location) rows.push(["Preferred Location", location]);
  if (request.budgetMinor !== undefined) rows.push(["Budget", money(request.budgetMinor)]);
  if (request.paymentIntent) rows.push(["Payment Intent", request.paymentIntent]);
  if (request.timing) rows.push(["Timing", request.timing]);
  if (request.facilities?.length) rows.push(["Conveniences", request.facilities.join(", ")]);
  if (request.additionalPreferences) rows.push(["Additional Preferences", request.additionalPreferences]);
  if (request.flexibleDates) rows.push(["Viewing Schedule", "Flexible dates"]);
  else if (request.preferredDate || request.preferredTime) rows.push(["Viewing Schedule", [request.preferredDate, request.preferredTime].filter(Boolean).join(" at ")]);
  return <section className="lead-detail-card"><header><span aria-hidden="true">◎</span><h2>Enquiry Details</h2></header><dl className="lead-request-grid"><div><dt>Source</dt><dd>{sourceLabels[lead.sourceType]}</dd></div>{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></section>;
}

function DetailContent({ leadId }: { leadId: string }) {
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    getAdminLead(leadId, controller.signal).then(setLead).catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Lead could not be loaded."); });
    return () => controller.abort();
  }, [leadId]);
  if (error) return <main className="admin-lead-detail"><Link className="admin-back-link" href="/dashboard/leads">‹ Back to leads</Link><p className="admin-data-error" role="alert">{error}</p></main>;
  if (!lead) return <main className="admin-directory-loading" role="status">Loading lead…</main>;
  const depositPercent = lead.property?.priceMinor ? Math.round(lead.property.minimumDownPaymentMinor / lead.property.priceMinor * 100) : 0;
  return <main className="admin-lead-detail">
    <Link className="admin-back-link" href="/dashboard/leads">‹ Back to leads</Link>
    <header className="lead-detail-heading"><div><h1>Enquiry {lead.publicId}</h1><span className={`lead-stage-badge lead-stage-badge--${lead.stage.toLowerCase()}`}>{labels[lead.stage]}</span></div><p>Received {date(lead.receivedAt)}</p></header>
    <div className="lead-detail-layout"><div className="lead-detail-main">
      <section className="lead-detail-card"><header><span aria-hidden="true">●</span><h2>Customer / Requester</h2></header><div className="lead-requester">
        <div className="lead-requester-name"><span>{initials(lead.requester.name)}</span><div><h3>{lead.requester.name}</h3><small>Anonymous enquiry · account not linked</small></div></div>
        {lead.message && <blockquote><small>Message</small>{lead.message}</blockquote>}
        <dl><div><dt>Email</dt><dd>{lead.requester.email ?? "Not provided"}</dd></div><div><dt>Phone</dt><dd>{lead.requester.phone ?? "Not provided"}</dd></div><div><dt>Preferred Contact</dt><dd>{lead.requester.preferredContact ?? "Not specified"}</dd></div><div><dt>KYC Verification</dt><dd>Not available — no linked account</dd></div></dl>
      </div></section>
      <RequestDetails lead={lead}/>
      {lead.property && <section className="lead-detail-card"><header><span aria-hidden="true">⌂</span><h2>Property Interested In</h2></header><div className="lead-property-summary">
        {lead.property.imageUrl ? <Image alt="" height={92} src={lead.property.imageUrl} unoptimized width={112}/> : <span className="lead-property-placeholder" aria-hidden="true">⌂</span>}
        <div><strong>{lead.property.title}</strong><small>{lead.property.code} · {lead.property.city}, {lead.property.state}</small><b>{money(lead.property.priceMinor)}</b></div>
        <Link href={`/dashboard/properties/${encodeURIComponent(lead.property.code)}`}>View Property</Link>
      </div><dl className="lead-property-grid"><div><dt>Category</dt><dd>{lead.property.propertyType} · {lead.property.propertySubtype}</dd></div><div><dt>Current Listing State</dt><dd>{lead.property.status}</dd></div><div><dt>Seller</dt><dd>{lead.property.seller.name}</dd></div><div><dt>Initial Deposit</dt><dd>{money(lead.property.minimumDownPaymentMinor)} · {depositPercent}%</dd></div></dl></section>}
      {lead.history.length > 0 && <section className="lead-detail-card"><header><span aria-hidden="true">↻</span><h2>Stage History</h2></header><ol className="lead-history">{lead.history.map(item => <li key={item.id}><strong>{labels[item.fromStage]} → {labels[item.toStage]}</strong><span>{item.admin.name} · {date(item.changedAt)}</span></li>)}</ol></section>}
    </div><StagePanel changed={setLead} lead={lead}/></div>
  </main>;
}

export function AdminLeadDetail({ leadId }: { leadId: string }) {
  return <AdminAppShell><DetailContent leadId={leadId}/></AdminAppShell>;
}
