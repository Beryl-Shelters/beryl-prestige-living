import type { Metadata } from "next";
import { SellerListingsScreen } from "@/components/marketplace/seller-listings-screen";
import { SellerShell } from "@/components/marketplace/seller-shell";
import type { SellerListingStatus } from "@/lib/contracts";

export const metadata: Metadata = { title: "My Listings", robots: { index: false, follow: false } };

export default async function SellerListingsPage({ searchParams }: { searchParams: Promise<{ status?: string; page?: string }> }) {
  const params = await searchParams;
  const allowed: SellerListingStatus[] = ["ALL", "LIVE", "IN_REVIEW", "REJECTED", "DRAFT"];
  const status = allowed.includes(params.status as SellerListingStatus) ? params.status as SellerListingStatus : "ALL";
  const page = Number.isSafeInteger(Number(params.page)) && Number(params.page) > 0 ? Number(params.page) : 1;
  return <SellerShell><SellerListingsScreen initialStatus={status} initialPage={page} /></SellerShell>;
}
