import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ADMIN_COOKIES, clearAdminCookies } from "@/lib/server/admin-cookies";
import { errorResponse, upstream } from "../_shared";
export async function POST() {
  try {
    const jar = await cookies();
    const { response, payload } = await upstream("admin/auth/logout", { refreshToken: jar.get(ADMIN_COOKIES.refresh)?.value }, "POST", jar.get(ADMIN_COOKIES.access)?.value);
    const next = NextResponse.json(payload, { status: response.status });
    clearAdminCookies(next);
    return next;
  } catch (error) {
    const next = errorResponse(error);
    clearAdminCookies(next);
    return next;
  }
}
