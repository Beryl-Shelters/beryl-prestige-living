import { AdminShell } from "@/components/admin-dashboard";
import { AdminReferrersDirectory } from "@/components/admin-referrers-directory";
import { requireAdminSession } from "@/lib/server/session";

export default async function ReferrersPage() {
  const session = await requireAdminSession();
  return <AdminShell session={session}><AdminReferrersDirectory /></AdminShell>;
}
