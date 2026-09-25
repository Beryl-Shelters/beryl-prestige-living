"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { toast } from "react-toastify";
import { PublicHeader } from "../auth/public-header";
import { showAuthError } from "../auth/toast-provider";
import type { Customer } from "../../lib/auth-api";
import { createPublicPropertyReferral } from "../../lib/referrals-api";
import { nigerianStates, propertyFacilities, propertySubtypes } from "../../lib/property-taxonomy";
import { PublicSiteFooter } from "./public-site-footer";
import { apiQueryFromBuyUrl, formatNaira, nairaToKobo } from "../../lib/buy-query";
import { fetchPublicProperties, recordPublicPropertySearch, type PublicProperty, type PublicPropertyPage } from "../../lib/public-properties-api";
import { fetchSavedPropertyStates, saveProperty } from "../../lib/saved-properties-api";

type Draft = { q: string; code: string; propertyType: string; propertySubtype: string; state: string; city: string;
  budget: string; bedrooms: string; bathrooms: string; facility: string };
const editableKeys = ["q", "code", "propertyType", "propertySubtype", "state", "city", "budget", "bedrooms", "bathrooms", "facility"] as const;
function draftFrom(params: URLSearchParams): Draft {
  return { q: params.get("q") ?? "", code: params.get("code") ?? "", propertyType: params.get("propertyType") ?? "",
    propertySubtype: params.get("propertySubtype") ?? "", state: params.get("state") ?? "", city: params.get("city") ?? "",
    budget: params.get("budget") ?? "", bedrooms: params.get("bedrooms") ?? "", bathrooms: params.get("bathrooms") ?? "",
    facility: params.get("facility") ?? "" };
}

function FilterFields({ draft, setDraft, apply, reset, mobile = false, error }: {
  draft: Draft; setDraft: (value: Draft) => void; apply: () => void; reset: () => void; mobile?: boolean; error?: string | null;
}) {
  const update = (key: keyof Draft, value: string) => setDraft({ ...draft, [key]: value });
  const countField = (label: string, key: "bedrooms" | "bathrooms") => <fieldset className="buy-count-filter"><legend>{label}</legend><div>
    {[1,2,3,4,5,6].map(count => <button key={count} type="button" aria-pressed={draft[key] === String(count)} onClick={() => update(key, draft[key] === String(count) ? "" : String(count))}>{count}</button>)}
    <button type="button" aria-pressed={draft[key] === "7+"} onClick={() => update(key, draft[key] === "7+" ? "" : "7+")}>7+</button>
  </div></fieldset>;
  return <div className={`buy-filter-fields${mobile ? " mobile" : ""}`}>
    <div className="buy-filter-title"><h2>Advanced Filter Options</h2><button type="button" onClick={reset}>Reset</button></div>
    <label>Select Property Type<select value={draft.propertyType} onChange={event => update("propertyType", event.target.value)}><option value="">Any type</option><option>Residential</option><option>Commercial</option></select></label>
    <div className="buy-filter-pair"><label>State<select value={draft.state} onChange={event => update("state", event.target.value)}><option value="">Select State</option>{nigerianStates.map(state => <option key={state}>{state}</option>)}</select></label><label>City<input value={draft.city} maxLength={100} placeholder="Enter City" onChange={event => update("city", event.target.value)}/></label></div>
    <label>Local Government<input disabled placeholder="Not available yet" title="LGA filtering is not available in the current property data"/></label>
    <label>What is your budget?<span className="buy-budget-input"><span>NGN</span><input inputMode="decimal" value={draft.budget} placeholder="Enter Amount here" onChange={event => update("budget", event.target.value)}/></span></label>
    {countField("Bedrooms", "bedrooms")}{countField("Bathrooms", "bathrooms")}
    <fieldset className="buy-facility-filter"><legend>Additional Conveniences</legend>
      {propertyFacilities.map(facility => <label key={facility}><input type="radio" name={mobile ? "buy-mobile-facility" : "buy-desktop-facility"} checked={draft.facility === facility} onChange={() => update("facility", facility)}/>{facility}</label>)}
      <button type="button" className="buy-clear-facility" onClick={() => update("facility", "")}>Clear convenience</button>
    </fieldset>
    <label>Property Code<input value={draft.code} maxLength={100} placeholder="Enter Property Code" onChange={event => update("code", event.target.value)}/></label>
    {error && <p className="buy-filter-error" role="alert">{error}</p>}
    <button type="button" className="buy-apply" onClick={apply}>Apply Filters</button>
  </div>;
}

