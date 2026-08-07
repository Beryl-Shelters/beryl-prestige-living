import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIES } from "@/lib/server/admin-cookies";
import { ChangeInitialPasswordScreen } from "@/components/change-initial-password-screen";
export default async function ChangeInitialPasswordPage() { if (!(await cookies()).get(ADMIN_COOKIES.changePassword)?.value) redirect("/login"); return <ChangeInitialPasswordScreen />; }
