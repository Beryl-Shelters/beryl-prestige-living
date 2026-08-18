import type { Metadata } from "next";
import { MarketplacePropertyDetailScreen } from "@/components/marketplace/property-detail-screen";

export const metadata: Metadata = {
  title: "Property details",
  robots: { index: true, follow: true }
};

export default async function MarketplacePropertyDetailPage({ params }: { params: Promise<{ propertyId: string }> }) {
  const { propertyId } = await params;
  return <MarketplacePropertyDetailScreen propertyId={propertyId} />;
}
