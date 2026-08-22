"use client";

import { ArrowLeft, BadgeCheck, FileText, ImageIcon, MapPin, ShieldCheck, UserRound } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { AdminPropertyReviewDetail, ApiEnvelope } from "@/lib/contracts";

const display = (value?: string | null) => value?.replaceAll("_", " ").toLowerCase().replace(/(^|\s)\S/g, (letter) => letter.toUpperCase()) || "Not available";
const money = (value?: number | null) => value == null ? "Not available" : new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(value);
const dateTime = (value?: string | null) => value ? new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "Not available";
const fileSize = (value: number) => value >= 1_000_000 ? `${(value / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.ceil(value / 1_000))} KB`;

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return <div><dt>{label}</dt><dd>{value ?? "Not available"}</dd></div>;
}

export function AdminPropertyDetailScreen({ propertyId, backHref }: { propertyId: string; backHref: string }) {
  const [review, setReview] = useState<AdminPropertyReviewDetail | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [openingDocument, setOpeningDocument] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch(`/api/admin/marketplace/properties/${encodeURIComponent(propertyId)}`, { cache: "no-store" });
      const payload = await response.json() as ApiEnvelope<{ review: AdminPropertyReviewDetail }>;
      if (!response.ok || !payload.data?.review) throw new Error(payload.message || "Property could not be loaded.");
      setReview(payload.data.review);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Property could not be loaded."); }
    finally { setLoading(false); }
  }, [propertyId]);

  useEffect(() => { const task = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(task); }, [load]);

  const openDocument = async (documentId: string) => {
    if (openingDocument) return;
    setOpeningDocument(documentId); setError("");
    try {
      const response = await fetch(`/api/admin/marketplace/properties/${encodeURIComponent(propertyId)}/documents/${encodeURIComponent(documentId)}/access`, { cache: "no-store" });
      const payload = await response.json() as ApiEnvelope<{ access: { url: string } }>;
      if (!response.ok || !payload.data?.access?.url) throw new Error(payload.message || "Document could not be opened.");
      window.open(payload.data.access.url, "_blank", "noopener,noreferrer");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Document could not be opened."); }
    finally { setOpeningDocument(null); }
  };

  if (loading) return <section className="admin-property-detail"><div className="detail-heading skeleton" /><div className="property-detail-layout"><div className="detail-panel skeleton-card" /><div className="detail-panel skeleton-card" /></div></section>;
  if (error && !review) return <section className="admin-property-detail"><Link href={backHref as never} className="back-link"><ArrowLeft size={16} />Back to lead</Link><div className="lead-state alert alert-error" role="alert"><span>{error}</span><button type="button" onClick={() => void load()}>Try again</button></div></section>;
  if (!review) return null;

  const { property, summary, seller, mandate } = review;
  const cover = property.images.find((image) => image.isCover) ?? property.images[0] ?? null;
  return <article className="admin-property-detail">
    <Link href={backHref as never} className="back-link"><ArrowLeft size={16} />Back to lead</Link>
    <header className="property-detail-header"><div><p className="eyebrow">Property {summary.referenceId}</p><h1>{property.title}</h1><p><MapPin size={15} />{property.publicLocation || "Location unavailable"}</p></div><span className={`property-status status-${summary.status.toLowerCase()}`}>{display(summary.status)}</span></header>
    {error ? <div className="alert alert-error" role="alert">{error}</div> : null}

    <div className="property-detail-layout">
      <div className="property-detail-main">
        <section className="detail-panel"><div className="panel-heading"><h2>Media</h2><span>{summary.photoCount} photo{summary.photoCount === 1 ? "" : "s"}</span></div>{cover ? <div className="property-cover" role="img" aria-label={`Cover photo for ${property.title}`} style={{ backgroundImage: `url(${cover.url})` }} /> : <div className="property-cover property-cover-empty"><ImageIcon aria-hidden /><span>No property images</span></div>}{property.images.length > 1 ? <div className="property-thumbnails">{property.images.map((image) => <div key={image.id} role="img" aria-label={`${property.title} photo ${image.order + 1}`} style={{ backgroundImage: `url(${image.url})` }}>{image.isCover ? <span>Cover</span> : null}</div>)}</div> : null}</section>

        <section className="detail-panel"><h2>Property information</h2><strong className="property-price">{money(property.askingPrice)}{property.negotiable ? <small>Negotiable</small> : null}</strong><p className="property-description">{property.description || "No description supplied."}</p><dl className="property-facts"><Fact label="Public location" value={property.publicLocation} /><Fact label="Private address" value={property.fullAddress} /><Fact label="Category" value={display(property.propertyCategory)} /><Fact label="Property type" value={display(property.propertyType)} /><Fact label="Ownership" value={display(property.ownershipType)} /><Fact label="Condition" value={display(property.condition)} /><Fact label="Furnishing" value={display(property.furnishing)} /><Fact label="Bedrooms" value={property.bedrooms} /><Fact label="Bathrooms" value={property.bathrooms} /><Fact label="Toilets" value={property.toilets} /><Fact label="Parking spaces" value={property.parkingSpaces ?? property.parkingCapacity} /><Fact label="Floors" value={property.numberOfFloors} /></dl>{property.amenities.length ? <div className="property-amenities"><h3>Amenities</h3><div>{property.amenities.map((amenity) => <span key={amenity}>{amenity}</span>)}</div></div> : null}</section>

        <section className="detail-panel"><div className="panel-heading"><h2>Documents</h2><span>{review.documents.length}</span></div>{review.documents.length ? <div className="property-documents">{review.documents.map((document) => <div key={document.id}><FileText aria-hidden /><div><strong>{document.displayName}</strong><span>{display(document.documentType)} · {fileSize(document.sizeBytes)} · {dateTime(document.uploadedAt)}</span></div><button type="button" disabled={Boolean(openingDocument)} onClick={() => void openDocument(document.id)}>{openingDocument === document.id ? "Opening…" : "Open securely"}</button></div>)}</div> : <p className="detail-empty">No supporting documents were uploaded.</p>}</section>
      </div>

      <aside className="property-detail-side">
        <section className="detail-panel"><h2>Seller</h2>{seller ? <div className="seller-summary"><span><UserRound aria-hidden /></span><div><strong>{seller.fullName || "Name unavailable"}</strong>{seller.emailVerified ? <small><BadgeCheck size={13} />Verified email</small> : null}</div><dl><Fact label="Email" value={seller.email} /><Fact label="Phone" value={seller.phone} /><Fact label="Account status" value={display(seller.accountStatus)} /></dl></div> : <p className="detail-empty">Seller information is unavailable.</p>}</section>
        <section className="detail-panel"><h2>Sales mandate</h2>{mandate ? <><p className="mandate-type"><ShieldCheck aria-hidden />{display(mandate.mandateType)}</p><dl className="side-facts"><Fact label="Seller name" value={mandate.sellerFullName} /><Fact label="Ownership confirmed" value={mandate.ownershipConfirmed ? "Yes" : "No"} /><Fact label="Mandate accepted" value={mandate.mandateAccepted ? "Yes" : "No"} /><Fact label="Accepted" value={dateTime(mandate.acceptedAt)} /><Fact label="Agreement version" value={mandate.agreementVersion} /><Fact label="Commission" value={mandate.commissionPercentage != null ? `${mandate.commissionPercentage}%` : money(mandate.commissionAmount)} /></dl></> : <p className="detail-empty">No Marketplace mandate is available.</p>}</section>
        <section className="detail-panel"><h2>Lifecycle</h2><dl className="side-facts"><Fact label="Status" value={display(summary.status)} /><Fact label="Submitted" value={dateTime(summary.submittedAt)} /><Fact label="Reviewed" value={dateTime(summary.reviewedAt)} /><Fact label="Published" value={dateTime(summary.publishedAt)} /><Fact label="Rejected" value={dateTime(summary.rejectedAt)} /><Fact label="Last updated" value={dateTime(summary.updatedAt)} /></dl>{review.rejectionFeedback ? <div className="rejection-feedback"><strong>Review feedback</strong><p>{review.rejectionFeedback}</p></div> : null}{review.history.length ? <div className="property-history"><h3>Review history</h3>{review.history.map((item) => <div key={item.id}><strong>{display(item.action)}</strong><span>{display(item.previousStatus)} → {display(item.newStatus)}</span><time dateTime={item.createdAt}>{dateTime(item.createdAt)}</time>{item.reason ? <p>{item.reason}</p> : null}</div>)}</div> : null}</section>
      </aside>
    </div>
  </article>;
}
