"use client";

import { ChevronLeft, ChevronRight, CircleDollarSign, Search, SlidersHorizontal, UserRound, UsersRound } from "lucide-react";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import type { AdminReferrerDirectory, ApiEnvelope } from "@/lib/contracts";

const money = (value: number) => new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(value);
const cards = [
  ["totalReferrers", "Referrers", UsersRound],
  ["totalReferrals", "Referrals", UserRound],
  ["completedReferrals", "Completed", CircleDollarSign],
  ["outstandingAmount", "Outstanding", CircleDollarSign]
] as const;

export function AdminReferrersDirectory() {
  const [search, setSearch] = useState(""); const [query, setQuery] = useState("");
  const [payment, setPayment] = useState("ALL"); const [sort, setSort] = useState("MOST_RECENT"); const [page, setPage] = useState(1);
  const [data, setData] = useState<AdminReferrerDirectory | null>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const load = useCallback(async () => { setLoading(true); setError(""); try { const params = new URLSearchParams({ payment, sort, page: String(page), limit: "10" }); if (query) params.set("q", query); const response = await fetch(`/api/admin/referrers?${params}`, { cache: "no-store" }); const payload = await response.json() as ApiEnvelope<AdminReferrerDirectory>; if (!response.ok || !payload.data) throw new Error(payload.message || "Referrers could not be loaded."); setData(payload.data); } catch (reason) { setError(reason instanceof Error ? reason.message : "Referrers could not be loaded."); } finally { setLoading(false); } }, [payment, sort, page, query]);
  useEffect(() => { const task = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(task); }, [load]);
  const submit = (event: FormEvent) => { event.preventDefault(); setPage(1); setQuery(search.trim()); };
  const total = data?.pagination.total ?? 0; const first = total ? ((data?.pagination.page ?? 1) - 1) * (data?.pagination.limit ?? 10) + 1 : 0; const last = Math.min(total, (data?.pagination.page ?? 1) * (data?.pagination.limit ?? 10));
  return <section className="admin-referrers" aria-labelledby="referrers-title">
    <header className="referrers-header"><h1 id="referrers-title">Referrers</h1><p>Everyone who has sent Beryl a referral, and what they’re owed.</p></header>
    <div className="referrer-summary-grid" aria-label="Referral totals">{cards.map(([key, label, Icon]) => <article key={key}><Icon size={19} aria-hidden /><span>{label}</span><strong>{loading && !data ? "—" : key === "outstandingAmount" ? money(data?.summary[key] ?? 0) : (data?.summary[key] ?? 0).toLocaleString("en-NG")}</strong></article>)}</div>
    <div className="referrers-toolbar"><form role="search" onSubmit={submit}><Search size={17} aria-hidden /><label className="sr-only" htmlFor="referrer-search">Search name, code, phone or email</label><input id="referrer-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, code, phone or email" maxLength={120} /><button type="submit">Search</button></form><label><SlidersHorizontal size={15} aria-hidden /><span>Sort</span><select value={sort} onChange={(event) => { setSort(event.target.value); setPage(1); }}><option value="MOST_RECENT">Most recent</option><option value="OLDEST">Oldest</option><option value="NAME_ASC">Name A–Z</option><option value="MOST_OWED">Most owed</option><option value="MOST_EARNED">Most earned</option></select></label></div>
    <div className="referrer-tabs" role="group" aria-label="Payment filter">{[["ALL", "All", "all"], ["OWED", "Owed Money", "owed"], ["FULLY_PAID", "Fully Paid", "fullyPaid"]].map(([value, label, count]) => <button type="button" key={value} aria-pressed={payment === value} onClick={() => { setPayment(value); setPage(1); }}>{label}<span>{data?.filterCounts[count as keyof AdminReferrerDirectory["filterCounts"]] ?? 0}</span></button>)}</div>
    {error ? <div className="referrer-state alert alert-error" role="alert"><span>{error}</span><button type="button" onClick={() => void load()}>Try again</button></div> : null}
    <div className="referrers-table-card"><div className="referrers-table-scroll"><table><thead><tr><th>Referrer</th><th>Referrals</th><th>Completed</th><th>Earned</th><th>Outstanding</th><th>Bank Details</th><th>Actions</th></tr></thead><tbody>
      {loading ? Array.from({ length: 6 }, (_, index) => <tr key={index}><td colSpan={7}><span className="referrer-row-skeleton" /></td></tr>) : null}
      {!loading && !error ? data?.items.map((item) => <tr key={item.id}><td><div className="referrer-name"><span aria-hidden>{item.fullName.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</span><div><strong>{item.fullName}</strong><small>{item.phone || item.email || item.referralCode}</small></div></div></td><td>{item.referralCount}</td><td>{item.completedCount}</td><td>{money(item.earnedAmount)}</td><td><strong className={item.outstandingAmount > 0 ? "money-owed" : undefined}>{money(item.outstandingAmount)}</strong></td><td><span className="payout-badge" data-state={item.payoutStatus.toLowerCase()}>{item.payoutStatus === "ON_FILE" ? "On File" : item.payoutStatus === "MISSING" ? "Missing" : "Not Needed"}</span></td><td><Link href={`/dashboard/referrers/${item.id}` as never}>View</Link></td></tr>) : null}
    </tbody></table></div>
    {!loading && !error && data?.items.length === 0 ? <div className="referrers-empty"><UsersRound size={30} aria-hidden /><strong>{query || payment !== "ALL" ? "No referrers match these filters" : "No referrers yet"}</strong><p>{query || payment !== "ALL" ? "Try changing the search or payment filter." : "Registered referrers will appear here."}</p></div> : null}
    {!loading && !error && data && data.pagination.total > 0 ? <footer className="referrers-pagination"><span>Showing {first}–{last} of {total}</span><div><button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}><ChevronLeft size={14} />Previous</button><span>Page {page} of {Math.max(1, data.pagination.totalPages)}</span><button type="button" disabled={page >= data.pagination.totalPages} onClick={() => setPage((value) => value + 1)}>Next<ChevronRight size={14} /></button></div></footer> : null}</div>
  </section>;
}
