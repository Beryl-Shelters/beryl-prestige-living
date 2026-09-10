"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { customerName, greeting, messageCount, naira, units } from "../../lib/dashboard-format";
import type { DashboardOverview } from "../../lib/dashboard-api";
import { DashboardIcon } from "./dashboard-icon";
import { useDashboard } from "./dashboard-provider";
import { RevenueChart } from "./revenue-chart";

function RecentMessages({ messages }: { messages: DashboardOverview["recent_messages"] }) {
  return <section className="dashboard-card recent-messages" aria-labelledby="recent-messages-title">
    <h2 id="recent-messages-title"><span className="dashboard-icon-box"><DashboardIcon name="messages" /></span>Recent Messages</h2>
    {messages.length ? <ul>{messages.map((message) => <li key={message.id}>{message.subject}</li>)}</ul> : <p>No messages</p>}
    <Link href="/dashboard/messages">View Messages</Link>
  </section>;
}
function RecentListings({ listings }: { listings: DashboardOverview["recent_property_listings"] }) {
  return <section className="dashboard-card recent-listings" aria-labelledby="recent-listings-title">
    <h2 id="recent-listings-title" className="dashboard-section-label">Recent Property Listings</h2>
    <div className="recent-listings-body">{listings.length ? <ul>{listings.map((listing) => <li key={listing.id}><Link href={`/dashboard/listings/${listing.id}`}>{listing.title}</Link></li>)}</ul> : <p>No properties listed</p>}</div>
  </section>;
}
export function OverviewScreen() {
  const { overview } = useDashboard();
  const [salutation, setSalutation] = useState(() => greeting());
  useEffect(() => { const timer = setInterval(() => setSalutation(greeting()), 60000); return () => clearInterval(timer); }, []);
  const name = customerName(overview.customer);
  const cards = [
    { label: "Total Investments", value: naira(overview.summary.total_investments), icon: "investments" },
    { label: "Properties Owned", value: units(overview.summary.properties_owned), icon: "listings" },
    { label: "Referral Earnings", value: naira(overview.summary.referral_earnings), icon: "referrals" },
    { label: "New Messages", value: messageCount(overview.summary.new_messages), icon: "messages" },
  ];
  return <>
    <h1 className="dashboard-greeting">{salutation}{name ? `, ${name}` : ""}!</h1>
    <div className="dashboard-kpis" aria-label="Overview summary">{cards.map((card) => <section className="dashboard-card dashboard-kpi" key={card.label} aria-label={card.label}>
      <h2><span className="dashboard-icon-box"><DashboardIcon name={card.icon} /></span>{card.label}</h2><p>{card.value}</p>
    </section>)}</div>
    <div className="dashboard-upper"><RevenueChart revenue={overview.revenue} /><RecentMessages messages={overview.recent_messages} /></div>
    <RecentListings listings={overview.recent_property_listings} />
  </>;
}
