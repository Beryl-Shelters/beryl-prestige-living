"use client";

import { useEffect, useState } from "react";
import { PublicHeader } from "../auth/public-header";
import { PublicSiteFooter } from "./public-site-footer";
import { fetchPublicAnalytics, type PublicAnalytics } from "../../lib/public-analytics-api";

type Period = "monthly" | "annually";

function money(valueMinor: number) {
  return `₦${new Intl.NumberFormat("en-NG", { notation: "compact", maximumFractionDigits: 1 }).format(valueMinor / 100)}`;
}

function linePath(values: (number | null)[], maximum: number) {
  if (values.length < 2 || maximum <= 0) return "";
  return values.map((value, index) => value === null ? "" : `${index === 0 || values[index - 1] === null ? "M" : "L"}${index / (values.length - 1) * 100},${100 - value / maximum * 100}`).join(" ");
}

function PriceChart({ data }: { data: PublicAnalytics }) {
  const values = data.priceSeries.map(item => item.valueMinor);
  const maximum = Math.max(0, ...values.map(value => value ?? 0));
  const ceiling = maximum ? Math.ceil(maximum / 5e9) * 5e9 : 0;
  return <figure className="public-price-chart" aria-label={`${data.period === "monthly" ? "Monthly" : "Annual"} average listed property price by publication date`}>
    <div className="public-chart-axis" aria-hidden="true">{[5,4,3,2,1,0].map(step => <span key={step}>{ceiling ? money(ceiling * step / 5) : "₦0"}</span>)}</div>
    <div className="public-chart-plot">
      {[0,20,40,60,80,100].map(top => <i key={top} style={{ top: `${top}%` }} />)}
      {maximum > 0 && <><svg className="public-desktop-line" viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="Real listed property averages"><path d={linePath(values, ceiling)} />{values.map((value,index)=>value===null?null:<circle key={index} cx={values.length===1?50:index/(values.length-1)*100} cy={100-value/ceiling*100} r="0.8" />)}</svg><svg className="public-mobile-line" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d={linePath(data.period === "monthly" ? values.slice(0,7) : values, ceiling)} />{(data.period==="monthly"?values.slice(0,7):values).map((value,index,array)=>value===null?null:<circle key={index} cx={array.length===1?50:index/(array.length-1)*100} cy={100-value/ceiling*100} r="0.8" />)}</svg></>}
      {maximum === 0 && <span className="public-chart-empty">No listed property prices for this period.</span>}
    </div>
    <div className={`public-chart-months${data.period === "annually" ? " public-chart-years" : ""}`} aria-hidden="true" style={{ gridTemplateColumns: `repeat(${Math.max(1,data.priceSeries.length)},1fr)` }}>{data.priceSeries.map(item => <span key={item.label}>{item.label}</span>)}</div>
    <figcaption className="visually-hidden">Current prices of currently listed properties, grouped by their listing publication date. Missing periods have no data.</figcaption>
  </figure>;
}

function SearchesChart({ days }: { days: PublicAnalytics["searchesPerDay"] }) {
  const maximum = Math.max(1, ...days.map(day => day.count));
  return <figure className="public-search-chart" aria-label="Actual public property searches per day">
    <div className="public-search-plot" aria-hidden="true">{[0,25,50,75,100].map(top => <i key={top} style={{ top: `${top}%` }} />)}<svg viewBox="0 0 100 100" preserveAspectRatio="none"><path d={linePath(days.map(day => day.count), maximum)} /></svg></div>
    <div className="public-search-dates" aria-hidden="true">{days.map(day => <span key={day.date}>{new Date(`${day.date}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "2-digit", timeZone: "UTC" })}</span>)}</div>
    <figcaption className="visually-hidden">{days.map(day => `${day.date}: ${day.count} searches`).join("; ")}</figcaption>
  </figure>;
}

export function PublicAnalyticsPage() {
  const [period, setPeriod] = useState<Period>("monthly");
  const [data, setData] = useState<PublicAnalytics | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void fetchPublicAnalytics(period, controller.signal).then(result => { if (!controller.signal.aborted) { setData(result); setError(false); } }).catch(() => { if (!controller.signal.aborted) { setData(null); setError(true); } });
    return () => controller.abort();
  }, [period, attempt]);
  function changePeriod(value: Period) { if (value !== period) { setData(null); setError(false); setPeriod(value); } }
  return <div className="public-page public-analytics-page"><PublicHeader sessionAware mobileMenu/><main>
    <div className="public-analytics-grid">
      <section className="public-analytics-card public-price-card" aria-labelledby="price-change-title">
        <div className="public-price-heading"><div><p>Price Change Graph</p><h1 id="price-change-title">Average Property Price Change Overtime</h1></div><div className="public-period-control" role="group" aria-label="Price chart period">{(["monthly","annually"] as const).map(value => <button key={value} type="button" aria-pressed={period === value} onClick={() => changePeriod(value)}>{value === "monthly" ? "Monthly" : "Annually"}</button>)}</div></div>
        {error ? <div className="public-analytics-state" role="alert">Analytics is temporarily unavailable. <button type="button" onClick={() => { setError(false); setAttempt(value => value + 1); }}>Try again</button></div> : !data ? <div className="public-analytics-state" role="status">Loading analytics…</div> : <PriceChart data={data}/>}
      </section>
      <section className="public-analytics-card public-summary-card" aria-labelledby="properties-percentage-title">
        <h2 id="properties-percentage-title">Percentage of Properties</h2>
        {data && !error ? <><figure className="public-donut" style={{ background: `conic-gradient(from 180deg, #bd8b29 0 ${data.propertyPercentage.residentialPercentage}%, #faf4e6 ${data.propertyPercentage.residentialPercentage}%)` }} aria-label={`${data.propertyPercentage.residentialPercentage}% of listed properties are residential`}><div><strong>{data.propertyPercentage.residentialPercentage}%</strong><span>Residential properties</span></div></figure><h2>Searches per day</h2><SearchesChart days={data.searchesPerDay}/></> : <div className="public-analytics-state">{error ? "No figures available." : "Loading figures…"}</div>}
      </section>
    </div>
  </main><PublicSiteFooter/></div>;
}
