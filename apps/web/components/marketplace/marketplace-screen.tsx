"use client";

import Image from "next/image";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BadgeCheck,
  Bath,
  BedDouble,
  ChevronLeft,
  ChevronRight,
  Heart,
  House,
  Images,
  LayoutGrid,
  List,
  MapPin,
  Search,
  SlidersHorizontal,
  Toilet,
  X
} from "lucide-react";
import { MarketplaceHeader } from "@/components/marketplace/marketplace-header";
import { AuthPrompt } from "@/components/marketplace/property-detail-screen";
import { useAuth } from "@/context/auth-provider";
import { customerApi, marketplaceApi } from "@/lib/api/client";
import type { ApiSuccess, MarketplacePropertyCard, MarketplaceSearchResult, MarketplaceSort } from "@/lib/contracts";
import {
  formatNaira,
  humanizeMarketplaceValue,
  marketplaceApiParams,
  marketplaceDefaults,
  marketplaceQueryString,
  parseMarketplaceQuery,
  type MarketplacePageSearchParams,
  type MarketplaceQueryState
} from "@/lib/marketplace";

const sortOptions: { value: MarketplaceSort; label: string }[] = [
  { value: "DEFAULT", label: "Recommended" },
  { value: "MOST_RECENT", label: "Most recent" },
  { value: "PRICE_HIGH_TO_LOW", label: "Price: high to low" },
  { value: "PRICE_LOW_TO_HIGH", label: "Price: low to high" },
  { value: "BEDS", label: "Most bedrooms" }
];

const propertyTypes = [
  ["APARTMENT", "Flat / apartment"],
  ["MINI_FLAT", "Mini Flat"],
  ["SELF_CONTAIN_STUDIO", "Self-Contain / Studio"],
  ["DUPLEX", "Duplex"],
  ["DETACHED_HOUSE", "Detached House"],
  ["SEMI_DETACHED_HOUSE", "Semi-Detached House"],
  ["TERRACE", "Terrace House"],
  ["BUNGALOW", "Bungalow"],
] as const;
const conditionOptions = [["NEWLY_BUILT", "Newly-Built"], ["OFF_PLAN", "Off-Plan"], ["UNDER_CONSTRUCTION", "Under Construction"], ["FAIRLY_USED", "Fairly-Used"]] as const;
const furnishingOptions = [["FULLY_FURNISHED", "Fully Furnished"], ["UNFURNISHED", "Unfurnished"], ["SEMI_FURNISHED", "Semi Furnished"]] as const;

type FilterPanelProps = {
  query: MarketplaceQueryState;
  onApply: (filters: Partial<MarketplaceQueryState>) => void;
  onReset: () => void;
};

