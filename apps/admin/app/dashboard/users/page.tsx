import { AdminShell } from "@/components/admin-dashboard";
import { AdminUsersDirectory } from "@/components/admin-users-directory";
import { requireAdminSession } from "@/lib/server/session";

export default async function UsersPage() {
  const session = await requireAdminSession();
  return <AdminShell session={session}><AdminUsersDirectory /></AdminShell>;
}
