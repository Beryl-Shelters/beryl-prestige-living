"use client";

import { ArrowLeft, BadgeCheck, Building2, Clock3, Mail, MapPin, Phone, UserRound } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { AdminLeadDetail, ApiEnvelope, LeadStage } from "@/lib/contracts";
import { adminPropertyFromLeadPath } from "@/lib/admin-routes";

const display = (value?: string | null) => value?.replaceAll("_", " ").toLowerCase().replace(/(^|\s)\S/g, (letter) => letter.toUpperCase()) || "Not available";
const dateTime = (value: string) => new Intl.DateTimeFormat("en-NG", { dateStyle: "long", timeStyle: "short" }).format(new Date(value));
const money = (value: number) => new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(value);

export function AdminLeadDetailScreen({ leadId }: { leadId: string }) {
  const [lead, setLead] = useState<AdminLeadDetail | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<LeadStage | null>(null);
  const [confirmingWon, setConfirmingWon] = useState(false);
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch(`/api/admin/leads/${encodeURIComponent(leadId)}`, { cache: "no-store" });
      const payload = await response.json() as ApiEnvelope<{ lead: AdminLeadDetail }>;
      if (!response.ok || !payload.data?.lead) throw new Error(payload.message || "Lead could not be loaded.");
      setLead(payload.data.lead);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Lead could not be loaded."); }
    finally { setLoading(false); }
  }, [leadId]);
  useEffect(() => { const task = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(task); }, [load]);
  useEffect(() => {
    if (!confirmingWon) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape" && !updating) setConfirmingWon(false); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [confirmingWon, updating]);
  const transition = async (stage: LeadStage) => {
    if (!lead || updating) return false;
    setUpdating(stage); setError("");
    try {
      const response = await fetch(`/api/admin/leads/${encodeURIComponent(lead.id)}/stage`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ stage, expectedStage: lead.stage }) });
      const payload = await response.json() as ApiEnvelope<{ stage: LeadStage }>;
      if (!response.ok || !payload.data) throw new Error(payload.message || "Lead stage could not be updated.");
      await load();
      return true;
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Lead stage could not be updated."); return false; }
    finally { setUpdating(null); }
  };

  if (loading) return <section className="lead-detail"><div className="detail-heading skeleton" /><div className="lead-detail-grid"><div className="detail-panel skeleton-card" /><div className="detail-panel skeleton-card" /></div></section>;
  if (error && !lead) return <section className="lead-detail"><Link href={"/dashboard/leads" as never} className="back-link"><ArrowLeft size={16} />Back to leads</Link><div className="lead-state alert alert-error" role="alert"><span>{error}</span><button type="button" onClick={() => void load()}>Try again</button></div></section>;
  if (!lead) return null;
  return <article className="lead-detail">
    <Link href={"/dashboard/leads" as never} className="back-link"><ArrowLeft size={16} />Back to leads</Link>
    <header className="lead-detail-header"><div><p className="eyebrow">Lead detail</p><h1>Enquiry {lead.referenceId}</h1><p><Clock3 size={15} aria-hidden />Received {dateTime(lead.receivedAt)}</p></div><span className={`lead-stage-badge stage-${lead.stage.toLowerCase()}`}>{display(lead.stage)}</span></header>
    {error ? <div className="alert alert-error" role="alert">{error}</div> : null}
    <div className="lead-detail-grid">
      <div className="lead-detail-main">
        <section className="detail-panel"><h2>Customer</h2><div className="customer-heading"><span className="customer-avatar"><UserRound aria-hidden /></span><div><strong>{lead.customer.fullName}</strong><div className="persona-badges">{lead.customer.personas.length ? lead.customer.personas.map((persona) => <span key={persona.type}>{display(persona.type)}</span>) : <span>Customer</span>}{lead.customer.emailVerified ? <span className="verified-badge"><BadgeCheck size={13} />Verified</span> : null}</div></div></div><dl className="contact-list"><div><dt><Mail size={16} />Email</dt><dd>{lead.customer.email || "Not available"}</dd></div><div><dt><Phone size={16} />Phone</dt><dd>{lead.customer.phone || "Not available"}</dd></div><div><dt>Preferred contact</dt><dd>{display(lead.customer.preferredContactMethod)}</dd></div>{lead.source === "REFERRAL" ? <div><dt>Source</dt><dd><span className="lead-source-badge">Referral</span></dd></div> : null}{lead.referredBy ? <div><dt>Referred by</dt><dd>{lead.referredBy.fullName}</dd></div> : null}</dl></section>
        <section className="detail-panel"><h2>Message</h2>{lead.message ? <p className="lead-message">{lead.message}</p> : <p className="detail-empty">The customer did not include a message.</p>}</section>
        <section className="detail-panel"><h2>Property interested in</h2>{lead.property ? <div className="lead-property"><div className="lead-property-image" role="img" aria-label={lead.property.title} style={lead.property.coverImage ? { backgroundImage: `url(${lead.property.coverImage.url})` } : undefined}><Building2 aria-hidden /></div><div><span className="lead-card-reference">{lead.property.referenceId}</span><h3>{lead.property.title}</h3><p><MapPin size={15} />{lead.property.publicLocation}</p><strong>{money(lead.property.askingPrice)}</strong><div className="property-tags"><span>{display(lead.property.propertyCategory)}</span><span>{display(lead.property.propertyType)}</span><span>{display(lead.property.marketplaceStatus)}</span>{lead.property.mandateType ? <span>{display(lead.property.mandateType)} mandate</span> : null}</div>{lead.property.initialDepositValue !== null ? <p>Initial deposit: {lead.property.initialDepositType === "PERCENTAGE" ? `${lead.property.initialDepositValue}%` : money(lead.property.initialDepositValue)}</p> : null}{lead.property.seller ? <p>Seller: {lead.property.seller.companyName || lead.property.seller.fullName || "Not available"}</p> : null}<Link className="property-detail-link" href={adminPropertyFromLeadPath(lead.property.id, lead.id) as never}>View property</Link></div></div> : <p className="detail-empty">This enquiry is not linked to a property.</p>}</section>
      </div>
      <aside className="detail-panel stage-panel">
        {confirmingWon ? <section className="lead-won-confirmation" role="dialog" aria-labelledby="won-confirmation-title"><h2 id="won-confirmation-title">Move this enquiry to a Won Lead?</h2><p>Confirm that this enquiry has successfully converted.</p><dl><div><dt>Customer</dt><dd>{lead.customer.fullName}</dd></div><div><dt>Enquiry</dt><dd>{lead.referenceId}</dd></div><div><dt>Property</dt><dd>{lead.property?.title || "General property enquiry"}</dd></div><div><dt>Message</dt><dd>{lead.message || "No message provided"}</dd></div></dl>{error ? <div className="alert alert-error" role="alert">{error}</div> : null}<footer><button type="button" disabled={Boolean(updating)} onClick={() => setConfirmingWon(false)}>Cancel</button><button type="button" disabled={Boolean(updating)} onClick={async () => { if (await transition("WON")) setConfirmingWon(false); }}>{updating === "WON" ? "Confirming…" : "Confirm"}</button></footer></section> : <><h2>Current stage</h2><span className={`lead-stage-badge stage-${lead.stage.toLowerCase()}`}>{display(lead.stage)}</span><p>Update this enquiry as your team follows up with the customer.</p>{lead.stage === "NEW" ? <button className="button button-primary" type="button" disabled={Boolean(updating)} onClick={() => void transition("CONTACTED")}>{updating === "CONTACTED" ? "Updating…" : "Mark as contacted"}</button> : null}{lead.stage === "CONTACTED" ? <><button className="button lead-won-button" type="button" disabled={Boolean(updating)} onClick={() => setConfirmingWon(true)}>Mark as won</button><button className="button lead-lost-button" type="button" disabled={Boolean(updating)} onClick={() => void transition("LOST")}>{updating === "LOST" ? "Updating…" : "Mark as lost"}</button></> : null}{lead.stage === "WON" || lead.stage === "LOST" ? <p className="detail-empty">This lead has reached a final stage.</p> : null}<div className="lead-history"><h3>Stage history</h3>{lead.history.length ? lead.history.map((item) => <div key={item.id}><strong>{display(item.previousStage)} → {display(item.newStage)}</strong><time dateTime={item.createdAt}>{dateTime(item.createdAt)}</time></div>) : <p>No stage changes yet.</p>}</div></>}
      </aside>
    </div>
  </article>;
}
