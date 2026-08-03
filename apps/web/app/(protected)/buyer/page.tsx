import type { Metadata } from "next";
import { DashboardPlaceholder } from "@/components/dashboard/dashboard-placeholder";
export const metadata: Metadata = { title: "Buyer dashboard" };
export default function BuyerPage() { return <DashboardPlaceholder persona="buyer" />; }
