"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bath, BedDouble, Car, CheckCircle2, ChevronLeft, ChevronRight, Eye, Images, MapPin, Toilet } from "lucide-react";
import { ApiAlert } from "@/components/ui/feedback";
import { customerApi } from "@/lib/api/client";
import { apiErrorOf } from "@/lib/api/errors";
import type { SellerPropertyReview, SellerSubmissionResult } from "@/lib/contracts";
import { formatNaira, humanizeMarketplaceValue } from "@/lib/marketplace";
import { sellerListingRouteForAction, sellerSubmissionRouteForAction } from "@/lib/seller-listings";
import { incompleteSectionCopy } from "@/lib/seller-w5";
import { validateSellerReview } from "@/lib/seller-wizard-validation";

export function SellerReviewStep({ propertyId, onSubmitted }: { propertyId: string; onSubmitted?: (submission: SellerSubmissionResult) => void }) {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [missingSections, setMissingSections] = useState<string[]>([]);
  const [submission, setSubmission] = useState<SellerSubmissionResult | null>(null);
  const [fullPreview, setFullPreview] = useState(false);
  const [activeImageId, setActiveImageId] = useState<string | null>(null);
  const submissionLocked = useRef(false);
  const reviewQuery = useQuery({ queryKey: ["seller-review", propertyId], queryFn: () => customerApi.sellerReview(propertyId), enabled: !submission });

  const submit = async () => {
    if (pending || submissionLocked.current) return;
    const review = reviewQuery.data?.data.review;
    if (review) {
      const validation = validateSellerReview(review);
      if (!validation.valid) {
        setMissingSections(validation.missingSections);
        setError("Your listing still needs attention before it can be submitted.");
        window.setTimeout(() => document.getElementById("seller-review-validation")?.focus(), 0);
        return;
      }
    }
    submissionLocked.current = true;
    setPending(true);
    setError("");
    setMissingSections([]);
    try {
      const response = await customerApi.submitSellerProperty(propertyId);
      setSubmission(response.data);
      onSubmitted?.(response.data);
      await Promise.all([
        queryClient.cancelQueries({ queryKey: ["seller-draft", propertyId], exact: true }),
        queryClient.cancelQueries({ queryKey: ["seller-review", propertyId], exact: true }),
        queryClient.invalidateQueries({ queryKey: ["seller-marketplace-listings"], refetchType: "all" }),
        queryClient.invalidateQueries({ queryKey: ["seller-marketplace-management", propertyId], refetchType: "all" })
      ]);
    } catch (caught) {
      const apiError = apiErrorOf(caught);
      if (apiError.code === "LISTING_SUBMISSION_INCOMPLETE") {
        setMissingSections(apiError.missingSections ?? []);
        setError("Your listing still needs attention before it can be submitted.");
      } else if (apiError.code === "LISTING_ALREADY_SUBMITTED") {
        setError("This listing has already been submitted for review.");
      } else if (apiError.code === "PROPERTY_NOT_EDITABLE") {
        setError("This listing can no longer be edited or submitted.");
      } else if (apiError.code === "MANDATE_ACCEPTANCE_REQUIRED") {
        setMissingSections(["SALES_MANDATE"]);
        setError("Complete and accept the Sales Mandate before submitting.");
      } else if (apiError.code === "PROPERTY_PHOTO_REQUIRED") {
        setMissingSections(["PHOTOS"]);
        setError("Add at least one valid property photo before submitting.");
      } else {
        setError("We could not submit your listing. Please try again.");
      }
      submissionLocked.current = false;
      setPending(false);
    }
  };

  if (submission) {
    return <SellerSubmissionSuccess submission={submission} />;
  }

  if (reviewQuery.isLoading) return <section className="seller-editor-card seller-review-loading" role="status" aria-live="polite"><span className="sr-only">Loading listing review…</span><div /><div /><div /></section>;
  if (reviewQuery.isError || !reviewQuery.data) return <section className="seller-editor-card"><ApiAlert>We could not load your listing review.</ApiAlert><button className="btn btn-secondary" type="button" onClick={() => reviewQuery.refetch()}>Try again</button></section>;

  const review = reviewQuery.data.data.review;
  const property = review.buyerPreview;
  const images = [...property.images].sort((first, second) => first.order - second.order);
  const coverIndex = Math.max(0, images.findIndex((image) => image.isCover));
  const selectedIndex = activeImageId ? images.findIndex((image) => image.id === activeImageId) : coverIndex;
  const activeIndex = selectedIndex >= 0 ? selectedIndex : coverIndex;
  const activeImage = images[activeIndex] ?? null;
  const initialDeposit = formatInitialDeposit(property);
  const moveImage = (direction: -1 | 1) => {
    if (images.length < 2) return;
    const nextIndex = (activeIndex + direction + images.length) % images.length;
    setActiveImageId(images[nextIndex].id);
  };
  return (
    <section className="seller-editor-card seller-review" aria-labelledby="review-title">
      <div className="seller-editor-heading seller-review-heading"><h2 id="review-title">Review your property listing</h2><p>Here is what we’ll show to buyers. Before you submit your listing, make sure to review the details.</p></div>
      <nav className="seller-review-edit-nav" aria-label="Edit listing sections">
        <span>Edit listing:</span>
        <Link aria-label="Edit property information" href={sellerListingRouteForAction("CONTINUE_PROPERTY_INFORMATION", propertyId)}>Property info</Link>
        <Link aria-label="Edit photos and documents" href={sellerListingRouteForAction("CONTINUE_PHOTOS_DOCUMENTS", propertyId)}>Photos &amp; documents</Link>
        <Link aria-label="Edit Sales Mandate" href={sellerListingRouteForAction("CONTINUE_SALES_MANDATE", propertyId)}>Sales mandate</Link>
      </nav>
      {error ? <div id="seller-review-validation" tabIndex={-1}><ApiAlert>{error}</ApiAlert></div> : null}
      {missingSections.length ? <div className="seller-review-missing"><h3>Needs attention</h3><ul>{missingSections.map((section) => <li key={section}>{incompleteSectionCopy[section] ?? "Complete this section before submitting."} <Link href={sectionRoute(section, propertyId)}>Edit</Link></li>)}</ul></div> : null}
      <article className={`seller-buyer-preview${fullPreview ? " is-expanded" : ""}`} aria-label="Buyer listing preview">
        <div className="seller-buyer-preview-image" data-cover-image={activeImage?.isCover ? "true" : "false"}>
          {activeImage ? <Image src={activeImage.url} alt={`${property.title || "Property"}${activeImage.isCover ? " cover" : ""} photo`} fill priority sizes="(max-width: 767px) calc(100vw - 56px), 430px" /> : <div className="seller-review-image-empty"><Images aria-hidden="true" size={34} /><span>Property image unavailable</span></div>}
          {activeImage?.isCover ? <span className="sr-only">Cover photo</span> : null}
          {fullPreview && images.length > 1 ? <><button className="seller-review-image-arrow is-previous" type="button" aria-label="Previous property photo" onClick={() => moveImage(-1)}><ChevronLeft aria-hidden="true" size={20} /></button><button className="seller-review-image-arrow is-next" type="button" aria-label="Next property photo" onClick={() => moveImage(1)}><ChevronRight aria-hidden="true" size={20} /></button></> : null}
          {activeImage && property.photoCount > 0 ? <span className="seller-review-photo-count"><Images aria-hidden="true" size={14} />{activeIndex + 1}/{property.photoCount}</span> : null}
        </div>
        <div className="seller-buyer-preview-body">
          <div className="seller-buyer-preview-price"><strong>{property.askingPrice === null ? "Price not provided" : formatNaira(property.askingPrice)}</strong>{property.negotiable ? <span>Negotiable</span> : null}</div>
          <h3>{property.title || "Untitled property"}</h3>
          {property.propertyType ? <span className="seller-buyer-preview-type">{humanizeMarketplaceValue(property.propertyType)}</span> : null}
          {property.publicLocation ? <p className="seller-buyer-preview-location"><MapPin aria-hidden="true" size={15} />{property.publicLocation}</p> : null}
          <div className="seller-buyer-preview-facts" aria-label="Property facts">
            {property.bedrooms !== null ? <span><BedDouble aria-hidden="true" size={15} />{countLabel(property.bedrooms, "Bed")}</span> : null}
            {property.bathrooms !== null ? <span><Bath aria-hidden="true" size={15} />{countLabel(property.bathrooms, "Bath")}</span> : null}
            {property.toilets !== null ? <span><Toilet aria-hidden="true" size={15} />{countLabel(property.toilets, "Toilet")}</span> : null}
            {(property.parkingSpaces ?? property.parkingCapacity) !== null ? <span><Car aria-hidden="true" size={15} />{countLabel((property.parkingSpaces ?? property.parkingCapacity)!, "Parking space")}</span> : null}
          </div>
          {fullPreview ? <div className="seller-buyer-preview-expanded">
            {property.description ? <section aria-labelledby="seller-preview-about"><h4 id="seller-preview-about">About this property</h4><p>{property.description}</p></section> : null}
            <section aria-labelledby="seller-preview-details"><h4 id="seller-preview-details">Property details</h4><dl className="seller-buyer-preview-details">
              {property.propertyType ? <div><dt>Type</dt><dd>{humanizeMarketplaceValue(property.propertyType)}</dd></div> : null}
              {property.propertyCategory ? <div><dt>Category</dt><dd>{humanizeMarketplaceValue(property.propertyCategory)}</dd></div> : null}
              {property.furnishing ? <div><dt>Furnishing</dt><dd>{humanizeMarketplaceValue(property.furnishing)}</dd></div> : null}
              {initialDeposit ? <div><dt>Initial deposit</dt><dd>{initialDeposit}</dd></div> : null}
              <div><dt>Reference ID</dt><dd>{property.referenceId}</dd></div>
            </dl></section>
            {property.amenities.length ? <section aria-labelledby="seller-preview-amenities"><h4 id="seller-preview-amenities">What’s included</h4><div className="seller-review-amenities">{property.amenities.map((amenity) => <span key={amenity}>{amenity}</span>)}</div></section> : null}
          </div> : null}
          <button className="seller-buyer-preview-toggle" type="button" aria-expanded={fullPreview} onClick={() => setFullPreview((current) => !current)}><Eye aria-hidden="true" size={16} />{fullPreview ? "Change view" : "See the full buyer view"}</button>
        </div>
      </article>
      <div className="seller-editor-actions seller-editor-footer-actions seller-review-footer"><div><Link className="btn btn-secondary" href={sellerListingRouteForAction("CONTINUE_SALES_MANDATE", propertyId)}>Back</Link><button className="btn btn-primary" type="button" disabled={pending} onClick={() => void submit()}>{pending ? "Submitting…" : "Submit for Review"}</button></div></div>
    </section>
  );
}

