import type { Metadata } from "next";
import { MarketplaceScreen } from "@/components/marketplace/marketplace-screen";
import type { MarketplacePageSearchParams } from "@/lib/marketplace";

export const metadata: Metadata = {
  title: "Property Marketplace",
  description: "Explore verified properties for sale across Nigeria with Beryl Shelter.",
  robots: { index: false, follow: false }
};

export default async function MarketplacePage({ searchParams }: { searchParams: Promise<MarketplacePageSearchParams> }) {
  const resolvedSearchParams = await searchParams;
  return <MarketplaceScreen key={JSON.stringify(resolvedSearchParams)} initialSearchParams={resolvedSearchParams} />;
}
