import { AdminLeadDetail } from "../../../../components/admin-lead-detail";

export default async function AdminLeadDetailPage({ params }: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await params;
  return <AdminLeadDetail leadId={leadId}/>;
}
