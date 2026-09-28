"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import {
  listAdminCustomers,
  type CustomerAccountType,
  type CustomerDirectoryAccountType,
  type CustomerDirectoryPage,
  type CustomerDirectoryProfileType,
  type CustomerDirectorySort,
  type CustomerProfileType,
} from "../lib/admin-customers-api";
import { AdminAppShell } from "./admin-app-shell";

const accountTypes: CustomerDirectoryAccountType[] = ["ALL", "INVESTOR", "PROPERTY_DEVELOPER", "LANDLORD", "REGISTERED_AGENT", "FREELANCE_AGENT"];
const profileTypes: CustomerDirectoryProfileType[] = ["ALL", "PERSONAL", "BUSINESS"];
const directorySorts: CustomerDirectorySort[] = ["NEWEST", "OLDEST", "NAME_ASC", "NAME_DESC"];
const accountLabels: Record<CustomerAccountType, string> = {
  INVESTOR: "Investor",
  PROPERTY_DEVELOPER: "Property Developer",
  LANDLORD: "Landlord",
  REGISTERED_AGENT: "Registered Agent",
  FREELANCE_AGENT: "Freelance Agent",
};

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "—";
}

function joinedDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

function accountLabel(value: CustomerAccountType | null) {
  return value ? accountLabels[value] : "—";
}

function profileLabel(value: CustomerProfileType | null) {
  return value ? value[0] + value.slice(1).toLowerCase() : "—";
}

