import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIES } from "@/lib/server/admin-cookies";
import { SetPasswordScreen } from "@/components/set-password-screen";
export default async function SetPasswordPage() { if (!(await cookies()).get(ADMIN_COOKIES.setupPassword)?.value) redirect("/login"); return <SetPasswordScreen />; }
