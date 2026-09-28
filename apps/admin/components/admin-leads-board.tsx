"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { listAdminLeads, type LeadDirectoryItem, type LeadDirectoryPage, type LeadStage } from "../lib/admin-leads-api";
import { AdminAppShell } from "./admin-app-shell";

const stages: LeadStage[] = ["NEW", "CONTACTED", "WON", "LOST"];
const labels: Record<LeadStage, string> = { NEW: "New", CONTACTED: "Contacted", WON: "Won", LOST: "Lost" };

function received(value: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function count(data: LeadDirectoryPage, stage: LeadStage) {
  return stage === "NEW" ? data.counts.new : stage === "CONTACTED" ? data.counts.contacted : stage === "WON" ? data.counts.won : data.counts.lost;
}

function LeadCard({ lead }: { lead: LeadDirectoryItem }) {
  return <Link className="lead-card" href={`/dashboard/leads/${encodeURIComponent(lead.publicId)}`}>
    <small>{lead.publicId}</small>
    <strong>{lead.requesterName}</strong>
    <span>{lead.propertyInterest ?? "No specific property recorded"}</span>
    <time dateTime={lead.receivedAt}>{received(lead.receivedAt)}</time>
  </Link>;
}

function LeadsContent() {
  const router = useRouter();
  const params = useSearchParams();
  const search = params.get("search")?.slice(0, 100) ?? "";
  const rawPage = Number(params.get("page") ?? "1");
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const [data, setData] = useState<LeadDirectoryPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => { if (!controller.signal.aborted) { setLoading(true); setError(""); } });
    listAdminLeads({ search, page }, controller.signal).then(setData).catch(reason => {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Leads could not be loaded.");
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [page, search]);

  function update(nextSearch: string, nextPage = 1) {
    const query = new URLSearchParams();
    if (nextSearch) query.set("search", nextSearch);
    if (nextPage > 1) query.set("page", String(nextPage));
    router.replace(query.size ? `/dashboard/leads?${query}` : "/dashboard/leads");
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    update(String(new FormData(event.currentTarget).get("search") ?? "").trim());
  }

  const isDatabaseEmpty = data?.allTotal === 0;
  return <main className="admin-leads-page">
    <header className="admin-page-heading"><h1>Leads</h1><p>Every buyer enquiry, and where it stands.</p></header>
    {error && <p className="admin-data-error" role="alert">{error}</p>}
    {loading && !data ? <div className="admin-directory-loading" role="status">Loading leads…</div> : data && isDatabaseEmpty ?
      <section className="leads-empty-state"><span aria-hidden="true">✉</span><h2>No Enquiries Yet</h2><p>Buyer enquiries will land here as they come in.</p></section> : data && <>
        <section className="leads-toolbar">
          <strong>{data.allTotal} {data.allTotal === 1 ? "Enquiry" : "Enquiries"}</strong>
          <form role="search" onSubmit={submit}><span aria-hidden="true">⌕</span><input aria-label="Search leads" defaultValue={search} key={search} name="search" placeholder="Search customer name, property name, or ID"/><button type="submit">Search</button></form>
        </section>
        {data.total === 0 ? <section className="leads-no-results"><h2>No matching enquiries</h2><p>Try another customer, property or enquiry ID.</p></section> :
          <div className="leads-board-scroll"><section aria-busy={loading} className="leads-board">
            {stages.map(stage => <section className={`lead-column lead-column--${stage.toLowerCase()}`} key={stage}>
              <header><strong>{labels[stage]}</strong><span>{count(data, stage)}</span></header>
              <div>{data.items.filter(item => item.stage === stage).map(item => <LeadCard key={item.publicId} lead={item}/>)}{!data.items.some(item => item.stage === stage) && <p>No {labels[stage].toLowerCase()} enquiries on this page.</p>}</div>
            </section>)}
          </section></div>}
        {data.totalPages > 1 && <nav aria-label="Lead pages" className="leads-pagination"><button disabled={data.page <= 1} onClick={() => update(search, data.page - 1)}>‹ Previous</button><span>Page {data.page} of {data.totalPages}</span><button disabled={data.page >= data.totalPages} onClick={() => update(search, data.page + 1)}>Next ›</button></nav>}
      </>}
  </main>;
}

export function AdminLeadsBoard() {
  return <AdminAppShell><LeadsContent/></AdminAppShell>;
}
