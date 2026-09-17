import { Suspense } from "react";
import { PublicBuyPage } from "../../components/public/public-buy-page";
import "../landing.css";
import "./public-buy.css";

export default function BuyRoute() {
  return <Suspense fallback={<div className="buy-loading-page" role="status">Loading properties…</div>}><PublicBuyPage /></Suspense>;
}
