import { AdminShell } from "@/components/admin-dashboard";
import { AdminUserDetailScreen } from "@/components/admin-user-detail";
import { requireAdminSession } from "@/lib/server/session";

export default async function UserDetailPage({ params }: { params: Promise<{ userId: string }> }) {
  const session = await requireAdminSession();
  return <AdminShell session={session}><AdminUserDetailScreen userId={(await params).userId} /></AdminShell>;
}
