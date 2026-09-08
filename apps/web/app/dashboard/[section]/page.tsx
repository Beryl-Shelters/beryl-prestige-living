import { notFound } from "next/navigation";
import { dashboardNavigation } from "../../../components/dashboard/navigation";

export default async function FutureDashboardSection({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const item = dashboardNavigation.find((entry) => entry.href === `/dashboard/${section}`);
  if (!item) notFound();
  return <section className="dashboard-placeholder"><h1>{item.label}</h1><p>Coming later in this rebuild</p></section>;
}
