"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthApiError } from "../../lib/auth-api";
import { fetchPurchasedProperties, type PurchasedPropertiesPage } from "../../lib/properties-api";
import { BrandLoader } from "../auth/brand-loader";
import { showAuthError } from "../auth/toast-provider";

function PropertiesTable({ data, changePage }: { data: PurchasedPropertiesPage; changePage: (page: number) => void }) {
  const start = data.total === 0 ? 1 : (data.page - 1) * data.pageSize + 1;
  const end = Math.min(data.page * data.pageSize, data.total);
  return <>
    <p className="properties-count">Displaying {start}-{end} of {data.total} Properties</p>
    <div className="properties-table-scroll">
      <table className="properties-table">
        <thead><tr>{["Property", "State", "Type", "Subtype", "Price", "Status", "Closed At"].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead>
        <tbody>{data.items.length === 0 ? <tr><td className="properties-empty" colSpan={7}>No purchases made yet.</td></tr> : data.items.map(property => <tr key={property.id}>
          <td><strong>{property.propertyTitle}</strong><span>{property.propertyCode}</span></td><td>{property.state}</td><td>{property.type}</td><td>{property.subtype}</td><td>{property.price}</td><td>{property.status}</td><td>{property.closedAt}</td>
        </tr>)}</tbody>
      </table>
    </div>
    <nav className="properties-pagination" aria-label="Purchased properties pages">
      <button type="button" aria-label="Previous page" disabled={data.page <= 1} onClick={() => changePage(data.page - 1)}>‹</button>
      <span aria-current="page">{data.page}</span>
      <button type="button" aria-label="Next page" disabled={data.totalPages === 0 || data.page >= data.totalPages} onClick={() => changePage(data.page + 1)}>›</button>
    </nav>
  </>;
}

function PropertiesResults({ q, page, attempt, changePage }: { q: string; page: number; attempt: number; changePage: (page: number) => void }) {
  const router = useRouter();
  const [data, setData] = useState<PurchasedPropertiesPage | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void fetchPurchasedProperties(q, page, controller.signal).then(result => { if (!controller.signal.aborted) setData(result); }).catch(error => {
      if (controller.signal.aborted) return;
      if (error instanceof AuthApiError && error.status === 401) router.replace("/login");
      else { setFailed(true); showAuthError(error, "properties-fetch-error"); }
    });
    return () => controller.abort();
  }, [attempt, page, q, router]);
  if (!data) return failed ? null : <BrandLoader />;
  return <PropertiesTable data={data} changePage={changePage} />;
}

export function PropertiesScreen() {
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [attempt, setAttempt] = useState(0);
  const submit = () => { setQ(search.trim()); setPage(1); };
  return <section className="properties-page">
    <header className="properties-header"><h1>Purchased Properties</h1><form role="search" onSubmit={event => { event.preventDefault(); submit(); }}>
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="8" cy="8" r="4.5" /><path d="m11.5 11.5 4 4" /></svg>
      <input aria-label="Search by Title, Code, State..." placeholder="Search by Title, Code, State..." maxLength={100} value={search} onChange={event => setSearch(event.target.value)} />
      <button className="dashboard-sr-only" type="submit">Search</button>
    </form></header>
    <div className="properties-rule" />
    <PropertiesResults key={JSON.stringify([q, page, attempt])} q={q} page={page} attempt={attempt} changePage={setPage} />
    <div className="properties-retry"><button className="button button-primary" type="button" onClick={() => setAttempt(value => value + 1)}>Try again</button></div>
  </section>;
}
