"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { Customer } from "../../lib/auth-api";
import { fetchSavedProperties, removeSavedProperty, type SavedPropertiesApiError } from "../../lib/saved-properties-api";
import type { PublicProperty, PublicPropertyPage } from "../../lib/public-properties-api";
import { formatNaira } from "../../lib/buy-query";
import { PublicHeader } from "../auth/public-header";
import { PublicSiteFooter } from "./public-site-footer";

function SearchIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m16.5 16.5 4 4"/></svg>; }
function TrashIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m3 0-1 14H7L6 7m4 4v6m4-6v6"/></svg>; }
function ShareIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.6-4.5m-7.6 6.9 7.6 4.5"/></svg>; }

function SavedCard({ property, removing, onRemove }: { property: PublicProperty; removing: boolean; onRemove: () => void }) {
  const [shareStatus, setShareStatus] = useState("");
  async function share() {
    const url = `${window.location.origin}/buy?code=${encodeURIComponent(property.code)}`;
    try {
      if (navigator.share) await navigator.share({ title: property.title, url });
      else { await navigator.clipboard.writeText(url); setShareStatus("Property link copied."); }
    } catch (error) {
      if ((error as DOMException).name !== "AbortError") setShareStatus("Could not share this property.");
    }
  }
  return <article className="saved-property-card">
    <div className="saved-property-image">
      {property.images[0] ? <Image src={property.images[0]} alt={`Exterior of ${property.title}`} width={640} height={450} unoptimized/> : <div className="saved-property-placeholder" role="img" aria-label={`No photograph available for ${property.title}`}>Photo unavailable</div>}
      <button type="button" className="saved-card-action saved-remove" aria-label={`Remove ${property.title} from saved properties`} disabled={removing} onClick={onRemove}><TrashIcon/></button>
      <button type="button" className="saved-card-action saved-share" aria-label={`Share ${property.title}`} onClick={() => void share()}><ShareIcon/></button>
    </div>
    <h2>{property.title}</h2>
    <div className="saved-property-facts"><span>▱ {property.bedrooms} {property.bedrooms === 1 ? "Bedroom" : "Bedrooms"}</span><span>♧ {property.bathrooms} {property.bathrooms === 1 ? "Bathroom" : "Bathrooms"}</span><span>▣ {property.parkingSpaces} {property.parkingSpaces === 1 ? "Parking Space" : "Parking Spaces"}</span></div>
    <strong className="saved-property-price">{formatNaira(property.priceMinor)}</strong>
    {shareStatus && <span className="saved-card-status" role="status">{shareStatus}</span>}
  </article>;
}

export function SavedPropertiesPage() {
  const router = useRouter();
  const [customer, setCustomer] = useState<Customer | null | undefined>(undefined);
  const [draft, setDraft] = useState(""); const [query, setQuery] = useState(""); const [page, setPage] = useState(1);
  const [requestState, setRequestState] = useState<{ key: string; result: PublicPropertyPage | null; error: string } | null>(null);
  const [mutationError, setMutationError] = useState(""); const [retry, setRetry] = useState(0); const [removing, setRemoving] = useState<string | null>(null);
  const onSessionChange = useCallback((value: Customer | null) => setCustomer(value), []);
  const requestKey = `${customer?.id ?? "guest"}:${query}:${page}:${retry}`;
  const loading = !!customer && requestState?.key !== requestKey;
  const result = requestState?.key === requestKey ? requestState.result : null;
  const requestError = requestState?.key === requestKey ? requestState.error : "";
  const error = mutationError || requestError;

  useEffect(() => { if (customer === null) router.replace(`/login?next=${encodeURIComponent("/saved-properties")}`); }, [customer, router]);
  useEffect(() => {
    if (!customer) return;
    const controller = new AbortController(); const params = new URLSearchParams({ page: String(page), pageSize: "12" }); if (query) params.set("q", query);
    void fetchSavedProperties(params, controller.signal).then(value => { if (!controller.signal.aborted) setRequestState({ key: requestKey, result: value, error: "" }); })
      .catch((caught: SavedPropertiesApiError) => { if (!controller.signal.aborted) setRequestState({ key: requestKey, result: null, error: caught.message || "Saved properties are temporarily unavailable." }); });
    return () => controller.abort();
  }, [customer, page, query, retry, requestKey]);

  function search(event: FormEvent) { event.preventDefault(); setPage(1); setQuery(draft.trim()); }
  async function remove(property: PublicProperty) {
    if (removing) return; setRemoving(property.code); setMutationError("");
    try {
      await removeSavedProperty(property.code);
      if (result && result.items.length === 1 && page > 1) setPage(value => value - 1); else setRetry(value => value + 1);
    } catch (caught) { setMutationError((caught as SavedPropertiesApiError).message || "Could not remove this saved property."); }
    finally { setRemoving(null); }
  }
  return <div className="saved-properties-page"><PublicHeader sessionAware mobileMenu onSessionChange={onSessionChange}/><main>
    <section className="saved-properties-hero"><h1>My Saved Properties</h1><form className="saved-properties-search" role="search" onSubmit={search}><label htmlFor="saved-property-search">Search your saved properties</label><SearchIcon/><input id="saved-property-search" type="search" maxLength={100} placeholder="Search your saved properties" value={draft} onChange={event => setDraft(event.target.value)}/><button type="submit">Search</button></form></section>
    <section className="saved-properties-content" aria-live="polite">
      {customer === undefined || loading ? <div className="saved-properties-state" role="status">Loading saved properties…</div>
        : error && !result ? <div className="saved-properties-state" role="alert"><strong>{error}</strong><button type="button" onClick={() => setRetry(value => value + 1)}>Try again</button></div>
        : result?.items.length ? <><div className="saved-properties-grid">{result.items.map(property => <SavedCard key={property.code} property={property} removing={removing === property.code} onRemove={() => void remove(property)}/>)}</div>{error && <p className="saved-properties-inline-error" role="alert">{error}</p>}{result.totalPages > 1 && <nav className="saved-properties-pagination" aria-label="Saved properties pages"><button type="button" disabled={page <= 1} onClick={() => setPage(value => value - 1)}>Previous</button><span>Page {result.page} of {result.totalPages}</span><button type="button" disabled={page >= result.totalPages} onClick={() => setPage(value => value + 1)}>Next</button></nav>}</>
        : <div className="saved-properties-state"><strong>{query ? "No saved properties match your search." : "You have no saved properties yet."}</strong>{query && <button type="button" onClick={() => { setDraft(""); setQuery(""); setPage(1); }}>Clear search</button>}</div>}
    </section>
  </main><PublicSiteFooter/></div>;
}
