import { AdminShell } from "@/components/admin-dashboard";
import { AdminPropertiesDirectory } from "@/components/admin-properties-directory";
import { requireAdminSession } from "@/lib/server/session";

export default async function AdminPropertiesPage() {
  const session = await requireAdminSession();
  return <AdminShell session={session}><AdminPropertiesDirectory /></AdminShell>;
}
