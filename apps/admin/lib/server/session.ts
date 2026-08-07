import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { AdminSessionState } from "@/lib/contracts";
import { ADMIN_COOKIES } from "./admin-cookies";

export async function adminSessionState(): Promise<AdminSessionState | null> {
  const jar = await cookies();
  if (!jar.get(ADMIN_COOKIES.access)?.value || jar.get(ADMIN_COOKIES.changePassword)?.value) return null;
  try { return JSON.parse(jar.get(ADMIN_COOKIES.state)?.value ?? "") as AdminSessionState; } catch { return null; }
}
export async function requireAdminSession() { const session = await adminSessionState(); const jar = await cookies(); if (jar.get(ADMIN_COOKIES.changePassword)?.value) redirect("/change-initial-password"); if (!session) redirect("/login"); return session; }
export async function redirectSignedInAdmin() { const jar = await cookies(); if (jar.get(ADMIN_COOKIES.changePassword)?.value) redirect("/change-initial-password"); if (await adminSessionState()) redirect("/dashboard"); }