function PropertyCard({ property, signedIn, saved, onSaved }: { property: PublicProperty; signedIn: boolean; saved: boolean; onSaved: () => void }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [copying, setCopying] = useState(false);
  async function save() {
    if (!signedIn) { router.push(`/login?next=${encodeURIComponent(`/buy?code=${property.code}`)}`); return; }
    if (saving || saved) return; setSaving(true);
    try { await saveProperty(property.code); onSaved(); toast.success("Property saved"); }
    catch (error) { showAuthError(error, "buy-save-error"); }
    finally { setSaving(false); }
  }
  async function copyReferral() {
    if (copying) return;
    setCopying(true);
    try { const referral = await createPublicPropertyReferral(property.code); await navigator.clipboard.writeText(referral.referralUrl); toast.success("Referral link copied to clipboard"); }
    catch (error) { showAuthError(error, "buy-referral-error"); }
    finally { setCopying(false); }
  }
  return <article className="buy-property-card"><div className="buy-property-image">
    {property.images[0] ? <Image src={property.images[0]} alt={`Exterior of ${property.title}`} width={640} height={450} unoptimized/> : <div className="buy-image-placeholder" role="img" aria-label={`No photograph available for ${property.title}`}>Photo unavailable</div>}
    <button type="button" className="buy-save" aria-label={saved ? `${property.title} is saved` : `Save ${property.title}`} aria-pressed={saved} disabled={saving || saved} onClick={() => void save()}>{saved ? "♥" : "♡"}</button>
    {property.images.length > 0 && <span className="buy-image-count">▧ {property.images.length}</span>}
  </div><div className="buy-property-copy">
    <strong className="buy-price">{formatNaira(property.priceMinor)}</strong>
    <p className="buy-property-type">{property.propertySubtype} · {property.propertyType}</p>
    <h3>{property.title}</h3><p className="buy-description">{property.description}</p>
    <p className="buy-location">⌖ {property.city}, {property.state}</p>
    <div className="buy-property-facts"><span>▱ {property.bedrooms} {property.bedrooms === 1 ? "Bedroom" : "Bedrooms"}</span><span>♧ {property.bathrooms} {property.bathrooms === 1 ? "Bathroom" : "Bathrooms"}</span><span>▣ {property.parkingSpaces} {property.parkingSpaces === 1 ? "Parking Space" : "Parking Spaces"}</span></div>
    <div className="buy-card-bottom"><span>Property Code: {property.code}</span>{signedIn ? <button type="button" disabled={copying} onClick={() => void copyReferral()}>{copying ? "Copying…" : "Copy Referral Link"}</button> : <Link href={`/login?next=${encodeURIComponent(`/buy?code=${property.code}`)}`}>Copy Referral Link</Link>}</div>
  </div></article>;
}

