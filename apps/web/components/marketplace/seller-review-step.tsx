"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
import { ApiAlert } from "@/components/ui/feedback";
import { customerApi } from "@/lib/api/client";
import { apiErrorOf } from "@/lib/api/errors";
import type { SellerPropertyReview, SellerSubmissionResult } from "@/lib/contracts";
import { formatNaira, humanizeMarketplaceValue } from "@/lib/marketplace";
import { sellerListingRouteForAction, sellerSubmissionRouteForAction } from "@/lib/seller-listings";
import { incompleteSectionCopy } from "@/lib/seller-w5";

export function SellerReviewStep({ propertyId, onSubmitted }: { propertyId: string; onSubmitted?: (submission: SellerSubmissionResult) => void }) {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [missingSections, setMissingSections] = useState<string[]>([]);
  const [submission, setSubmission] = useState<SellerSubmissionResult | null>(null);
  const reviewQuery = useQuery({ queryKey: ["seller-review", propertyId], queryFn: () => customerApi.sellerReview(propertyId), enabled: !submission });

  const submit = async () => {
    if (pending) return;
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
  return (
    <section className="seller-editor-card seller-review" aria-labelledby="review-title">
      <div className="seller-editor-heading seller-review-heading"><p className="seller-kicker">Step 4</p><h2 id="review-title">Review your property listing</h2><p>This is how your property information will appear to buyers.</p></div>
      {error ? <ApiAlert>{error}</ApiAlert> : null}
      {missingSections.length ? <div className="seller-review-missing"><h3>Needs attention</h3><ul>{missingSections.map((section) => <li key={section}>{incompleteSectionCopy[section] ?? "Complete this section before submitting."} <Link href={sectionRoute(section, propertyId)}>Edit</Link></li>)}</ul></div> : null}
      <div className="seller-review-grid">
        <article>
          <div className="seller-review-section-heading"><h3>Property Information</h3><Link href={sellerListingRouteForAction("CONTINUE_PROPERTY_INFORMATION", propertyId)}>Edit</Link></div>
          <p className="seller-reference">{property.referenceId}</p><h4>{property.title || "Untitled property"}</h4>
          <p className="seller-review-price">{property.askingPrice === null ? "Price not provided" : formatNaira(property.askingPrice)}</p>
          {property.publicLocation ? <p>{property.publicLocation}</p> : null}
          <dl className="seller-review-facts">{factEntries(property).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
          {property.description ? <p>{property.description}</p> : null}
          {property.amenities.length ? <div className="seller-review-amenities">{property.amenities.map((amenity) => <span key={amenity}>{amenity}</span>)}</div> : null}
        </article>
        <article>
          <div className="seller-review-section-heading"><h3>Photos &amp; Documents</h3><Link href={sellerListingRouteForAction("CONTINUE_PHOTOS_DOCUMENTS", propertyId)}>Edit</Link></div>
          <p>{property.photoCount} {property.photoCount === 1 ? "photo" : "photos"}</p>
          {images.length ? <div className="seller-review-gallery">{images.map((image, index) => <div key={image.id} className={image.isCover ? "is-cover" : ""}><Image src={image.url} alt={`${property.title || "Property"} photo ${index + 1}`} fill sizes="(max-width: 767px) 50vw, 220px" />{image.isCover ? <span>Cover</span> : null}</div>)}</div> : <p>No photos available.</p>}
        </article>
        <article>
          <div className="seller-review-section-heading"><h3>Sales Mandate</h3><Link href={sellerListingRouteForAction("CONTINUE_SALES_MANDATE", propertyId)}>Edit</Link></div>
          {review.mandate ? <dl className="seller-review-facts"><div><dt>Mandate type</dt><dd>{review.mandate.mandateType === "EXCLUSIVE" ? "Exclusive Sales Mandate" : "Open Sales Mandate"}</dd></div><div><dt>Seller</dt><dd>{review.mandate.sellerFullName}</dd></div><div><dt>Ownership confirmed</dt><dd>{review.mandate.ownershipConfirmed ? "Yes" : "No"}</dd></div><div><dt>Mandate accepted</dt><dd>{review.mandate.mandateAccepted ? "Yes" : "No"}</dd></div></dl> : <p>Sales Mandate not completed.</p>}
        </article>
        <article className="seller-review-private"><h3>Seller-private information</h3><p>This address is not included in the public listing preview.</p><strong>{review.sellerPrivate.fullAddress || "Full address not provided"}</strong></article>
      </div>
      <div className="seller-submit-panel"><p>By submitting, you’re sending this listing to Beryl Shelter for review.</p><button className="btn btn-primary" type="button" disabled={pending} onClick={() => void submit()}>{pending ? "Submitting…" : "Submit for Review"}</button></div>
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
      <div className="seller-next-steps"><h3>What happens next</h3><ol><li><span>1</span>Our team reviews your listing.</li><li><span>2</span>You can follow its status in My Listings.</li><li><span>3</span>We’ll let you know if any changes are needed.</li></ol></div>
      <Link className="btn btn-primary" href={sellerSubmissionRouteForAction(submission.nextAction)}>Open My Listings</Link>
    </section>
  );
}

function sectionRoute(section: string, propertyId: string) {
  if (section === "PHOTOS") return sellerListingRouteForAction("CONTINUE_PHOTOS_DOCUMENTS", propertyId);
  if (section === "SALES_MANDATE") return sellerListingRouteForAction("CONTINUE_SALES_MANDATE", propertyId);
  return sellerListingRouteForAction("CONTINUE_PROPERTY_INFORMATION", propertyId);
}

function factEntries(property: SellerPropertyReview["buyerPreview"]): Array<[string, string]> {
  const facts: Array<[string, string | number | null]> = [
    ["Property type", property.propertyType ? humanizeMarketplaceValue(property.propertyType) : null],
    ["Condition", property.condition ? humanizeMarketplaceValue(property.condition) : null],
    ["Bedrooms", property.bedrooms], ["Bathrooms", property.bathrooms], ["Toilets", property.toilets],
    ["Parking", property.parkingSpaces ?? property.parkingCapacity], ["Floors", property.numberOfFloors]
  ];
  return facts.filter((entry): entry is [string, string | number] => entry[1] !== null).map(([label, value]) => [label, String(value)]);
}
