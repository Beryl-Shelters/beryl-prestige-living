import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { AdminSessionState } from "@/lib/contracts";
import { ADMIN_COOKIES, clearAdminCookies, setAdminSession } from "@/lib/server/admin-cookies";
import { errorResponse, upstream } from "../_shared";

export async function POST() {
  try {
    const jar = await cookies(); const refresh = jar.get(ADMIN_COOKIES.refresh)?.value;
    if (!refresh) return NextResponse.json({ success: false, message: "Session not found", code: "ADMIN_SESSION_NOT_FOUND" }, { status: 401 });
    const { response, payload } = await upstream("admin/auth/refresh", { refreshToken: refresh });
    if (!response.ok || !payload.data) { const next = NextResponse.json(payload, { status: response.status }); clearAdminCookies(next); return next; }
    const data = payload.data as { accessToken: string; refreshToken: string; accessTokenExpiresIn: number; refreshTokenExpiresIn: number };
    const state = JSON.parse(jar.get(ADMIN_COOKIES.state)?.value ?? "null") as AdminSessionState | null;
    const next = NextResponse.json({ success: true, message: payload.message, data: { accessTokenExpiresIn: data.accessTokenExpiresIn, refreshTokenExpiresIn: data.refreshTokenExpiresIn, nextAction: "OPEN_ADMIN_DASHBOARD" } });
    if (!state) { clearAdminCookies(next); return next; }
    setAdminSession(next, { accessToken: data.accessToken, refreshToken: data.refreshToken, state: { ...state, accessTokenExpiresIn: data.accessTokenExpiresIn, refreshTokenExpiresIn: data.refreshTokenExpiresIn } }); return next;
  } catch (error) { return errorResponse(error); }
}
