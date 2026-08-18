"use client";

import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BadgeCheck, Building2, ChevronLeft, ChevronRight, Clock3, FileWarning, Images, RefreshCw } from "lucide-react";
import { ApiAlert } from "@/components/ui/feedback";
import { PersonaSwitcher } from "@/components/persona/persona-switcher";
import { useAuth } from "@/context/auth-provider";
import { customerApi } from "@/lib/api/client";
import type { SellerListingStatus, SellerListingSummary } from "@/lib/contracts";
import { formatNaira, humanizeMarketplaceValue } from "@/lib/marketplace";
import { sellerListingActionLabel, sellerListingRouteForAction, sellerListingTabs } from "@/lib/seller-listings";

const validStatuses: SellerListingStatus[] = ["ALL", "LIVE", "IN_REVIEW", "REJECTED", "DRAFT"];
const date = (value: string | null) => value ? new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value)) : null;
const statusLabel = (status: SellerListingSummary["status"]) => status === "IN_REVIEW" ? "In review" : humanizeMarketplaceValue(status);
const emptyCopy: Record<SellerListingStatus, { title: string; text: string }> = {
  ALL: { title: "No listings yet", text: "Your property listings will appear here." },
  LIVE: { title: "No live listings", text: "Published listings will appear here." },
  IN_REVIEW: { title: "No listings under review", text: "Listings you submit for review will appear here." },
  REJECTED: { title: "No rejected listings", text: "Listings needing changes will appear here." },
  DRAFT: { title: "No drafts", text: "Draft listings you start will appear here." }
};

function ListingCard({ item }: { item: SellerListingSummary }) {
  const activity = item.status === "LIVE" ? date(item.publishedAt) && `Published ${date(item.publishedAt)}` : item.status === "IN_REVIEW" ? date(item.submittedAt) && `Submitted ${date(item.submittedAt)}` : item.status === "REJECTED" ? date(item.rejectedAt) && `Rejected ${date(item.rejectedAt)}` : date(item.updatedAt) && `Updated ${date(item.updatedAt)}`;
  return <article className="seller-listing-card">
    <div className="seller-listing-image">{item.coverImage ? <Image src={item.coverImage.url} alt={item.title ? `${item.title} cover image` : "Property cover image"} fill sizes="(max-width: 767px) 100vw, 280px" /> : <div className="seller-listing-image-empty"><Building2 size={32} aria-hidden="true" /><span>Property image unavailable</span></div>}<span className="seller-photo-count"><Images size={14} aria-hidden="true" />{item.photoCount}</span></div>
    <div className="seller-listing-card-content"><div className="seller-listing-card-top"><span className={`seller-status seller-status-${item.status.toLowerCase().replace("_", "-")}`}>{item.status === "LIVE" ? <BadgeCheck size={14} aria-hidden="true" /> : item.status === "IN_REVIEW" ? <Clock3 size={14} aria-hidden="true" /> : item.status === "REJECTED" ? <FileWarning size={14} aria-hidden="true" /> : null}{statusLabel(item.status)}</span><span className="seller-reference">{item.referenceId}</span></div><h2>{item.title || "Untitled property"}</h2><p className="seller-listing-price">{item.askingPrice === null ? "Price to be added" : formatNaira(item.askingPrice)}</p>{item.status === "DRAFT" && item.currentStep ? <p className="seller-listing-step">Step: {humanizeMarketplaceValue(item.currentStep)}</p> : null}{item.status === "IN_REVIEW" && item.reviewProgress ? <p className="seller-listing-progress">Submitted · Under review</p> : null}{item.status === "REJECTED" && (item.rejectionFeedback || item.rejectionReason) ? <p className="seller-listing-feedback">{item.rejectionFeedback || item.rejectionReason}</p> : null}{activity ? <p className="seller-listing-activity"><Clock3 size={14} aria-hidden="true" />{activity}</p> : null}<Link className="btn btn-secondary seller-listing-action" href={sellerListingRouteForAction(item.nextAction, item.id)}>{sellerListingActionLabel(item.nextAction)}</Link></div>
  </article>;
}

function ListingsSkeleton() { return <div className="seller-listing-skeletons" aria-label="Loading listings">{Array.from({ length: 4 }, (_, index) => <div key={index} />)}</div>; }

export function SellerListingsScreen({ initialStatus = "ALL", initialPage = 1 }: { initialStatus?: SellerListingStatus; initialPage?: number }) {
  const router = useRouter();
  const { session, sessionLoading } = useAuth();
  const [personaSwitcherOpen, setPersonaSwitcherOpen] = useState(false);
  const status = validStatuses.includes(initialStatus) ? initialStatus : "ALL";
  const page = Math.max(1, initialPage);
  const isSeller = session?.activePersona === "SELLER_DEVELOPER";
  const query = useQuery({ queryKey: ["seller-marketplace-listings", status, page], queryFn: () => customerApi.sellerListings({ status, page, limit: 12 }), enabled: Boolean(isSeller) });
  const update = (nextStatus: SellerListingStatus, nextPage = 1) => {
    const params = new URLSearchParams();
    if (nextStatus !== "ALL") params.set("status", nextStatus);
    if (nextPage > 1) params.set("page", String(nextPage));
    router.replace(`/seller/listings${params.size ? `?${params}` : ""}` as Route);
  };
  const result = query.data?.data;
  if (!sessionLoading && !isSeller) return <main className="seller-listings-page"><section className="seller-listing-state"><Building2 size={38} aria-hidden="true" /><h1>Seller access required</h1><p>Switch to, or activate, your Seller profile to manage Marketplace listings.</p><button className="btn btn-primary" type="button" onClick={() => setPersonaSwitcherOpen(true)}>Switch profile</button></section><PersonaSwitcher open={personaSwitcherOpen} onClose={() => setPersonaSwitcherOpen(false)} /></main>;
  return <main className="seller-listings-page"><header className="seller-listings-header"><div><p className="seller-kicker">Marketplace</p><h1>My Listings</h1><p>Manage your property listings and track their status.</p></div></header><div className="seller-listing-tabs" role="tablist" aria-label="Listing status">{sellerListingTabs.map((tab) => <button key={tab.status} type="button" role="tab" aria-selected={status === tab.status} className={status === tab.status ? "is-active" : ""} onClick={() => update(tab.status)}>{tab.label}<span>{result?.counts[tab.countKey] ?? 0}</span></button>)}</div>{query.isLoading ? <ListingsSkeleton /> : null}{query.isError ? <section className="seller-listing-state" role="alert"><ApiAlert>We could not load your listings. Please try again.</ApiAlert><button className="btn btn-secondary" type="button" onClick={() => query.refetch()}><RefreshCw size={17} />Try again</button></section> : null}{result && !result.items.length ? <section className="seller-listing-state"><Building2 size={38} aria-hidden="true" /><h2>{emptyCopy[status].title}</h2><p>{emptyCopy[status].text}</p></section> : null}{result?.items.length ? <section className="seller-listing-grid" aria-live="polite">{result.items.map((item) => <ListingCard key={item.id} item={item} />)}</section> : null}{result && result.pagination.total_pages > 1 ? <nav className="seller-pagination" aria-label="Listings pages"><button type="button" aria-label="Previous page" disabled={page === 1} onClick={() => update(status, page - 1)}><ChevronLeft size={18} /></button><span>Page {page} of {result.pagination.total_pages}</span><button type="button" aria-label="Next page" disabled={page >= result.pagination.total_pages} onClick={() => update(status, page + 1)}><ChevronRight size={18} /></button></nav> : null}</main>;
}
