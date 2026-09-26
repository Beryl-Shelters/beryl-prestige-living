import { Suspense } from "react";
import { PublicPropertyDetailPage } from "../../../components/public/public-property-detail-page";
import "../../landing.css";
import "../public-buy.css";
import "../../mortgage-calculator/mortgage-calculator.css";
import "./property-detail.css";

export default async function PropertyDetailRoute({ params }: { params: Promise<{ propertyCode: string }> }) {
  const { propertyCode } = await params;
  return <Suspense fallback={<div className="property-detail-state" role="status">Loading property…</div>}><PublicPropertyDetailPage propertyCode={propertyCode}/></Suspense>;
}
