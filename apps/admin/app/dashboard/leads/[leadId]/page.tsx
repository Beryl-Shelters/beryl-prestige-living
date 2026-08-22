import { AdminShell } from "@/components/admin-dashboard";
import { AdminLeadDetailScreen } from "@/components/admin-lead-detail";
import { requireAdminSession } from "@/lib/server/session";

export default async function LeadPage({ params }: { params: Promise<{ leadId: string }> }) {
  const session = await requireAdminSession();
  return <AdminShell session={session}><AdminLeadDetailScreen leadId={(await params).leadId} /></AdminShell>;
}
