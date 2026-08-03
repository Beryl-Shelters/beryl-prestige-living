import type { Metadata } from "next";
import { DashboardPlaceholder } from "@/components/dashboard/dashboard-placeholder";
export const metadata: Metadata = { title: "Seller dashboard" };
export default function SellerPage() { return <DashboardPlaceholder persona="seller" />; }
