import { requireAdminSession } from "@/lib/server/session";
import { AdminDashboard } from "@/components/admin-dashboard";
export default async function DashboardPage() { return <AdminDashboard session={await requireAdminSession()} />; }