function SummaryIcon({ kind }: { kind: "total" | "property" | "listing" | "referral" }) {
  const paths = {
    total: <><circle cx="9" cy="9" r="3"/><circle cx="17" cy="8" r="2"/><path d="M3 20c0-4 2.5-6 6-6s6 2 6 6M15 14c3 0 5 2 5 5"/></>,
    property: <><circle cx="12" cy="7" r="3"/><path d="M5 21c0-5 2.8-8 7-8s7 3 7 8"/></>,
    listing: <><path d="m3 11 9-7 9 7"/><path d="M5 10v10h14V10M9 20v-6h6v6"/></>,
    referral: <><rect x="4" y="7" width="16" height="12" rx="2"/><path d="M8 7V5h8v2M4 12h16"/></>,
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24">{paths[kind]}</svg>;
}

function ActivityChips({ property, listing, referral }: { property: boolean; listing: boolean; referral: boolean }) {
  const activities = [property && "Property", listing && "Listing", referral && "Referral"].filter((value): value is string => Boolean(value));
  if (!activities.length) return <span className="admin-empty-value">—</span>;
  return <div className="customer-activity-list" aria-label={activities.map((value) => `${value} Activity`).join(", ")}>
    {activities.map((activity) => <span className={`customer-activity customer-activity--${activity.toLowerCase()}`} key={activity}>{activity}</span>)}
  </div>;
}

function DirectoryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const search = searchParams.get("search")?.slice(0, 100) ?? "";
  const requestedAccountType = searchParams.get("accountType")?.toUpperCase() as CustomerDirectoryAccountType | null;
  const requestedProfileType = searchParams.get("profileType")?.toUpperCase() as CustomerDirectoryProfileType | null;
  const requestedSort = searchParams.get("sort")?.toUpperCase() as CustomerDirectorySort | null;
  const accountType = requestedAccountType && accountTypes.includes(requestedAccountType) ? requestedAccountType : "ALL";
  const profileType = requestedProfileType && profileTypes.includes(requestedProfileType) ? requestedProfileType : "ALL";
  const sort = requestedSort && directorySorts.includes(requestedSort) ? requestedSort : "NEWEST";
  const requestedPage = Number(searchParams.get("page") ?? "1");
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const [data, setData] = useState<CustomerDirectoryPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) {
        setLoading(true);
        setError("");
      }
    });
    listAdminCustomers({ search, accountType, profileType, sort, page }, controller.signal)
      .then(setData)
      .catch((reason) => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Customers could not be loaded.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [accountType, page, profileType, search, sort]);

  function updateQuery(updates: Record<string, string | number | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === "" || (key === "page" && value === 1) || ((key === "accountType" || key === "profileType") && value === "ALL") || (key === "sort" && value === "NEWEST")) params.delete(key);
      else params.set(key, String(value));
    }
    const query = params.toString();
    router.replace(query ? `/dashboard/users?${query}` : "/dashboard/users");
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    updateQuery({ search: String(form.get("search") ?? "").trim(), page: 1 });
  }

  const summary = data?.summary;
  const first = data && data.total ? (data.page - 1) * data.pageSize + 1 : 0;
  const last = data ? Math.min(data.page * data.pageSize, data.total) : 0;
  const hasCustomers = (data?.summary.totalUsers ?? 0) > 0;

  return <main className="admin-users-page">
    <header className="admin-page-heading"><h1>Users</h1><p>Customer directory. View only — no changes can be made here.</p></header>
    {hasCustomers && <><section className="customer-summary" aria-label="Customer activity summary">
      {[
        ["total", "Total Users", summary?.totalUsers ?? 0],
        ["property", "Property Activity", summary?.propertyActivityCustomers ?? 0],
        ["listing", "Listing Activity", summary?.listingActivityCustomers ?? 0],
        ["referral", "Referral Activity", summary?.referralActivityCustomers ?? 0],
      ].map(([kind, label, value]) => <article key={label}><SummaryIcon kind={kind as "total" | "property" | "listing" | "referral"}/><span>{label}</span><strong>{Number(value).toLocaleString()}</strong></article>)}
    </section>

    <section className="customer-directory-controls">
      <div className="customer-search-sort">
        <form onSubmit={submitSearch} role="search">
          <svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/></svg>
          <input aria-label="Search customers" defaultValue={search} key={search} name="search" placeholder="Search name, email or phone"/>
          <button type="submit">Search</button>
        </form>
        <label><span>Sort by</span><select aria-label="Sort customers" value={sort} onChange={(event) => updateQuery({ sort: event.target.value, page: 1 })}><option value="NEWEST">Newest joined</option><option value="OLDEST">Oldest joined</option><option value="NAME_ASC">Name A–Z</option><option value="NAME_DESC">Name Z–A</option></select></label>
      </div>
      <div className="customer-classification-filters">
        <label><span>Account Type</span><select aria-label="Filter by account type" value={accountType} onChange={(event) => updateQuery({ accountType: event.target.value, page: 1 })}><option value="ALL">All account types</option>{accountTypes.slice(1).map((value) => <option key={value} value={value}>{accountLabel(value as CustomerAccountType)}</option>)}</select></label>
        <label><span>Profile Type</span><select aria-label="Filter by profile type" value={profileType} onChange={(event) => updateQuery({ profileType: event.target.value, page: 1 })}><option value="ALL">All profile types</option><option value="PERSONAL">Personal</option><option value="BUSINESS">Business</option></select></label>
      </div>
    </section></>}

    {error && <p className="admin-data-error" role="alert">{error}</p>}
    {loading && !data ? <div className="admin-directory-loading" role="status">Loading customers…</div> : data?.summary.totalUsers === 0 ? <div className="customer-empty-state"><span aria-hidden="true">▱</span><h2>No customers yet</h2><p>Registered customers will appear here.</p></div> : data?.items.length === 0 ? <div className="customer-empty-state"><span aria-hidden="true">⌕</span><h2>No matching customers</h2><p>Try another search or classification filter.</p></div> : data && <section className="customer-table-card" aria-busy={loading}>
      <div className="customer-table-scroll"><table><thead><tr><th>Full Name</th><th>Account Type</th><th>Profile Type</th><th>Activity</th><th>Contact</th><th>Status</th><th>Actions</th></tr></thead><tbody>{data.items.map((customer) => <tr key={customer.id}><td><div className="customer-name-cell"><span className="customer-initials">{initials(customer.fullName)}</span><span><strong>{customer.fullName}</strong><small>Joined {joinedDate(customer.joinedAt)}</small></span></div></td><td>{accountLabel(customer.accountType)}</td><td>{profileLabel(customer.profileType)}</td><td><ActivityChips property={customer.hasPropertyActivity} listing={customer.hasListingActivity} referral={customer.hasReferralActivity}/></td><td><div className="customer-contact"><strong>{customer.email}</strong><span>{customer.phone ?? "—"}</span></div></td><td><span className={`customer-verification ${customer.kycStatus === "APPROVED" ? "is-verified" : "is-unverified"}`} title={`KYC: ${customer.kycStatus.replaceAll("_", " ").toLowerCase()}`}>{customer.kycStatus === "APPROVED" ? "Verified" : "Unverified"}</span></td><td><Link aria-label={`View ${customer.fullName}`} className="customer-view-action" href={`/dashboard/users/${customer.id}`} title="View customer">⋮</Link></td></tr>)}</tbody></table></div>
      <footer><span>Showing {first}–{last} of {data.total}</span><nav aria-label="Customer pages"><button disabled={data.page <= 1} onClick={() => updateQuery({ page: data.page - 1 })} type="button">‹ Previous</button><span>Page {data.page} of {Math.max(data.totalPages, 1)}</span><button disabled={data.page >= data.totalPages} onClick={() => updateQuery({ page: data.page + 1 })} type="button">Next ›</button></nav></footer>
    </section>}
  </main>;
}

export function AdminUsersDirectory() {
  return <AdminAppShell><DirectoryContent/></AdminAppShell>;
}
