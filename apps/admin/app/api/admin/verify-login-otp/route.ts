import { NextResponse } from "next/server";
import type { AdminSessionState } from "@/lib/contracts";
import { setAdminSession, setChangePasswordProof } from "@/lib/server/admin-cookies";
import { bodyOf, errorResponse, upstream } from "../_shared";

export async function POST(request: Request) {
  try {
    const { response, payload } = await upstream("admin/auth/verify-login-otp", await bodyOf(request));
    if (!response.ok || !payload.data) return NextResponse.json(payload, { status: response.status });
    const data = payload.data as Record<string, unknown>;
    if (data.nextAction === "CHANGE_INITIAL_ADMIN_PASSWORD") {
      const { changePasswordToken, expiresIn, ...safeData } = data as { changePasswordToken: string; expiresIn: number } & Record<string, unknown>;
      const next = NextResponse.json({ ...payload, data: safeData }, { status: response.status });
      setChangePasswordProof(next, changePasswordToken, expiresIn);
      return next;
    }
    const { accessToken, refreshToken, accessTokenExpiresIn, refreshTokenExpiresIn, admin, nextAction } = data as { accessToken: string; refreshToken: string; accessTokenExpiresIn: number; refreshTokenExpiresIn: number; admin: AdminSessionState["admin"]; nextAction: "OPEN_ADMIN_DASHBOARD" };
    const state: AdminSessionState = { admin, nextAction, accessTokenExpiresIn, refreshTokenExpiresIn };
    const next = NextResponse.json({ ...payload, data: state }, { status: response.status });
    setAdminSession(next, { accessToken, refreshToken, state });
    return next;
  } catch (error) { return errorResponse(error); }
}
