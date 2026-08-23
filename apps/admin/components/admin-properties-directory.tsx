"use client";

import { Building2, ChevronLeft, ChevronRight, Filter, MoreVertical, Search, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import type { AdminPropertyDirectory, ApiEnvelope } from "@/lib/contracts";
import { formatPropertyDate, humanizePropertyValue, propertySortOptions, propertyStatus, propertyTabs } from "@/lib/admin-property-display";

export function AdminPropertiesDirectory() {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  const [category, setCategory] = useState("");
  const [mandate, setMandate] = useState("");
  const [sort, setSort] = useState("OPERATIONAL");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AdminPropertyDirectory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams({ page: String(page), limit: "6", status, sort });
      if (query) params.set("q", query);
      if (category) params.set("category", category);
      if (mandate) params.set("mandate", mandate);
      const response = await fetch(`/api/admin/marketplace/properties?${params}`, { cache: "no-store" });
      const payload = await response.json() as ApiEnvelope<AdminPropertyDirectory>;
      if (!response.ok || !payload.data) throw new Error(payload.message || "Properties could not be loaded.");
      setData(payload.data);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Properties could not be loaded."); }
    finally { setLoading(false); }
  }, [category, mandate, page, query, sort, status]);

  useEffect(() => { const task = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(task); }, [load]);
  const submit = (event: FormEvent) => { event.preventDefault(); setPage(1); setQuery(search.trim()); };
  const total = data?.pagination.total ?? 0;
  const first = total ? (page - 1) * (data?.pagination.limit ?? 6) + 1 : 0;
  const last = Math.min(total, page * (data?.pagination.limit ?? 6));

  return <section className="admin-properties" aria-labelledby="properties-title">
    <header className="properties-header"><h1 id="properties-title">Properties</h1><p>Review submissions and control what goes live on the marketplace.</p></header>
    <div className="properties-toolbar">
      <form role="search" className="properties-search" onSubmit={submit}><Search size={17} aria-hidden /><label className="sr-only" htmlFor="property-search">Search by title, id, seller or location</label><input id="property-search" value={search} maxLength={120} onChange={(event) => setSearch(event.target.value)} placeholder="Search by title, id, seller or location" /><button type="submit">Search</button></form>
      <details className="properties-filter"><summary><Filter size={15} />Filter by</summary><div><label>Category<select value={category} onChange={(event) => { setCategory(event.target.value); setPage(1); }}><option value="">All categories</option><option value="RESIDENTIAL">Residential</option><option value="COMMERCIAL">Commercial</option></select></label><label>Mandate<select value={mandate} onChange={(event) => { setMandate(event.target.value); setPage(1); }}><option value="">All mandates</option><option value="EXCLUSIVE">Exclusive</option><option value="OPEN">Open</option></select></label></div></details>
      <label className="properties-sort"><SlidersHorizontal size={14} /><span>Sort by</span><select value={sort} onChange={(event) => { setSort(event.target.value); setPage(1); }}>{propertySortOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    </div>
    <div className="property-status-tabs" role="tablist" aria-label="Property status">
      {propertyTabs.map(([value, label, countKey]) => <button role="tab" aria-selected={status === value} type="button" key={value} onClick={() => { setStatus(value); setPage(1); }}>{label}<span>{data?.counts[countKey] ?? 0}</span></button>)}
    </div>
    {error ? <div className="properties-state alert alert-error" role="alert"><span>{error}</span><button type="button" onClick={() => void load()}>Try again</button></div> : null}
    <div className="properties-table-card"><div className="properties-table-scroll"><table className="properties-table"><thead><tr><th>Property</th><th>Category</th><th>Mandate</th><th>Location</th><th>Status</th><th>Actions</th></tr></thead><tbody>
      {loading ? Array.from({ length: 6 }, (_, index) => <tr key={index} aria-label="Loading property"><td colSpan={6}><span className="property-row-skeleton" /></td></tr>) : null}
      {!loading && !error ? data?.items.map((property) => {
        const mappedStatus = propertyStatus[property.status];
        const relevantDate = property.status === "LIVE" ? property.publishedAt : property.status === "REJECTED" ? property.rejectedAt : property.submittedAt;
        return <tr key={property.id}><td><div className="property-name-cell"><span className="property-row-image" style={property.coverImage ? { backgroundImage: `url(${property.coverImage.url})` } : undefined}><Building2 size={16} /></span><div><strong>{property.title || "Untitled property"}</strong><small>{formatPropertyDate(relevantDate)}</small></div></div></td><td><span className="property-category-badge">{humanizePropertyValue(property.propertyCategory)}</span></td><td><span className={`property-mandate-badge ${property.mandateType?.toLowerCase() || "none"}`}>{humanizePropertyValue(property.mandateType)}</span></td><td>{property.publicLocation || "Not available"}</td><td><span className={`property-status status-${mappedStatus.tone}`}>{mappedStatus.label}</span></td><td><Link className="property-row-action" href={`/dashboard/properties/${property.id}` as never} aria-label={`View details for ${property.title || property.referenceId}`} title="View details"><MoreVertical size={17} /></Link></td></tr>;
      }) : null}
    </tbody></table></div>
    {!loading && !error && data?.items.length === 0 ? <div className="properties-empty"><Building2 size={28} /><strong>{query || category || mandate || status !== "ALL" ? "No properties match these filters" : "No properties yet"}</strong><p>Try changing the search, status, or filters.</p></div> : null}
    {!loading && !error && data ? <footer className="properties-pagination"><span>Showing {first}–{last} of {total}</span><div className="page-numbers">{Array.from({ length: data.pagination.total_pages }, (_, index) => index + 1).slice(Math.max(0, page - 3), page + 2).map((number) => <button type="button" key={number} aria-current={number === page ? "page" : undefined} onClick={() => setPage(number)}>{number}</button>)}</div><div><button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}><ChevronLeft size={14} />Previous</button><button type="button" disabled={page >= data.pagination.total_pages} onClick={() => setPage((value) => value + 1)}>Next<ChevronRight size={14} /></button></div></footer> : null}
    </div>
  </section>;
}
