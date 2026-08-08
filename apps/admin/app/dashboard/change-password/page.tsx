import { AdminShell } from "@/components/admin-dashboard";
import { ChangePasswordScreen } from "@/components/change-password-screen";
import { requireAdminSession } from "@/lib/server/session";

export default async function ChangePasswordPage() {
  return <AdminShell session={await requireAdminSession()}><ChangePasswordScreen /></AdminShell>;
}