export function SellerSubmissionSuccess({ submission }: { submission: SellerSubmissionResult }) {
  const successHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { successHeading.current?.focus(); }, []);
  return (
    <section className="seller-editor-card seller-submit-success" aria-labelledby="submission-success-title">
      <CheckCircle2 className="seller-success-icon" size={56} aria-hidden="true" />
      <p className="seller-kicker">Listing submitted</p>
      <h2 id="submission-success-title" ref={successHeading} tabIndex={-1}>Your listing has been submitted to our team</h2>
      <p>We’ll review the information you provided and show its latest status in My Listings.</p>
      <dl><div><dt>Reference ID</dt><dd>{submission.referenceId}</dd></div><div><dt>Status</dt><dd>In review</dd></div></dl>
      <div className="seller-next-steps"><h3 className="bold">What happens next</h3><ol><li><span>1</span>Our team reviews your listing.</li><li><span>2</span>You can follow its status in My Listings.</li><li><span>3</span>We’ll let you know if any changes are needed.</li></ol></div>
      <Link className="btn btn-primary" href={sellerSubmissionRouteForAction(submission.nextAction)}>Open My Listings</Link>
    </section>
  );
}

function sectionRoute(section: string, propertyId: string) {
  if (section === "PHOTOS") return sellerListingRouteForAction("CONTINUE_PHOTOS_DOCUMENTS", propertyId);
  if (section === "SALES_MANDATE") return sellerListingRouteForAction("CONTINUE_SALES_MANDATE", propertyId);
  return sellerListingRouteForAction("CONTINUE_PROPERTY_INFORMATION", propertyId);
}

function countLabel(value: number, singular: string) {
  return `${value} ${singular}${value === 1 ? "" : "s"}`;
}

function formatInitialDeposit(property: SellerPropertyReview["buyerPreview"]) {
  const deposit = property.initialDeposit;
  if (!deposit || deposit.value === null) return null;
  return deposit.type === "PERCENTAGE" ? `${deposit.value}%` : formatNaira(deposit.value);
}