function FilterPanel({ query, onApply, onReset }: FilterPanelProps) {
  const [location, setLocation] = useState(query.location);
  const [minPrice, setMinPrice] = useState(query.minPrice);
  const [maxPrice, setMaxPrice] = useState(query.maxPrice);
  const [propertyType, setPropertyType] = useState(query.propertyType);
  const [category] = useState(query.category);
  const [condition, setCondition] = useState(query.condition);
  const [furnishing, setFurnishing] = useState(query.furnishing);
  const [bedrooms, setBedrooms] = useState(query.bedrooms);
  const [rangeError, setRangeError] = useState("");
  const selectedPropertyTypes = propertyType ? propertyType.split(",").filter(Boolean) : [];
  const togglePropertyType = (value: string) => {
    const next = selectedPropertyTypes.includes(value)
      ? selectedPropertyTypes.filter((selected) => selected !== value)
      : [...selectedPropertyTypes, value];
    setPropertyType(next.join(","));
  };
  const toggleMulti = (current: string, value: string, setValue: (next: string) => void) => {
    const selected = current.split(",").filter(Boolean);
    setValue((selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value]).join(","));
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (minPrice && maxPrice && Number(minPrice) > Number(maxPrice)) {
      setRangeError("Minimum price cannot be greater than maximum price.");
      return;
    }
    setRangeError("");
    onApply({
      location: location.trim(),
      minPrice,
      maxPrice,
      propertyType,
      category,
      condition,
      furnishing,
      bedrooms
    });
  };

  return <form className="marketplace-filter-form" onSubmit={submit}>
    <div className="marketplace-filter-heading"><h2>Filters</h2><button className="marketplace-reset-link" type="button" onClick={onReset}>Clear</button></div>
    <fieldset className="marketplace-filter-group">
      <legend>Price Range</legend>
      <div className="marketplace-price-row">
        <label><span className="sr-only">Minimum</span><span className="marketplace-money-input"><b>₦</b><input aria-label="Minimum price" inputMode="numeric" min="0" type="number" value={minPrice} onChange={(event) => setMinPrice(event.target.value)} placeholder="Min. Price" /></span></label>
        <label><span className="sr-only">Maximum</span><span className="marketplace-money-input"><b>₦</b><input aria-label="Maximum price" inputMode="numeric" min="0" type="number" value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} placeholder="Max. Price" /></span></label>
      </div>
      {rangeError ? <p className="marketplace-filter-error" role="alert">{rangeError}</p> : null}
    </fieldset>
    <fieldset className="marketplace-filter-group marketplace-checkbox-group"><legend>Property Type</legend>{propertyTypes.map(([value, label]) => <label key={value}><input type="checkbox" value={value} checked={selectedPropertyTypes.includes(value)} onChange={() => togglePropertyType(value)} /><span>{label}</span></label>)}</fieldset>
    <fieldset className="marketplace-filter-group marketplace-checkbox-group"><legend>Condition</legend>{conditionOptions.map(([value, label]) => <label key={value}><input type="checkbox" checked={condition.split(",").includes(value)} onChange={() => toggleMulti(condition, value, setCondition)} /><span>{label}</span></label>)}</fieldset>
    <fieldset className="marketplace-filter-group marketplace-checkbox-group"><legend>Furnishing</legend>{furnishingOptions.map(([value, label]) => <label key={value}><input type="checkbox" checked={furnishing.split(",").includes(value)} onChange={() => toggleMulti(furnishing, value, setFurnishing)} /><span>{label}</span></label>)}</fieldset>
    <fieldset className="marketplace-filter-group marketplace-bedroom-group"><legend>Bedrooms</legend><div>{[1, 2, 3, 4].map((number) => <button type="button" key={number} aria-pressed={bedrooms === String(number)} onClick={() => setBedrooms(bedrooms === String(number) ? "" : String(number))}>{number}</button>)}<button type="button" aria-pressed={bedrooms === "5+"} onClick={() => setBedrooms(bedrooms === "5+" ? "" : "5+")}>5+</button></div></fieldset>
    <label className="marketplace-filter-field marketplace-state-field"><span>Explore States</span><input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Search states" /></label>
    <button className="btn btn-primary marketplace-apply-button" type="submit">Apply Filters</button>
  </form>;
}

function PropertyCard({ property, view, saving, onSave }: { property: MarketplacePropertyCard; view: "grid" | "list"; saving: boolean; onSave: (trigger: HTMLButtonElement) => void }) {
  return <article className="marketplace-property-card" data-view={view}>
    <a className="marketplace-property-image-link" href={`/marketplace/${property.id}`} aria-label={`View ${property.title}`}>
      <div className="marketplace-property-image">
        {property.coverImage
          ? <Image src={property.coverImage.url} alt={`${property.title} in ${property.publicLocation}`} fill sizes="(max-width: 767px) 100vw, (max-width: 1199px) 50vw, 33vw" />
          : <div className="marketplace-image-placeholder"><House aria-hidden="true" size={38} /><span>Property image unavailable</span></div>}
        {property.photoCount > 0 ? <span className="marketplace-photo-count"><Images aria-hidden="true" size={15} />{property.photoCount}</span> : null}
        {property.verified ? <span className="marketplace-verified-badge"><BadgeCheck aria-hidden="true" size={15} /> Verified</span> : null}
      </div>
    </a>
    <button className="marketplace-card-save" type="button" aria-label={property.saved ? `Remove ${property.title} from saved properties` : `Save ${property.title}`} aria-pressed={property.saved} disabled={saving} onClick={(event) => onSave(event.currentTarget)}><Heart aria-hidden="true" size={19} fill={property.saved ? "currentColor" : "none"} /></button>
    <div className="marketplace-property-body">
      <div className="marketplace-card-price"><strong>{formatNaira(property.askingPrice)}</strong>{property.negotiable ? <span>Negotiable</span> : null}</div>
      <a className="marketplace-card-title" href={`/marketplace/${property.id}`}>{property.title}</a>
      <div className="marketplace-card-kicker"><span>{humanizeMarketplaceValue(property.propertyType)}</span></div>
      <p className="marketplace-card-location"><MapPin aria-hidden="true" size={16} />{property.publicLocation}</p>
      <dl className="marketplace-card-meta">
        {property.bedrooms !== null ? <div><dt><BedDouble aria-hidden="true" size={15} /></dt><dd>{property.bedrooms} Beds</dd></div> : null}
        {property.bathrooms !== null ? <div><dt><Bath aria-hidden="true" size={15} /></dt><dd>{property.bathrooms} Baths</dd></div> : null}
        {property.toilets !== null ? <div><dt><Toilet aria-hidden="true" size={15} /></dt><dd>{property.toilets} Toilets</dd></div> : null}
      </dl>
    </div>
  </article>;
}

