import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ADMIN_COOKIES, clearAdminCookies } from "@/lib/server/admin-cookies";
import { bodyOf, errorResponse, upstream } from "../_shared";
export async function POST(request: Request) {
  try {
    const jar = await cookies(); const proof = jar.get(ADMIN_COOKIES.changePassword)?.value;
    if (!proof) return NextResponse.json({ success: false, message: "Your password-change session has expired. Please log in again.", code: "INVALID_ADMIN_PASSWORD_CHANGE_TOKEN" }, { status: 401 });
    const { response, payload } = await upstream("admin/auth/complete-first-password-change", { ...(await bodyOf(request)), changePasswordToken: proof });
    const next = NextResponse.json(payload, { status: response.status }); if (response.ok) clearAdminCookies(next); return next;
  } catch (error) { return errorResponse(error); }
}
