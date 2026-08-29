"use client";

import { CalendarDays, Home, Inbox, Search } from "lucide-react";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { AdminLeadCard, AdminLeadList, ApiEnvelope, LeadStage } from "@/lib/contracts";

const stages: Array<{ value: LeadStage; label: string }> = [
  { value: "NEW", label: "New" },
  { value: "CONTACTED", label: "Contacted" },
  { value: "WON", label: "Won" },
  { value: "LOST", label: "Lost" }
];

const readableDate = (value: string) => new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

function LeadCard({ lead }: { lead: AdminLeadCard }) {
  return <Link href={`/dashboard/leads/${lead.id}` as never} className="lead-card">
    <span className="lead-card-reference">{lead.referenceId}</span>
    <strong>{lead.customerName}</strong>
    <span><Home size={14} aria-hidden />{lead.propertyTitle || "General property enquiry"}</span>
    {lead.propertyReferenceId ? <small>{lead.propertyReferenceId}</small> : null}
    <time dateTime={lead.receivedAt}><CalendarDays size={14} aria-hidden />{readableDate(lead.receivedAt)}</time>
  </Link>;
}

export function AdminLeadsBoard() {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [data, setData] = useState<AdminLeadList | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams({ limit: "20" });
      if (query.trim()) params.set("q", query.trim());
      const response = await fetch(`/api/admin/leads?${params}`, { cache: "no-store" });
      const payload = await response.json() as ApiEnvelope<AdminLeadList>;
      if (!response.ok || !payload.data) throw new Error(payload.message || "Leads could not be loaded.");
      setData(payload.data);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Leads could not be loaded."); }
    finally { setLoading(false); }
  }, [query]);
  useEffect(() => { const task = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(task); }, [load]);
  const grouped = useMemo(() => Object.fromEntries(stages.map(({ value }) => [value, data?.items.filter((item) => item.stage === value) ?? []])) as Record<LeadStage, AdminLeadCard[]>, [data]);
  const submit = (event: FormEvent) => { event.preventDefault(); setQuery(search.trim()); };
  const total = data?.total ?? 0;

  return <section className="lead-management" aria-labelledby="leads-title">
    <header className="lead-page-header"><div><p className="eyebrow">Lead management</p><h1 id="leads-title">Leads</h1><p>Every buyer enquiry, and where it stands.</p></div></header>
    <div className="lead-toolbar">
      <strong>{loading ? "Loading enquiries…" : `${total} ${total === 1 ? "Enquiry" : "Enquiries"}`}</strong>
      <form role="search" onSubmit={submit} className="lead-search"><Search size={17} aria-hidden /><label className="sr-only" htmlFor="lead-search">Search leads</label><input id="lead-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search customer, property or enquiry ID" maxLength={120} /><button type="submit">Search</button></form>
    </div>
    {error ? <div className="lead-state alert alert-error" role="alert"><span>{error}</span><button type="button" onClick={() => void load()}>Try again</button></div> : null}
    {loading ? <div className="lead-board" aria-label="Loading leads">{stages.map(({ value }) => <div className="lead-column" key={value}><div className="lead-column-heading skeleton" /><div className="lead-card skeleton-card" /><div className="lead-card skeleton-card" /></div>)}</div> : null}
    {!loading && !error && data && total === 0 ? <div className="lead-board-empty">
      <Inbox size={30} aria-hidden />
      <strong>{query ? "No enquiries match this search" : "No Enquiries Yet"}</strong>
      <p>{query ? "Try changing your search." : "Buyer enquiries will land here as they come in."}</p>
    </div> : null}
    {!loading && !error && data && total > 0 ? <div className="lead-board" aria-label="Lead pipeline">
      {stages.map(({ value, label }) => <section className="lead-column" key={value} aria-labelledby={`stage-${value}`}>
        <header className={`lead-column-heading stage-${value.toLowerCase()}`}><h2 id={`stage-${value}`}>{label}</h2><span>{data.counts[value]}</span></header>
        <div className="lead-column-cards">{grouped[value].map((lead) => <LeadCard lead={lead} key={lead.id} />)}{grouped[value].length === 0 ? <p className="lead-empty">{query ? `No ${label.toLowerCase()} leads match this search.` : `No leads in ${label.toLowerCase()} yet.`}</p> : null}</div>
      </section>)}
    </div> : null}
  </section>;
}
