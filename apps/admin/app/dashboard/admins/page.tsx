import { redirect } from "next/navigation";
import { AdminManagement } from "@/components/admin-management";
import { AdminShell } from "@/components/admin-dashboard";
import { requireAdminSession } from "@/lib/server/session";
export default async function AdminsPage() { const session = await requireAdminSession(); if (session.admin.adminRole !== "SUPER_ADMIN") redirect("/dashboard"); return <AdminShell session={session}><AdminManagement /></AdminShell>; }