export function PublicBuyPage() {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const router = useRouter(); const searchParams = useSearchParams(); const searchKey = searchParams.toString();
  const [draftState, setDraftState] = useState<{ key: string; value: Draft }>(() => ({ key: searchKey, value: draftFrom(new URLSearchParams(searchKey)) }));
  const draft = draftState.key === searchKey ? draftState.value : draftFrom(new URLSearchParams(searchKey));
  const setDraft = (value: Draft) => setDraftState({ key: searchKey, value });
  const [resultState, setResultState] = useState<{ key: string; page: PublicPropertyPage | null; error: string | null } | null>(null);
  const [formError, setFormError] = useState<string | null>(null); const [mandateNotice, setMandateNotice] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false); const [retry, setRetry] = useState(0);
  const [savedCodes, setSavedCodes] = useState<Set<string>>(() => new Set());
  const pendingSearch = useRef<string | null>(null); const closeButton = useRef<HTMLButtonElement>(null);
  const interpreted = apiQueryFromBuyUrl(new URLSearchParams(searchKey));
  const requestKey = `${searchKey}:${retry}`;
  const loading = !interpreted.error && resultState?.key !== requestKey;
  const error = interpreted.error ?? (resultState?.key === requestKey ? resultState.error : null);
  const results = resultState?.key === requestKey ? resultState.page : null;
  useEffect(() => {
    const controller = new AbortController(); const current = apiQueryFromBuyUrl(new URLSearchParams(searchKey));
    if (current.error) { pendingSearch.current = null; return () => controller.abort(); }
    void fetchPublicProperties(current.query, controller.signal).then(page => {
      if (controller.signal.aborted) return;
      setResultState({ key: requestKey, page, error: null });
      if (pendingSearch.current === searchKey) { pendingSearch.current = null; void recordPublicPropertySearch().catch(() => {}); }
    }).catch(() => { if (!controller.signal.aborted) { setResultState({ key: requestKey, page: null, error: "Properties are temporarily unavailable. Please try again." }); pendingSearch.current = null; } });
    return () => controller.abort();
  }, [searchKey, requestKey]);
  useEffect(() => {
    if (!customer || !results?.items.length) return;
    const controller = new AbortController();
    void fetchSavedPropertyStates(results.items.map(property => property.code), controller.signal)
      .then(codes => { if (!controller.signal.aborted) setSavedCodes(new Set(codes)); }).catch(() => {});
    return () => controller.abort();
  }, [customer, results]);
  useEffect(() => {
    if (!mobileOpen) return;
    closeButton.current?.focus(); const previous = document.body.style.overflow; document.body.style.overflow = "hidden";
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setMobileOpen(false); };
    window.addEventListener("keydown", escape);
    return () => { document.body.style.overflow = previous; window.removeEventListener("keydown", escape); };
  }, [mobileOpen]);

  function navigate(next: URLSearchParams, intentional: boolean) {
    const key = next.toString(); pendingSearch.current = intentional ? key : null;
    if (key === searchKey) setRetry(value => value + 1);
    else router.push(`/buy${key ? `?${key}` : ""}`, { scroll: false });
  }
  function apply(nextDraft = draft) {
    if (nextDraft.q.trim() && nextDraft.code.trim()) { setFormError("Use either Search properties or Property Code, not both."); return; }
    if (nextDraft.budget.trim() && nairaToKobo(nextDraft.budget) === null) { setFormError("Enter a valid naira budget with at most two decimal places."); return; }
    const next = new URLSearchParams(searchKey);
    for (const key of editableKeys) next.delete(key);
    for (const key of editableKeys) { const value = nextDraft[key].trim(); if (value) next.set(key, value); }
    next.delete("page"); next.delete("mode");
    setFormError(null); setMobileOpen(false); navigate(next, true);
  }
  function reset() { const next = new URLSearchParams(); setDraft(draftFrom(next)); setFormError(null); setMobileOpen(false); navigate(next, true); }
  function setPage(page: number) { const next = new URLSearchParams(searchKey); next.set("page", String(page)); navigate(next, false); }
  function quickBedrooms(count: string) { apply({ ...draft, bedrooms: draft.bedrooms === count ? "" : count }); }
  function quickSubtype(subtype: string) { apply({ ...draft, propertySubtype: draft.propertySubtype === subtype ? "" : subtype }); }
  function submitSearch(event: FormEvent<HTMLFormElement>) { event.preventDefault(); apply(); }
  const total = results?.total ?? 0; const first = results && total ? (results.page - 1) * results.pageSize + 1 : 0;
  const last = results ? Math.min(total, results.page * results.pageSize) : 0;

  return <div className="public-page public-buy-page"><PublicHeader sessionAware mobileMenu onSessionChange={setCustomer}/><main>
    <div className="buy-top"><h1>Buy</h1>
      <div className="buy-disclaimer"><span aria-hidden="true">⚠</span><div><strong>Disclaimer</strong><p>Dear Valued Client you are adviced to please visit a property before making a decision.</p></div></div>
      <div className="buy-mandate"><div><strong>Buy Mandate</strong><p>This is a document prepared by our Legal team which when signed will give Beryl Shelter Nigeria Limited right and privileges.</p></div><button type="button" onClick={() => setMandateNotice(true)}>Sign Mandate ↗</button></div>
      {mandateNotice && <p className="buy-mandate-notice" role="status">Mandate signing is not available yet. No document has been signed.</p>}
      <h2>{loading ? "Finding properties…" : `${total} ${total === 1 ? "Property" : "Properties"} found for sale`}</h2>
      <div className="buy-quick"><p>Quick Filters</p><form className="buy-search" onSubmit={submitSearch}><label htmlFor="buy-q">Search properties</label><div><input id="buy-q" value={draft.q} maxLength={100} placeholder="Search by title, code, state or city" onChange={event => setDraft({ ...draft, q: event.target.value })}/><button type="submit">Search</button></div></form>
        <div className="buy-quick-chips">{["1","2","3","4","5","6","7+"].map(count => <button key={count} type="button" aria-pressed={draft.bedrooms === count} onClick={() => quickBedrooms(count)}>{count} {count === "1" ? "Bedroom" : "Bedrooms"}</button>)}</div>
        <div className="buy-quick-chips">{propertySubtypes.map(subtype => <button key={subtype} type="button" aria-pressed={draft.propertySubtype === subtype} onClick={() => quickSubtype(subtype)}>{subtype}</button>)}</div>
        <button className="buy-mobile-filter-open" type="button" onClick={() => setMobileOpen(true)}>Advanced Filters <span aria-hidden="true">☷</span></button>
      </div>
    </div>
    <div className="buy-results-band"><div className="buy-results-layout"><section className="buy-results" aria-label="Properties for sale">
      <div className="buy-results-toolbar"><p>{loading ? "Loading results…" : `${first}–${last} of ${total} ${total === 1 ? "property" : "properties"} for sale`}</p><label className="buy-sort">↕ <span className="buy-sr-only">Sort properties</span><select aria-label="Sort properties" value={new URLSearchParams(searchKey).get("sort") || "latest"} onChange={event => { const next = new URLSearchParams(searchKey); next.set("sort", event.target.value); next.delete("page"); navigate(next, true); }}><option value="latest">Sort: Latest listed</option><option value="oldest">Sort: Oldest listed</option><option value="price_asc">Sort: Price: Low to High</option><option value="price_desc">Sort: Price: High to Low</option></select></label></div>
      {interpreted.locationNotice && <p className="buy-location-notice" role="status">{interpreted.locationNotice}</p>}
      {formError && <p className="buy-results-error" role="alert">{formError}</p>}
      {loading ? <div className="buy-results-state" role="status">Loading available properties…</div> : error ? <div className="buy-results-state" role="alert"><strong>{error}</strong><button type="button" onClick={() => setRetry(value => value + 1)}>Try again</button></div> : results?.items.length ? <div className="buy-card-list">{results.items.map(property => <PropertyCard key={property.code} property={property} signedIn={!!customer} saved={!!customer && savedCodes.has(property.code)} onSaved={() => setSavedCodes(current => new Set(current).add(property.code))}/>)}</div> : <div className="buy-results-state"><strong>No properties match these filters yet.</strong><p>Try a different search or clear your filters.</p><button type="button" onClick={reset}>Clear filters</button></div>}
      {!loading && !error && results && results.totalPages > 1 && <nav className="buy-pagination" aria-label="Property results pages"><span>Showing {first}–{last} of {total} properties</span><div><button type="button" onClick={() => setPage(results.page - 1)} disabled={results.page <= 1} aria-label="Previous page">←</button><span>Page {results.page} of {results.totalPages}</span><button type="button" onClick={() => setPage(results.page + 1)} disabled={results.page >= results.totalPages} aria-label="Next page">→</button></div></nav>}
    </section><aside className="buy-sidebar" aria-label="Advanced Filters"><FilterFields draft={draft} setDraft={setDraft} apply={() => apply()} reset={reset}/></aside></div>
      <div className="buy-referral"><Link href="/referrals" aria-label="Learn about property referrals"><Image src="/buy/refer-and-earn.png" alt="Refer and earn with Beryl Shelter" width={1300} height={350} unoptimized/></Link><p>Refer a successful transaction and earn 2%. <Link href="/referrals">Learn about referrals →</Link></p></div>
    </div>
  </main><PublicSiteFooter/>
    {mobileOpen && <div className="buy-filter-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setMobileOpen(false); }}><div className="buy-filter-sheet" role="dialog" aria-modal="true" aria-label="Advanced Filters"><button ref={closeButton} type="button" className="buy-filter-close" aria-label="Close Advanced Filters" onClick={() => setMobileOpen(false)}>×</button><FilterFields draft={draft} setDraft={setDraft} apply={() => apply()} reset={reset} mobile error={formError}/></div></div>}
  </div>;
}
