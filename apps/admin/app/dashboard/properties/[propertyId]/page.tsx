import { AdminShell } from "@/components/admin-dashboard";
import { AdminPropertyDetailScreen } from "@/components/admin-property-detail";
import { safeAdminPropertyReturnPath } from "@/lib/admin-routes";
import { requireAdminSession } from "@/lib/server/session";

export default async function AdminPropertyPage({ params, searchParams }: { params: Promise<{ propertyId: string }>; searchParams: Promise<{ returnTo?: string | string[] }> }) {
  const session = await requireAdminSession();
  const [{ propertyId }, query] = await Promise.all([params, searchParams]);
  return <AdminShell session={session}><AdminPropertyDetailScreen propertyId={propertyId} backHref={safeAdminPropertyReturnPath(query.returnTo)} /></AdminShell>;
}
