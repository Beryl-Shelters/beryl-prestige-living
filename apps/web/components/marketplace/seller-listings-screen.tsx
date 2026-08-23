"use client";

import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, ChevronLeft, ChevronRight, Ellipsis, Images, Plus, RefreshCw } from "lucide-react";
import { ApiAlert } from "@/components/ui/feedback";
import { PersonaSwitcher } from "@/components/persona/persona-switcher";
import { useAuth } from "@/context/auth-provider";
import { customerApi } from "@/lib/api/client";
import type { SellerListingStatus, SellerListingStep, SellerListingSummary } from "@/lib/contracts";
import { formatNaira, humanizeMarketplaceValue } from "@/lib/marketplace";
import { sellerListingActionLabel, sellerListingRouteForAction, sellerListingTabs } from "@/lib/seller-listings";
import { SellerDeleteDraftDialog } from "./seller-delete-draft-dialog";

const validStatuses: SellerListingStatus[] = ["ALL", "LIVE", "IN_REVIEW", "REJECTED", "DRAFT"];
const date = (value: string | null) => value ? new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short" }).format(new Date(value)) : null;
const statusLabel = (status: SellerListingSummary["status"]) => status === "IN_REVIEW" ? "In Review" : humanizeMarketplaceValue(status);
const stepDetails: Record<SellerListingStep, { number: number; label: string }> = {
  PROPERTY_INFORMATION: { number: 1, label: "Property Information" },
  PHOTOS_DOCUMENTS: { number: 2, label: "Photos & Documents" },
  SALES_MANDATE: { number: 3, label: "Sales Mandate" },
  REVIEW: { number: 4, label: "Review" },
};
const emptyCopy: Record<SellerListingStatus, { title: string; text: string }> = {
  ALL: { title: "No listings yet", text: "Start your first property listing and save it as you go." },
  LIVE: { title: "No live listings", text: "Published listings will appear here." },
  IN_REVIEW: { title: "No listings under review", text: "Listings you submit for review will appear here." },
  REJECTED: { title: "No rejected listings", text: "Listings needing changes will appear here." },
  DRAFT: { title: "No drafts", text: "Draft listings you start will appear here." },
};

function activityCopy(item: SellerListingSummary) {
  if (item.status === "LIVE") return date(item.publishedAt) ? `Published ${date(item.publishedAt)}` : "Published";
  if (item.status === "IN_REVIEW") return date(item.submittedAt) ? `Sent ${date(item.submittedAt)}` : "Submitted for review";
  if (item.status === "REJECTED") return date(item.rejectedAt) ? `Changes requested ${date(item.rejectedAt)}` : "Changes requested";
  return date(item.updatedAt) ? `Edited ${date(item.updatedAt)}` : "Draft saved";
}

function ListingActions({ item, onDelete }: { item: SellerListingSummary; onDelete: () => void }) {
  const route = sellerListingRouteForAction(item.nextAction, item.id);
  return <details className="seller-row-menu"><summary aria-label={`Open actions for ${item.title || "Untitled Listing"}`}><Ellipsis size={23} /></summary><div>
    {item.status === "LIVE" ? <Link href={route}>See buyer view</Link> : null}
    {item.status === "IN_REVIEW" ? <Link href={route}>View details</Link> : null}
    {item.status === "REJECTED" ? <><Link href={route}>Fix &amp; Resend</Link><Link href={`/seller/listings/${item.id}` as Route}>View details</Link></> : null}
    {item.status === "DRAFT" ? <><Link href={route}>Continue editing</Link><button type="button" className="seller-menu-delete" onClick={onDelete}>Delete draft</button></> : null}
  </div></details>;
}

function ListingRow({ item, onDelete }: { item: SellerListingSummary; onDelete: () => void }) {
  const step = item.currentStep ? stepDetails[item.currentStep] : null;
  const route = sellerListingRouteForAction(item.nextAction, item.id);
  return <article className="seller-listing-row">
    <div className="seller-row-main">
      <div className="seller-row-image">{item.coverImage ? <Image src={item.coverImage.url} alt={item.title ? `${item.title} cover image` : "Property cover image"} fill sizes="120px" /> : <Building2 size={30} aria-label="Property image unavailable" />} {item.photoCount > 0 ? <span><Images size={13} />{item.photoCount}</span> : null}</div>
      <div className="seller-row-copy"><span className={`seller-status seller-status-${item.status.toLowerCase().replace("_", "-")}`}><i aria-hidden="true" />{statusLabel(item.status)}</span><h2>{item.title || "Untitled Listing"}</h2>{item.askingPrice !== null ? <p className="seller-listing-price">{formatNaira(item.askingPrice)}</p> : null}<p className="seller-row-meta">{activityCopy(item)}</p></div>
      <ListingActions item={item} onDelete={onDelete} />
    </div>
    {item.status === "DRAFT" && step ? <div className="seller-draft-progress"><div><strong>Step {step.number} of 4: {step.label}</strong><span className="seller-draft-track" aria-label={`${step.number} of 4 steps complete`}>{Array.from({ length: 4 }, (_, index) => <i key={index} className={index < step.number ? "is-complete" : ""} />)}</span></div><Link className="btn btn-secondary" href={route}>{sellerListingActionLabel(item.nextAction)}</Link></div> : null}
  </article>;
}

function ListingsSkeleton() { return <div className="seller-listing-skeletons" aria-label="Loading listings">{Array.from({ length: 4 }, (_, index) => <div key={index} />)}</div>; }

