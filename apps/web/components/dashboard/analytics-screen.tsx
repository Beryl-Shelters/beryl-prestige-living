"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthApiError } from "../../lib/auth-api";
import { fetchAnalytics, type CustomerAnalytics } from "../../lib/analytics-api";
import { BrandLoader } from "../auth/brand-loader";
import { showAuthError } from "../auth/toast-provider";

const series = ["buy", "sell", "referral"] as const;
const labels = { buy: "Buy", sell: "Sell", referral: "Referral" };

function CategoryPerformance({ analytics, changeYear }: { analytics: CustomerAnalytics; changeYear: (year: number) => void }) {
  const points = analytics.categoryPerformance;
  const ceiling = Math.max(2, Math.ceil(Math.max(0, ...points.flatMap(point => series.map(key => point[key])))));
  return <section className="dashboard-card analytics-performance" aria-labelledby="category-performance-title">
    <div className="analytics-chart-heading">
      <h2 id="category-performance-title">Category Performance</h2>
      <ul className="analytics-legend" aria-label="Performance series">{series.map(key => <li key={key}><i className={`analytics-series-${key}`} aria-hidden="true" />{labels[key]}</li>)}</ul>
      <div className="analytics-year" role="group" aria-label="Performance year">
        <button type="button" aria-label="Previous year" disabled={analytics.year <= 2000} onClick={() => changeYear(analytics.year - 1)}>‹</button>
        <span>Jan 1 - Dec 31, {analytics.year}</span>
        <button type="button" aria-label="Next year" disabled={analytics.year >= 2100} onClick={() => changeYear(analytics.year + 1)}>›</button>
      </div>
    </div>
    <figure className="analytics-chart" aria-label={`Category Performance for ${analytics.year}`}>
      <div className="analytics-axis" aria-hidden="true">{[1, .75, .5, .25, 0].map(ratio => <span key={ratio}>{ceiling * ratio}</span>)}</div>
      <div className="analytics-plot">
        {[0, 25, 50, 75, 100].map(top => <span className="analytics-gridline" key={top} style={{ top: `${top}%` }} />)}
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {series.filter(key => points.some(point => point[key] !== 0)).map(key => <polyline key={key} className={`analytics-series-${key}`} points={points.map((point, index) => `${index / 11 * 100},${100 - point[key] / ceiling * 100}`).join(" ")} fill="none" strokeWidth="2" vectorEffect="non-scaling-stroke" />)}
        </svg>
      </div>
      <div className="analytics-months">{points.map(point => <span key={point.month}>{point.label}</span>)}</div>
      <figcaption className="dashboard-sr-only">{points.map(point => `${point.label}: Buy ${point.buy}, Sell ${point.sell}, Referral ${point.referral}`).join("; ")}</figcaption>
    </figure>
  </section>;
}

function AnalyticsCards({ q, year, changeYear, retry }: { q: string; year: number; changeYear: (year: number) => void; retry: () => void }) {
  const router = useRouter();
  const [analytics, setAnalytics] = useState<CustomerAnalytics | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void fetchAnalytics(q, year, controller.signal).then(data => {
      if (!controller.signal.aborted) setAnalytics(data);
    }).catch(error => {
      if (controller.signal.aborted) return;
      if (error instanceof AuthApiError && error.status === 401) router.replace("/login");
      else { setFailed(true); showAuthError(error, "analytics-fetch-error"); }
    });
    return () => controller.abort();
  }, [q, year, router]);
  if (!analytics) return failed ? <div className="analytics-retry"><button className="button button-primary" onClick={retry}>Try again</button></div> : <BrandLoader />;
  return <div className="analytics-results">
    <div className="analytics-upper">
      <CategoryPerformance analytics={analytics} changeYear={changeYear} />
      <section className="dashboard-card analytics-overview" aria-labelledby="listings-overview-title">
        <h2 id="listings-overview-title">Listings Overview</h2>
        <div className="analytics-total"><strong>{analytics.listingsOverview.total}</strong><span>Total Listings</span></div>
        <div className="analytics-statuses">{(["listed", "pending", "rejected"] as const).map(status => {
          const metric = analytics.listingsOverview[status];
          const label = status.charAt(0).toUpperCase() + status.slice(1);
          return <div className="analytics-status" key={status}><div><span>{label}</span><span>{metric.percentage.toFixed(2)}%</span></div>
            <progress value={metric.percentage} max={100} aria-label={`${label}: ${metric.count} listings, ${metric.percentage}%`} />
          </div>;
        })}</div>
      </section>
    </div>
    <div className="analytics-lower">
      <section className="dashboard-card analytics-breakdown" aria-labelledby="analytics-bedrooms-title">
        <h2 id="analytics-bedrooms-title">Bedrooms contained in the properties</h2>
        <dl className="analytics-bedrooms">{([1, 2, 3, 4, 5, 6] as const).map(bedroom => <div key={bedroom}><dt>{bedroom} bedroom(s)</dt><dd>{analytics.bedrooms[bedroom]}</dd></div>)}</dl>
      </section>
      <section className="dashboard-card analytics-breakdown" aria-labelledby="analytics-property-types-title">
        <h2 id="analytics-property-types-title">Property Type</h2>
        <dl className="analytics-property-types">{([
          ["commercial", "Commercial(s)"], ["detachedHouses", "Detached Houses(s)"], ["flats", "Flats(s)"], ["others", "Others(s)"], ["residential", "Residential(s)"],
        ] as const).map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{analytics.propertyTypes[key]}</dd></div>)}</dl>
      </section>
    </div>
  </div>;
}

export function AnalyticsScreen({ initialYear }: { initialYear: number }) {
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [year, setYear] = useState(initialYear);
  const [attempt, setAttempt] = useState(0);
  return <section className="analytics-page">
    <h1>Analytics</h1>
    <form className="analytics-search" role="search" onSubmit={event => { event.preventDefault(); setQ(search.trim()); }}>
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="8" cy="8" r="4.5" /><path d="m11.5 11.5 4 4" /></svg>
      <input aria-label="Search your listings by title or code" placeholder="Search your listings by title or code" maxLength={100} value={search} onChange={event => setSearch(event.target.value)} />
      <button className="button button-primary" type="submit">Search</button>
    </form>
    <AnalyticsCards key={JSON.stringify([q, year, attempt])} q={q} year={year} changeYear={setYear} retry={() => setAttempt(value => value + 1)} />
  </section>;
}
