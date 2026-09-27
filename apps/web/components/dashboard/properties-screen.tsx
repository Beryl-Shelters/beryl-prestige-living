"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthApiError } from "../../lib/auth-api";
import { fetchPurchasedProperties, type PurchasedPropertiesPage } from "../../lib/properties-api";
import { BrandLoader } from "../auth/brand-loader";
import { showAuthError } from "../auth/toast-provider";

const formatPrice = (minor: number) => {
  const exact = BigInt(minor);
  const whole = exact / 100n;
  const fraction = (exact % 100n).toString().padStart(2, "0");
  return `₦${new Intl.NumberFormat("en-NG", { maximumFractionDigits: 0 }).format(whole)}.${fraction}`;
};

const formatClosedAt = (value: string) => new Date(value).toLocaleDateString("en-GB", {
  day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
});

function PropertyPlaceholder({ large = false }: { large?: boolean }) {
  return <span className={`properties-image-placeholder${large ? " properties-image-placeholder-large" : ""}`} aria-hidden="true">
    <svg viewBox="0 0 48 48" fill="none">
      <rect x="7" y="10" width="34" height="28" rx="3" />
      <circle cx="17" cy="20" r="3" />
      <path d="m10 34 9-9 7 7 5-5 7 7" />
    </svg>
  </span>;
}

function SearchForm({ search, setSearch, submit }: {
  search: string;
  setSearch: (value: string) => void;
  submit: () => void;
}) {
  return <form role="search" onSubmit={event => { event.preventDefault(); submit(); }}>
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="8" cy="8" r="4.5" /><path d="m11.5 11.5 4 4" /></svg>
    <input aria-label="Search by Title, Code, State..." placeholder="Search by Title, Code, State..." maxLength={100} value={search} onChange={event => setSearch(event.target.value)} />
    <button className="dashboard-sr-only" type="submit">Search</button>
  </form>;
}

function EmptyProperties() {
  return <section className="properties-zero-state" aria-labelledby="properties-zero-title">
    <PropertyPlaceholder large />
    <h2 id="properties-zero-title">No purchased properties yet</h2>
    <p>Purchased properties will appear here</p>
    <Link className="button button-primary" href="/buy">View Properties for sale</Link>
  </section>;
}

function PropertiesTable({ data, changePage }: { data: PurchasedPropertiesPage; changePage: (page: number) => void }) {
  const start = (data.page - 1) * data.pageSize + 1;
  const end = Math.min(data.page * data.pageSize, data.total);
  return <>
    <p className="properties-count">Showing {start}-{end} of {data.total}</p>
    <div className="properties-table-scroll" tabIndex={0} role="region" aria-label="Purchased properties table">
      <table className="properties-table">
        <thead><tr>{["Property", "State", "Type", "Subtype", "Price", "Status", "Closed At"].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead>
        <tbody>{data.items.map(property => <tr key={`${property.propertyCode}-${property.closedAt}`}>
          <td><div className="properties-property-cell"><PropertyPlaceholder /><span><strong>{property.title}</strong><small>{property.propertyCode}</small></span></div></td>
          <td>{property.state}</td>
          <td>{property.propertyType}</td>
          <td>{property.propertySubtype ?? "—"}</td>
          <td className="properties-price">{formatPrice(property.priceMinor)}</td>
          <td><span className="properties-status">Approved</span></td>
          <td><time dateTime={property.closedAt}>{formatClosedAt(property.closedAt)}</time></td>
        </tr>)}</tbody>
      </table>
    </div>
    <nav className="properties-pagination" aria-label="Purchased properties pages">
      <button type="button" aria-label="Previous page" disabled={data.page <= 1} onClick={() => changePage(data.page - 1)}><span aria-hidden="true">‹</span><b>Previous</b></button>
      <span className="properties-page-number" aria-current="page"><b className="properties-page-desktop">{data.page}</b><b className="properties-page-mobile">Page {data.page} of {data.totalPages}</b></span>
      <button type="button" aria-label="Next page" disabled={data.page >= data.totalPages} onClick={() => changePage(data.page + 1)}><b>Next</b><span aria-hidden="true">›</span></button>
    </nav>
  </>;
}

export function PropertiesScreen() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [attempt, setAttempt] = useState(0);
  const requestKey = `${q}\u0000${page}\u0000${attempt}`;
  const [result, setResult] = useState<{ key: string; data: PurchasedPropertiesPage | null; failed: boolean }>({ key: "", data: null, failed: false });

  useEffect(() => {
    const controller = new AbortController();
    const activeKey = `${q}\u0000${page}\u0000${attempt}`;
    void fetchPurchasedProperties(q, page, controller.signal).then(data => {
      if (!controller.signal.aborted) setResult({ key: activeKey, data, failed: false });
    }).catch(error => {
      if (controller.signal.aborted) return;
      if (error instanceof AuthApiError && error.status === 401) router.replace("/login");
      else {
        setResult({ key: activeKey, data: null, failed: true });
        showAuthError(error, "properties-fetch-error");
      }
    });
    return () => controller.abort();
  }, [attempt, page, q, router]);

  const submit = () => {
    const nextQuery = search.trim();
    setPage(1);
    if (nextQuery === q) setAttempt(value => value + 1);
    else setQ(nextQuery);
  };
  const clearSearch = () => {
    setSearch("");
    setPage(1);
    if (q === "") setAttempt(value => value + 1);
    else setQ("");
  };
  const data = result.key === requestKey ? result.data : null;
  const failed = result.key === requestKey && result.failed;
  const trueEmpty = data?.total === 0 && q === "";

  return <section className="properties-page">
    <header className="properties-header">
      <h1>Purchased Properties</h1>
      {!trueEmpty && <SearchForm search={search} setSearch={setSearch} submit={submit} />}
    </header>
    <div className="properties-rule" />
    {!data && !failed && <div className="properties-loading"><BrandLoader /></div>}
    {failed && <section className="properties-request-state" role="alert"><h2>Unable to load purchased properties</h2><p>Please try again.</p><button className="button button-primary" type="button" onClick={() => setAttempt(value => value + 1)}>Try again</button></section>}
    {trueEmpty && <EmptyProperties />}
    {data?.total === 0 && q !== "" && <section className="properties-request-state properties-no-results"><h2>No purchased properties matched your search</h2><p>Try another title, property code or state.</p><button className="button button-outline" type="button" onClick={clearSearch}>Clear search</button></section>}
    {data && data.total > 0 && <PropertiesTable data={data} changePage={setPage} />}
  </section>;
}