export function SellerListingsScreen({ initialStatus = "ALL", initialPage = 1 }: { initialStatus?: SellerListingStatus; initialPage?: number }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { session, sessionLoading } = useAuth();
  const [personaSwitcherOpen, setPersonaSwitcherOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SellerListingSummary | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const status = validStatuses.includes(initialStatus) ? initialStatus : "ALL";
  const page = Math.max(1, initialPage);
  const sellerPersona = session?.personas.find((persona) => persona.type === "SELLER_DEVELOPER");
  const isSellerActive = session?.activePersona === "SELLER_DEVELOPER";
  const isSellerReady = isSellerActive && sellerPersona?.onboardingStatus === "COMPLETED";
  const query = useQuery({ queryKey: ["seller-marketplace-listings", status, page], queryFn: () => customerApi.sellerListings({ status, page, limit: 12 }), enabled: Boolean(isSellerReady) });
  const deleteMutation = useMutation({
    mutationFn: (propertyId: string) => customerApi.deleteSellerDraft(propertyId),
    onSuccess: async () => {
      setDeleteTarget(null);
      setDeleteError("");
      await queryClient.invalidateQueries({ queryKey: ["seller-marketplace-listings"] });
    },
    onError: () => setDeleteError("We could not delete this draft. Please try again.")
  });
  useEffect(() => {
    if (!sessionLoading && isSellerActive && sellerPersona?.onboardingStatus !== "COMPLETED") router.replace("/onboarding/seller");
  }, [isSellerActive, router, sellerPersona?.onboardingStatus, sessionLoading]);
  const update = (nextStatus: SellerListingStatus, nextPage = 1) => {
    const params = new URLSearchParams();
    if (nextStatus !== "ALL") params.set("status", nextStatus);
    if (nextPage > 1) params.set("page", String(nextPage));
    router.replace(`/seller/listings${params.size ? `?${params}` : ""}` as Route);
  };
  const result = query.data?.data;
  if (!sessionLoading && isSellerActive && sellerPersona?.onboardingStatus !== "COMPLETED") return <main className="seller-listings-page"><section className="seller-listing-state"><Building2 size={38} aria-hidden="true" /><h1>Complete your Seller profile</h1><p>Taking you to Seller onboarding before you manage listings.</p></section></main>;
  if (!sessionLoading && !isSellerReady) {
    const activated = Boolean(sellerPersona?.activated ?? sellerPersona);
    return <main className="seller-listings-page"><section className="seller-listing-state"><Building2 size={38} aria-hidden="true" /><h1>{activated ? "Switch to your Seller profile" : "Activate your Seller profile"}</h1><p>{activated ? "Your Seller profile is available but is not the active profile." : "Activate Seller mode before managing Marketplace listings."}</p><button className="btn btn-primary" type="button" onClick={() => setPersonaSwitcherOpen(true)}>{activated ? "Switch profile" : "Activate Seller"}</button></section><PersonaSwitcher open={personaSwitcherOpen} onClose={() => setPersonaSwitcherOpen(false)} /></main>;
  }
  const totalPages = Math.max(1, result?.pagination.total_pages ?? 1);
  const pageChoices = Array.from({ length: Math.min(totalPages, 5) }, (_, index) => index + 1);
  return <main className="seller-listings-page">
    <header className="seller-listings-header"><h1>My Listings</h1><Link className="seller-list-property" href="/seller/listings/new"><Plus size={19} />List property</Link></header>
    <div className="seller-listing-tabs" role="tablist" aria-label="Listing status">{sellerListingTabs.map((tab) => <button key={tab.status} type="button" role="tab" aria-selected={status === tab.status} className={status === tab.status ? "is-active" : ""} onClick={() => update(tab.status)}>{tab.label}<span>{result?.counts[tab.countKey] ?? 0}</span></button>)}</div>
    {query.isLoading ? <ListingsSkeleton /> : null}
    {query.isError ? <section className="seller-listing-state" role="alert"><ApiAlert>We could not load your listings. Please try again.</ApiAlert><button className="btn btn-secondary" type="button" onClick={() => query.refetch()}><RefreshCw size={17} />Try again</button></section> : null}
    {result && !result.items.length ? <section className="seller-listing-state seller-listing-empty"><Building2 size={34} aria-hidden="true" /><h2>{emptyCopy[status].title}</h2><p>{emptyCopy[status].text}</p><Link className="btn btn-primary" href="/seller/listings/new"><Plus size={17} />List property</Link></section> : null}
    {result?.items.length ? <section className="seller-listing-rows" aria-live="polite">{result.items.map((item) => <ListingRow key={item.id} item={item} onDelete={() => { setDeleteError(""); setDeleteTarget(item); }} />)}</section> : null}
    {result ? <nav className="seller-pagination" aria-label="Listings pages"><strong>Page {page} of {totalPages}</strong><div><button type="button" aria-label="Previous page" disabled={page === 1} onClick={() => update(status, page - 1)}><ChevronLeft size={18} /></button>{pageChoices.map((choice) => <button key={choice} type="button" aria-current={choice === page ? "page" : undefined} onClick={() => update(status, choice)}>{choice}</button>)}<button type="button" aria-label="Next page" disabled={page >= totalPages} onClick={() => update(status, page + 1)}><ChevronRight size={18} /></button></div></nav> : null}
    <SellerDeleteDraftDialog open={Boolean(deleteTarget)} pending={deleteMutation.isPending} error={deleteError} onCancel={() => { if (!deleteMutation.isPending) { setDeleteTarget(null); setDeleteError(""); } }} onConfirm={() => { if (deleteTarget && !deleteMutation.isPending) deleteMutation.mutate(deleteTarget.id); }} />
  </main>;
}
