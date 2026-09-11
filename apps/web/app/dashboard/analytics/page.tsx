import { AnalyticsScreen } from "../../../components/dashboard/analytics-screen";
import "./analytics.css";

export const dynamic = "force-dynamic";
export default function AnalyticsPage() {
  return <AnalyticsScreen initialYear={new Date().getUTCFullYear()} />;
}
