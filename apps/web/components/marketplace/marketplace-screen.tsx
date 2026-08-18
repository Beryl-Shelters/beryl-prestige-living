"use client";

import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BadgeCheck,
  Bath,
  BedDouble,
  CarFront,
  ChevronLeft,
  ChevronRight,
  House,
  Images,
  MapPin,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Toilet,
  X
} from "lucide-react";
import { BerylShelterLogo } from "@/components/brand/beryl-shelter-logo";
import { marketplaceApi } from "@/lib/api/client";
import type { MarketplacePropertyCard, MarketplaceSort } from "@/lib/contracts";
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
  ["", "All property types"],
  ["APARTMENT", "Apartment"],
  ["DUPLEX", "Duplex"],
  ["DETACHED_HOUSE", "Detached house"],
  ["SEMI_DETACHED_HOUSE", "Semi-detached house"],
  ["TERRACE", "Terrace"],
  ["BUNGALOW", "Bungalow"],
  ["LAND", "Land"]
] as const;

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
  const [category, setCategory] = useState(query.category);
  const [bedrooms, setBedrooms] = useState(query.bedrooms);
  const [rangeError, setRangeError] = useState("");

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
      bedrooms
    });
  };

  return <form className="marketplace-filter-form" onSubmit={submit}>
    <div className="marketplace-filter-heading"><h2>Filter properties</h2><button className="marketplace-reset-link" type="button" onClick={onReset}><RotateCcw size={15} /> Reset all</button></div>
    <label className="marketplace-filter-field"><span>Location</span><input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="City or area" /></label>
    <fieldset className="marketplace-filter-group">
      <legend>Price range</legend>
      <div className="marketplace-price-row">
        <label><span>Minimum</span><span className="marketplace-money-input"><b>₦</b><input aria-label="Minimum price" inputMode="numeric" min="0" type="number" value={minPrice} onChange={(event) => setMinPrice(event.target.value)} placeholder="0" /></span></label>
        <label><span>Maximum</span><span className="marketplace-money-input"><b>₦</b><input aria-label="Maximum price" inputMode="numeric" min="0" type="number" value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} placeholder="Any" /></span></label>
      </div>
      {rangeError ? <p className="marketplace-filter-error" role="alert">{rangeError}</p> : null}
    </fieldset>
    <label className="marketplace-filter-field"><span>Property type</span><select value={propertyType} onChange={(event) => setPropertyType(event.target.value)}>{propertyTypes.map(([value, label]) => <option key={value || "all"} value={value}>{label}</option>)}</select></label>
    <label className="marketplace-filter-field"><span>Category</span><select value={category} onChange={(event) => setCategory(event.target.value as MarketplaceQueryState["category"])}><option value="">All categories</option><option value="RESIDENTIAL">Residential</option><option value="COMMERCIAL">Commercial</option></select></label>
    <label className="marketplace-filter-field"><span>Bedrooms</span><select value={bedrooms} onChange={(event) => setBedrooms(event.target.value)}><option value="">Any number</option>{[1, 2, 3, 4, 5].map((number) => <option key={number} value={number}>{number} bedroom{number === 1 ? "" : "s"}</option>)}</select></label>
    <button className="btn btn-primary marketplace-apply-button" type="submit">Show properties</button>
  </form>;
}

