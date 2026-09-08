"use client";
import { useState } from "react";
import type { DashboardOverview } from "../../lib/dashboard-api";
import { naira } from "../../lib/dashboard-format";

export function RevenueChart({ revenue }: { revenue: DashboardOverview["revenue"] }) {
  const [period, setPeriod] = useState<"monthly" | "yearly">("monthly");
  const points = revenue[period];
  const total = points.reduce((sum, point) => sum + point.amount, 0);
  const ceiling = Math.max(2, Math.ceil(Math.max(0, ...points.map((point) => point.amount))));
  const coordinates = points.map((point, index) => `${points.length < 2 ? 0 : index / (points.length - 1) * 100},${100 - point.amount / ceiling * 100}`).join(" ");
  return <section className="dashboard-card revenue-card" aria-label="Investments">
    <p className="dashboard-section-label">Investments</p>
    <div className="revenue-heading"><div><h2>Cumulative Revenue</h2><strong>{naira(total, 0)}</strong></div>
      <div className="revenue-toggle" role="group" aria-label="Revenue period">
        <button aria-pressed={period === "monthly"} onClick={() => setPeriod("monthly")}>Monthly</button>
        <button aria-pressed={period === "yearly"} onClick={() => setPeriod("yearly")}>Yearly</button>
      </div>
    </div>
    <figure className="revenue-chart" aria-label={`${period === "monthly" ? "Monthly" : "Yearly"} revenue chart`}>
      <div className="revenue-axis">{[1, .75, .5, .25, 0].map((ratio) => <span key={ratio}>{(ceiling * ratio).toLocaleString("en-NG")}</span>)}</div>
      <div className="revenue-plot">
        {[0, 25, 50, 75, 100].map((top) => <span className="revenue-gridline" key={top} style={{ top: `${top}%` }} />)}
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polyline points={coordinates || "0,100 100,100"} fill="none" stroke="var(--gold)" strokeWidth="3" vectorEffect="non-scaling-stroke" /></svg>
      </div>
      <div className="revenue-labels" style={{ gridTemplateColumns: `repeat(${Math.max(points.length, 1)}, minmax(0, 1fr))` }}>{points.map((point) => <span key={point.label}>{point.label.toUpperCase()}</span>)}</div>
      <figcaption className="dashboard-sr-only">{points.length ? points.map((point) => `${point.label}: ${naira(point.amount)}`).join("; ") : "No revenue recorded."}</figcaption>
    </figure>
  </section>;
}
