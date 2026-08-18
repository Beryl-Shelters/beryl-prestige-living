import type { Metadata } from "next";
import { SellerListingManagementScreen } from "@/components/marketplace/seller-listing-management-screen";

export const metadata: Metadata = { title: "Listing status", robots: { index: false, follow: false } };
export default async function SellerListingManagementPage({ params }: { params: Promise<{ propertyId: string }> }) {
  const { propertyId } = await params;
  return <SellerListingManagementScreen propertyId={propertyId} />;
}
