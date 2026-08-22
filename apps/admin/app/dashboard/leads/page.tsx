import { AdminShell } from "@/components/admin-dashboard";
import { AdminLeadsBoard } from "@/components/admin-leads-board";
import { requireAdminSession } from "@/lib/server/session";

export default async function LeadsPage() {
  const session = await requireAdminSession();
  return <AdminShell session={session}><AdminLeadsBoard /></AdminShell>;
}
