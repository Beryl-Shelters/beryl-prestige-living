import { Suspense } from "react";
import { PublicSellPage } from "../../components/public/public-sell-page";
import "../landing.css";
import "./sell.css";

export default function SellRoute() {
  return (
    <Suspense fallback={null}>
      <PublicSellPage />
    </Suspense>
  );
}