function MarketplaceSkeletons() {
  return <div className="marketplace-grid" aria-label="Loading properties" aria-live="polite">{Array.from({ length: 6 }, (_, index) => <div className="marketplace-card-skeleton" key={index}><div /><span /><span /><span /></div>)}</div>;
}

function Pagination({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (page: number) => void }) {
  if (totalPages <= 1) return null;
  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
  const pages = Array.from({ length: Math.min(5, totalPages) }, (_, index) => start + index);
  return <nav className="marketplace-pagination" aria-label="Marketplace result pages">
    <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)}><ChevronLeft size={18} /> Previous</button>
    <div>{pages.map((number) => <button type="button" aria-current={number === page ? "page" : undefined} key={number} onClick={() => onPage(number)}>{number}</button>)}</div>
    <button type="button" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>Next <ChevronRight size={18} /></button>
  </nav>;
}

export function MarketplaceScreen({ initialSearchParams = {} }: { initialSearchParams?: MarketplacePageSearchParams }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { session, sessionLoading } = useAuth();
  const [query, setQuery] = useState(() => parseMarketplaceQuery(initialSearchParams));
  const [searchValue, setSearchValue] = useState(query.q);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [view, setView] = useState<"grid" | "list">("grid");
  const mobileFilterButtonRef = useRef<HTMLButtonElement>(null);
  const mobileFilterDrawerRef = useRef<HTMLElement>(null);
  const authPromptTrigger = useRef<HTMLElement>(null);
  const [authPromptOpen, setAuthPromptOpen] = useState(false);
  const params = useMemo(() => marketplaceApiParams(query), [query]);
  const result = useQuery({
    queryKey: ["marketplace-properties", params],
    queryFn: () => marketplaceApi.search(params)
  });
  const saveMutation = useMutation({
    mutationFn: ({ propertyId, saved }: { propertyId: string; saved: boolean }) => saved ? customerApi.unsaveProperty(propertyId) : customerApi.saveProperty(propertyId),
    onSuccess: (_response, variables) => queryClient.setQueryData<ApiSuccess<MarketplaceSearchResult>>(["marketplace-properties", params], (current) => current ? { ...current, data: { ...current.data, properties: current.data.properties.map((property) => property.id === variables.propertyId ? { ...property, saved: !variables.saved } : property) } } : current)
  });
  const toggleSaved = (property: MarketplacePropertyCard, trigger: HTMLButtonElement) => {
    if (sessionLoading) return;
    if (!session) {
      authPromptTrigger.current = trigger;
      setAuthPromptOpen(true);
      return;
    }
    saveMutation.mutate({ propertyId: property.id, saved: property.saved });
  };

  const commit = useCallback((patch: Partial<MarketplaceQueryState>, resetPage = true) => {
    setQuery((current) => {
      const next = { ...current, ...patch, page: resetPage ? 1 : patch.page ?? current.page };
      router.replace(marketplaceQueryString(next) as Route, { scroll: false });
      return next;
    });
  }, [router]);

  useEffect(() => {
    if (!mobileFiltersOpen) return;
    const returnFocusTo = mobileFilterButtonRef.current;
    const drawer = mobileFilterDrawerRef.current;
    const focusable = () => Array.from(drawer?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), [href]') ?? []);
    focusable()[0]?.focus();
    const handleDialogKeys = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileFiltersOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const controls = focusable();
      if (!controls.length) return;
      const firstControl = controls[0];
      const lastControl = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === firstControl) {
        event.preventDefault();
        lastControl.focus();
      } else if (!event.shiftKey && document.activeElement === lastControl) {
        event.preventDefault();
        firstControl.focus();
      }
    };
    window.addEventListener("keydown", handleDialogKeys);
    return () => {
      window.removeEventListener("keydown", handleDialogKeys);
      returnFocusTo?.focus();
    };
  }, [mobileFiltersOpen]);

  const resetAll = () => {
    setSearchValue("");
    setMobileFiltersOpen(false);
    setQuery(marketplaceDefaults);
    router.replace("/marketplace" as Route, { scroll: false });
  };
  const applyFilters = (filters: Partial<MarketplaceQueryState>) => {
    commit(filters);
    setMobileFiltersOpen(false);
  };
  const filterKey = [query.location, query.minPrice, query.maxPrice, query.propertyType, query.category, query.condition, query.furnishing, query.bedrooms].join("|");
  const data = result.data?.data;
  const total = data?.pagination.total ?? 0;
  const firstResult = total ? (query.page - 1) * (data?.pagination.limit ?? 0) + 1 : 0;
  const lastResult = total ? Math.min(firstResult + (data?.properties.length ?? 0) - 1, total) : 0;

  return <div className="marketplace-page">
    <MarketplaceHeader returnTo={marketplaceQueryString(query)} searchValue={searchValue} onSearchChange={setSearchValue} onSearchSubmit={() => commit({ q: searchValue.trim() })} />

    <main>
      <section className="marketplace-results-shell" aria-labelledby="marketplace-results-heading">
        <button ref={mobileFilterButtonRef} className="marketplace-mobile-filter-button" type="button" onClick={() => setMobileFiltersOpen(true)}><SlidersHorizontal size={18} /> Filters</button>
        <div className="marketplace-results">
          <div className="marketplace-results-toolbar">
            <div className="marketplace-results-intro font-bold"><h1 id="marketplace-results-heading">Houses for Sale in Nigeria</h1><p>Explore properties published after review by the Beryl Shelter team.</p></div>
            <div className="marketplace-results-control-row"><p aria-live="polite">{result.isLoading ? "Finding available properties…" : total ? `Showing ${firstResult}–${lastResult} of ${total.toLocaleString("en-NG")}` : "No properties found"}</p><div className="marketplace-result-controls"><label><span>Sort:</span><select aria-label="Sort properties" value={query.sort} onChange={(event) => commit({ sort: event.target.value as MarketplaceSort })}>{sortOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><div className="marketplace-view-toggle" role="group" aria-label="Property result view"><button type="button" aria-label="Grid view" aria-pressed={view === "grid"} onClick={() => setView("grid")}><LayoutGrid size={17} /></button><button type="button" aria-label="List view" aria-pressed={view === "list"} onClick={() => setView("list")}><List size={18} /></button></div></div></div>
          </div>

          {result.isLoading ? <MarketplaceSkeletons /> : null}
          {result.isError ? <div className="marketplace-state-card" role="alert"><House size={36} /><h3>We could not load properties</h3><p>Please check your connection and try again.</p><button className="btn btn-primary" type="button" onClick={() => result.refetch()}>Try again</button></div> : null}
          {!result.isLoading && !result.isError && data?.properties.length === 0 ? <div className="marketplace-state-card"><Search size={36} /><h3>No properties match your search</h3><p>Try changing your search or clearing the filters.</p><button className="btn btn-secondary" type="button" onClick={resetAll}>Clear all filters</button></div> : null}
          {!result.isLoading && !result.isError && data?.properties.length ? <div className={`marketplace-grid marketplace-${view}`}>{data.properties.map((property) => <PropertyCard key={property.id} property={property} view={view} saving={saveMutation.isPending && saveMutation.variables?.propertyId === property.id} onSave={(trigger) => toggleSaved(property, trigger)} />)}</div> : null}
          {data ? <Pagination page={data.pagination.page} totalPages={data.pagination.total_pages} onPage={(page) => commit({ page }, false)} /> : null}
        </div>
        <aside className="marketplace-filter-sidebar" aria-label="Property filters"><FilterPanel key={filterKey} query={query} onApply={applyFilters} onReset={resetAll} /></aside>
      </section>
    </main>

    {mobileFiltersOpen ? <div className="marketplace-filter-overlay" role="presentation">
      <button className="marketplace-filter-dismiss" type="button" aria-label="Close filters" onClick={() => setMobileFiltersOpen(false)} />
      <section ref={mobileFilterDrawerRef} className="marketplace-filter-drawer" role="dialog" aria-modal="true" aria-label="Filter properties">
        <div className="marketplace-drawer-header"><strong>Filters</strong><button type="button" aria-label="Close filters" onClick={() => setMobileFiltersOpen(false)}><X size={22} /></button></div>
        <FilterPanel key={`mobile-${filterKey}`} query={query} onApply={applyFilters} onReset={resetAll} />
      </section>
    </div> : null}
    {authPromptOpen ? <AuthPrompt action="save" onClose={() => setAuthPromptOpen(false)} trigger={authPromptTrigger} returnTo={marketplaceQueryString(query)} /> : null}
  </div>;
}
