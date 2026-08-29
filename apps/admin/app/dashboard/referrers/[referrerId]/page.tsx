import { AdminShell } from "@/components/admin-dashboard";
import { AdminReferrerDetailScreen } from "@/components/admin-referrer-detail";
import { requireAdminSession } from "@/lib/server/session";

export default async function ReferrerDetailPage({ params }: { params: Promise<{ referrerId: string }> }) {
  const session = await requireAdminSession();
  return <AdminShell session={session}><AdminReferrerDetailScreen referrerId={(await params).referrerId} /></AdminShell>;
}