function PropertyCard({ property }: { property: MarketplacePropertyCard }) {
  return <article className="marketplace-property-card">
    <a className="marketplace-property-image-link" href={`/marketplace/${property.id}`} aria-label={`View ${property.title}`}>
      <div className="marketplace-property-image">
        {property.coverImage
          ? <Image src={property.coverImage.url} alt={`${property.title} in ${property.publicLocation}`} fill sizes="(max-width: 767px) 100vw, (max-width: 1199px) 50vw, 33vw" />
          : <div className="marketplace-image-placeholder"><House aria-hidden="true" size={38} /><span>Property image unavailable</span></div>}
        {property.photoCount > 0 ? <span className="marketplace-photo-count"><Images aria-hidden="true" size={15} />{property.photoCount}</span> : null}
        {property.verified ? <span className="marketplace-verified-badge"><BadgeCheck aria-hidden="true" size={15} /> Verified</span> : null}
      </div>
    </a>
    <div className="marketplace-property-body">
      <div className="marketplace-card-kicker"><span>{humanizeMarketplaceValue(property.propertyType)}</span><span>{humanizeMarketplaceValue(property.propertyCategory)}</span></div>
      <a className="marketplace-card-title" href={`/marketplace/${property.id}`}>{property.title}</a>
      <p className="marketplace-card-location"><MapPin aria-hidden="true" size={16} />{property.publicLocation}</p>
      <div className="marketplace-card-price"><strong>{formatNaira(property.askingPrice)}</strong>{property.negotiable ? <span>Negotiable</span> : null}</div>
      <dl className="marketplace-card-meta">
        {property.bedrooms !== null ? <div><dt><BedDouble aria-hidden="true" size={17} /><span className="sr-only">Bedrooms</span></dt><dd>{property.bedrooms}</dd></div> : null}
        {property.bathrooms !== null ? <div><dt><Bath aria-hidden="true" size={17} /><span className="sr-only">Bathrooms</span></dt><dd>{property.bathrooms}</dd></div> : null}
        {property.toilets !== null ? <div><dt><Toilet aria-hidden="true" size={17} /><span className="sr-only">Toilets</span></dt><dd>{property.toilets}</dd></div> : null}
        {property.parkingSpaces !== null ? <div><dt><CarFront aria-hidden="true" size={17} /><span className="sr-only">Parking spaces</span></dt><dd>{property.parkingSpaces}</dd></div> : null}
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
  const [query, setQuery] = useState(() => parseMarketplaceQuery(initialSearchParams));
  const [searchValue, setSearchValue] = useState(query.q);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const mobileFilterButtonRef = useRef<HTMLButtonElement>(null);
  const mobileFilterDrawerRef = useRef<HTMLElement>(null);
  const params = useMemo(() => marketplaceApiParams(query), [query]);
  const result = useQuery({
    queryKey: ["marketplace-properties", params],
    queryFn: () => marketplaceApi.search(params)
  });

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

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    commit({ q: searchValue.trim() });
  };
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
  const filterKey = [query.location, query.minPrice, query.maxPrice, query.propertyType, query.category, query.bedrooms].join("|");
  const data = result.data?.data;
  const total = data?.pagination.total ?? 0;

  return <div className="marketplace-page">
    <header className="marketplace-header">
      <Link href="/" aria-label="Beryl Shelter home"><BerylShelterLogo /></Link>
      <nav aria-label="Primary navigation"><Link aria-current="page" href={"/marketplace" as Route}>Marketplace</Link><Link href="/signup?intent=LIST_PROPERTY">List a property</Link></nav>
      <div className="marketplace-header-actions"><Link href="/login">Log in</Link><Link className="btn btn-primary" href="/signup">Get started</Link></div>
    </header>

    <main>
      <section className="marketplace-hero">
        <p className="marketplace-eyebrow">Verified property marketplace</p>
        <h1>Find a home you can trust</h1>
        <p>Explore verified properties and find the right place for your next move.</p>
        <form className="marketplace-search" role="search" onSubmit={submitSearch}>
          <Search aria-hidden="true" size={21} />
          <label className="sr-only" htmlFor="marketplace-search">Search properties</label>
          <input id="marketplace-search" value={searchValue} onChange={(event) => setSearchValue(event.target.value)} placeholder="Search by location, property type or keyword" />
          <button className="btn btn-primary" type="submit">Search</button>
        </form>
      </section>

      <section className="marketplace-results-shell" aria-labelledby="marketplace-results-heading">
        <button ref={mobileFilterButtonRef} className="marketplace-mobile-filter-button" type="button" onClick={() => setMobileFiltersOpen(true)}><SlidersHorizontal size={18} /> Filters</button>
        <aside className="marketplace-filter-sidebar" aria-label="Property filters"><FilterPanel key={filterKey} query={query} onApply={applyFilters} onReset={resetAll} /></aside>
        <div className="marketplace-results">
          <div className="marketplace-results-toolbar">
            <div><h2 id="marketplace-results-heading">Properties for you</h2><p aria-live="polite">{result.isLoading ? "Finding available properties…" : `${total.toLocaleString("en-NG")} ${total === 1 ? "property" : "properties"} found`}</p></div>
            <label><span>Sort by</span><select aria-label="Sort properties" value={query.sort} onChange={(event) => commit({ sort: event.target.value as MarketplaceSort })}>{sortOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          </div>

          {result.isLoading ? <MarketplaceSkeletons /> : null}
          {result.isError ? <div className="marketplace-state-card" role="alert"><House size={36} /><h3>We could not load properties</h3><p>Please check your connection and try again.</p><button className="btn btn-primary" type="button" onClick={() => result.refetch()}>Try again</button></div> : null}
          {!result.isLoading && !result.isError && data?.properties.length === 0 ? <div className="marketplace-state-card"><Search size={36} /><h3>No properties match your search</h3><p>Try changing your search or clearing the filters.</p><button className="btn btn-secondary" type="button" onClick={resetAll}>Clear all filters</button></div> : null}
          {!result.isLoading && !result.isError && data?.properties.length ? <div className="marketplace-grid">{data.properties.map((property) => <PropertyCard key={property.id} property={property} />)}</div> : null}
          {data ? <Pagination page={data.pagination.page} totalPages={data.pagination.total_pages} onPage={(page) => commit({ page }, false)} /> : null}
        </div>
      </section>
    </main>

    {mobileFiltersOpen ? <div className="marketplace-filter-overlay" role="presentation">
      <button className="marketplace-filter-dismiss" type="button" aria-label="Close filters" onClick={() => setMobileFiltersOpen(false)} />
      <section ref={mobileFilterDrawerRef} className="marketplace-filter-drawer" role="dialog" aria-modal="true" aria-label="Filter properties">
        <div className="marketplace-drawer-header"><strong>Filters</strong><button type="button" aria-label="Close filters" onClick={() => setMobileFiltersOpen(false)}><X size={22} /></button></div>
        <FilterPanel key={`mobile-${filterKey}`} query={query} onApply={applyFilters} onReset={resetAll} />
      </section>
    </div> : null}
  </div>;
}
