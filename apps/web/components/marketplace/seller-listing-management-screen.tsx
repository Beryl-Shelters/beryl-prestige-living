"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, FileText, Images, MapPin, RefreshCw } from "lucide-react";
import { ApiAlert } from "@/components/ui/feedback";
import { customerApi } from "@/lib/api/client";
import { apiErrorOf } from "@/lib/api/errors";
import { formatNaira, humanizeMarketplaceValue } from "@/lib/marketplace";
import { sellerListingActionLabel, sellerListingRouteForAction } from "@/lib/seller-listings";
import { reopenErrorMessage } from "@/lib/seller-w6";

const listingsRoute = "/seller/listings" as Route;

export function SellerListingManagementScreen({ propertyId }: { propertyId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["seller-marketplace-management", propertyId], queryFn: () => customerApi.sellerListingManagement(propertyId) });
  const reopen = useMutation({
    mutationFn: () => customerApi.reopenSellerProperty(propertyId),
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["seller-marketplace-listings"] }),
        queryClient.invalidateQueries({ queryKey: ["seller-marketplace-management", propertyId] }),
        queryClient.invalidateQueries({ queryKey: ["seller-draft", propertyId] }),
        queryClient.invalidateQueries({ queryKey: ["seller-review", propertyId] })
      ]);
      router.push(sellerListingRouteForAction(result.data.nextAction, propertyId));
    }
  });

  if (query.isLoading) return <main className="seller-management-page" aria-label="Loading listing status"><div className="seller-management-skeleton" /></main>;
  if (query.isError || !query.data?.data.management) return <main className="seller-management-page"><section className="seller-listing-state" role="alert"><ApiAlert>This listing is unavailable right now.</ApiAlert><button className="btn btn-secondary" type="button" onClick={() => query.refetch()}><RefreshCw size={17} />Try again</button><Link className="btn btn-secondary" href={listingsRoute}>Back to My Listings</Link></section></main>;

  const { management } = query.data.data;
  const { summary, property, documents, mandate } = management;
  const date = summary.status === "LIVE" ? summary.publishedAt : summary.status === "REJECTED" ? summary.rejectedAt : summary.submittedAt;
  const feedback = summary.rejectionFeedback || summary.rejectionReason || "Please review this listing before resubmitting.";
  const error = reopen.error ? reopenErrorMessage(apiErrorOf(reopen.error).code) : "";

  return (
    <main className="seller-management-page">
      <Link className="property-detail-back" href={listingsRoute}><ArrowLeft size={17} aria-hidden="true" />Back to My Listings</Link>
      <section className="seller-management-card">
        <div className="seller-management-heading"><div><span className={`seller-status seller-status-${summary.status.toLowerCase().replace("_", "-")}`}>{humanizeMarketplaceValue(summary.status)}</span><h1>{property.title || "Untitled property"}</h1><p>{summary.referenceId}</p></div>{property.askingPrice !== null ? <strong>{formatNaira(property.askingPrice)}</strong> : null}</div>
        {summary.status === "REJECTED" ? <section className="seller-management-feedback" aria-labelledby="rejection-feedback-title"><p className="seller-kicker">Changes needed</p><h2 id="rejection-feedback-title">Update your listing</h2><p>{feedback}</p><p className="seller-management-feedback-note">Make the relevant changes, then submit the same listing for review again.</p>{error ? <ApiAlert>{error}</ApiAlert> : null}<button className="btn btn-primary" type="button" disabled={reopen.isPending} aria-busy={reopen.isPending} onClick={() => reopen.mutate()}>{reopen.isPending ? "Opening listing…" : "Make Changes"}</button></section> : null}
        {summary.status === "IN_REVIEW" ? <section className="seller-management-review"><h2>Your listing is under review</h2><p>{summary.submittedAt ? `Submitted ${new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "long", year: "numeric" }).format(new Date(summary.submittedAt))}.` : "Your listing has been submitted."}</p></section> : null}
        {summary.status === "LIVE" ? <section className="seller-management-review"><h2>Your listing is live</h2><p>{date ? `Published ${new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "long", year: "numeric" }).format(new Date(date))}.` : "This listing is published."}</p></section> : null}
        <div className="seller-management-grid"><section><h2>Property information</h2><dl><div><dt>Public location</dt><dd><MapPin size={15} aria-hidden="true" />{property.publicLocation || "To be added"}</dd></div><div><dt>Full address</dt><dd>{property.fullAddress || "To be added"}</dd></div><div><dt>Type</dt><dd>{property.propertyType ? humanizeMarketplaceValue(property.propertyType) : "To be added"}</dd></div></dl></section><section><h2>Photos &amp; documents</h2><p><Images size={16} aria-hidden="true" />{property.images.length} photos</p><p><FileText size={16} aria-hidden="true" />{documents.length} supporting documents</p></section>{mandate ? <section><h2>Sales mandate</h2><p>{humanizeMarketplaceValue(mandate.mandateType)} mandate</p><p>{mandate.mandateAccepted ? "Accepted" : "Not accepted"}</p></section> : null}</div>
        {summary.status !== "REJECTED" ? <Link className="btn btn-primary" href={sellerListingRouteForAction(summary.nextAction, summary.id)}>{sellerListingActionLabel(summary.nextAction)}</Link> : null}
      </section>
    </main>
  );
}
