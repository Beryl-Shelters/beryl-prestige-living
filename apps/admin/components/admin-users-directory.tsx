"use client";

import { ChevronLeft, ChevronRight, Filter, MoreVertical, Search, SlidersHorizontal, UserRound, UsersRound } from "lucide-react";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import type { AdminCustomerDirectory, AdminCustomerRole, ApiEnvelope } from "@/lib/contracts";
import { customerInitials, formatAdminDate } from "@/lib/admin-user-format";

const roleLabel: Record<AdminCustomerRole, string> = { BUYER: "Buyer", SELLER: "Seller", REFERRER: "Referrer" };
const cards = [
  ["totalUsers", "Total Users", UsersRound],
  ["buyerProfiles", "Buyer Profiles", UserRound],
  ["sellerProfiles", "Seller Profiles", UserRound],
  ["referrerProfiles", "Referrer Profiles", UserRound]
] as const;

export function AdminUsersDirectory() {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("");
  const [verification, setVerification] = useState("");
  const [sort, setSort] = useState("MOST_RECENT");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AdminCustomerDirectory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams({ page: String(page), limit: "6", sort });
      if (query) params.set("q", query);
      if (role) params.set("role", role);
      if (verification) params.set("verification", verification);
      const response = await fetch(`/api/admin/users?${params}`, { cache: "no-store" });
      const payload = await response.json() as ApiEnvelope<AdminCustomerDirectory>;
      if (!response.ok || !payload.data) throw new Error(payload.message || "Users could not be loaded.");
      setData(payload.data);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Users could not be loaded."); }
    finally { setLoading(false); }
  }, [page, query, role, verification, sort]);
  useEffect(() => { const task = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(task); }, [load]);
  const submit = (event: FormEvent) => { event.preventDefault(); setPage(1); setQuery(search.trim()); };
  const total = data?.pagination.total ?? 0;
  const first = total ? (data!.pagination.page - 1) * data!.pagination.limit + 1 : 0;
  const last = Math.min(total, data ? data.pagination.page * data.pagination.limit : 0);

  return <section className="admin-users" aria-labelledby="users-title">
    <header className="users-header"><h1 id="users-title">Users</h1><p>Customer directory. View only — no changes can be made here.</p></header>
    <div className="user-summary-grid" aria-label="Customer profile totals">
      {cards.map(([key, label, Icon]) => <article className="user-summary-card" key={key}><Icon size={18} aria-hidden /><span>{label}</span><strong>{loading && !data ? "—" : (data?.counts[key] ?? 0).toLocaleString("en-NG")}</strong></article>)}
    </div>
    <div className="users-toolbar">
      <form role="search" className="users-search" onSubmit={submit}><Search size={17} aria-hidden /><label className="sr-only" htmlFor="user-search">Search name, email or phone</label><input id="user-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, email or phone" maxLength={120} /><button type="submit">Search</button></form>
      <details className="users-filter"><summary><Filter size={15} aria-hidden />Filter by</summary><div><label>Role/Profile<select value={role} onChange={(event) => { setRole(event.target.value); setPage(1); }}><option value="">All profiles</option><option value="BUYER">Buyer</option><option value="SELLER">Seller</option><option value="REFERRER">Referrer</option></select></label><label>Verification<select value={verification} onChange={(event) => { setVerification(event.target.value); setPage(1); }}><option value="">All statuses</option><option value="VERIFIED">Verified</option><option value="UNVERIFIED">Unverified</option></select></label></div></details>
      <label className="users-sort"><span>Sort by</span><SlidersHorizontal size={14} aria-hidden /><select value={sort} onChange={(event) => { setSort(event.target.value); setPage(1); }}><option value="MOST_RECENT">Most recent</option><option value="OLDEST">Oldest</option><option value="NAME_ASC">Name A–Z</option><option value="NAME_DESC">Name Z–A</option></select></label>
    </div>
    {error ? <div className="users-state alert alert-error" role="alert"><span>{error}</span><button type="button" onClick={() => void load()}>Try again</button></div> : null}
    <div className="users-table-card">
      <div className="users-table-scroll"><table className="users-table"><thead><tr><th>Full name</th><th>Roles</th><th>Contact</th><th>Referral code</th><th>Status</th><th>Actions</th></tr></thead><tbody>
        {loading ? Array.from({ length: 6 }, (_, index) => <tr key={index} aria-label="Loading user"><td colSpan={6}><span className="users-row-skeleton" /></td></tr>) : null}
        {!loading && !error ? data?.items.map((user) => <tr key={user.id}><td><div className="user-name-cell"><span className="customer-avatar" aria-hidden>{customerInitials(user.fullName)}</span><div><strong>{user.fullName}</strong><small>Joined {formatAdminDate(user.joinedAt)}</small></div></div></td><td><div className="user-role-badges">{user.roles.slice(0, 2).map((item) => <span data-role={item.toLowerCase()} key={item}>{roleLabel[item]}</span>)}{user.roles.length > 2 ? <small>+{user.roles.length - 2} more role</small> : null}{user.roles.length === 0 ? <span>—</span> : null}</div></td><td><div className="user-contact-cell"><span>{user.email}</span><small>{user.phone || "—"}</small></div></td><td>{user.referralCode || "—"}</td><td><span className={`user-verification ${user.verified ? "verified" : "unverified"}`}>{user.verified ? "Verified" : "Unverified"}</span></td><td><Link className="user-action" href={`/dashboard/users/${user.id}` as never} aria-label={`View details for ${user.fullName}`} title="View details"><MoreVertical size={17} /></Link></td></tr>) : null}
      </tbody></table></div>
      {!loading && !error && data?.items.length === 0 ? <div className="users-empty"><UsersRound size={26} aria-hidden /><strong>{query || role || verification ? "No users match these filters" : "No customers yet"}</strong><p>{query || role || verification ? "Try changing your search or filters." : "Customer accounts will appear here when available."}</p></div> : null}
      {!loading && !error && data ? <footer className="users-pagination"><span>Showing {first}–{last} of {total}</span><div className="page-numbers">{Array.from({ length: data.pagination.totalPages }, (_, index) => index + 1).slice(Math.max(0, page - 3), page + 2).map((number) => <button type="button" key={number} aria-current={number === page ? "page" : undefined} onClick={() => setPage(number)}>{number}</button>)}</div><div><button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}><ChevronLeft size={14} />Previous</button><button type="button" disabled={page >= data.pagination.totalPages} onClick={() => setPage((value) => value + 1)}>Next<ChevronRight size={14} /></button></div></footer> : null}
    </div>
  </section>;
}
