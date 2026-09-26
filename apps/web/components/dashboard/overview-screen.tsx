"use client";
/* Customer listing images are existing validated media URLs and are not optimized here. */
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useEffect, useState } from "react";
import { customerName, greeting, messageCount, naira, units } from "../../lib/dashboard-format";
import type { DashboardOverview } from "../../lib/dashboard-api";
import { DashboardIcon } from "./dashboard-icon";
import { useDashboard } from "./dashboard-provider";
import { RevenueChart } from "./revenue-chart";

function RecentMessages({ messages }: { messages: DashboardOverview["recent_messages"] }) {
  return <section className="dashboard-card recent-messages" aria-labelledby="recent-messages-title">
    <h2 id="recent-messages-title">Recent Messages</h2>
    {messages.length ? <><ul>{messages.map((message) => <li key={message.id}><Link className="recent-message-link" href={`/dashboard/messages?ticket=${encodeURIComponent(message.id)}`}><span className="recent-message-avatar" aria-hidden="true">{Array.from(message.subject.trim())[0]?.toUpperCase() ?? "M"}</span><span>{message.subject}</span><span aria-hidden="true">›</span></Link></li>)}</ul><Link className="recent-card-link" href="/dashboard/messages">See all messages</Link></> : <div className="dashboard-empty recent-messages-empty"><DashboardEmptyIcon kind="messages"/><h3>No messages yet</h3><Link href="/dashboard/messages">Go to messages</Link></div>}
  </section>;
}
function RecentListings({ listings }: { listings: DashboardOverview["recent_property_listings"] }) {
  return <section className="dashboard-card recent-listings" aria-labelledby="recent-listings-title">
    <header><h2 id="recent-listings-title">Recent Property Listings</h2>{listings.length>0&&<Link href="/dashboard/listings">See all listings</Link>}</header>
    {listings.length ? <ul>{listings.map((listing) => <li key={listing.id}><Link href={`/dashboard/listings/${listing.id}`}><span className="recent-listing-image">{listing.imageUrl?<img src={listing.imageUrl} alt=""/>:<DashboardIcon name="listings"/>}</span><span className="recent-listing-copy"><b className={`listing-status listing-status-${listing.status.toLowerCase()}`}>{listing.status}</b><strong>{listing.title}</strong><span>{naira(listing.priceMinor/100,0)}</span></span><span className="recent-listing-more" aria-hidden="true">•••</span></Link></li>)}</ul> : <div className="dashboard-empty recent-listings-empty"><DashboardEmptyIcon kind="listings"/><h3>No properties listed yet</h3><Link href="/dashboard/listings/new">List a property</Link></div>}
  </section>;
}
function DashboardEmptyIcon({kind}:{kind:"messages"|"listings"}){return <svg className="dashboard-empty-icon" viewBox="0 0 80 70" aria-hidden="true"><path d="M15 51 42 34l23 9-28 18Z" fill="#e5e9ef"/><rect x="27" y="20" width="35" height="27" rx="3" fill="#f4f6f9" stroke="#cbd2dc"/><circle cx="44" cy="30" r="5" fill="#b8c2cf"/><path d="M34 42c2-6 6-9 11-9s9 3 11 9" fill="#cbd2dc"/>{kind==="messages"&&<><path d="M12 31h17M16 24h14M55 14h13" stroke="#cbd2dc" strokeWidth="3" strokeLinecap="round"/><circle cx="67" cy="23" r="4" fill="#d5dbe3"/></>}</svg>}
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
      <span className="dashboard-icon-box" aria-hidden="true"><DashboardIcon name={card.icon} /></span><div><h2>{card.label}</h2><p>{card.value}</p></div>
    </section>)}</div>
    <div className="dashboard-upper"><RevenueChart revenue={overview.revenue} /><RecentMessages messages={overview.recent_messages} /></div>
    <RecentListings listings={overview.recent_property_listings} />
  </>;
}
