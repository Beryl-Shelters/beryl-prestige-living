import type { NextResponse } from "next/server";
import type { AdminSessionState } from "@/lib/contracts";

export const ADMIN_COOKIES = { access: "beryl_admin_access", refresh: "beryl_admin_refresh", changePassword: "beryl_admin_change_password", state: "beryl_admin_state" } as const;
const secureOptions = (maxAge: number) => ({ httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge });
export function setAdminSession(response: NextResponse, input: { accessToken: string; refreshToken: string; state: AdminSessionState }) {
  response.cookies.set(ADMIN_COOKIES.access, input.accessToken, secureOptions(input.state.accessTokenExpiresIn));
  response.cookies.set(ADMIN_COOKIES.refresh, input.refreshToken, secureOptions(input.state.refreshTokenExpiresIn));
  response.cookies.set(ADMIN_COOKIES.state, JSON.stringify(input.state), secureOptions(input.state.refreshTokenExpiresIn));
}
export function setChangePasswordProof(response: NextResponse, token: string, expiresIn: number) { response.cookies.set(ADMIN_COOKIES.changePassword, token, secureOptions(expiresIn)); }
export function clearAdminCookies(response: NextResponse) { Object.values(ADMIN_COOKIES).forEach((name) => response.cookies.delete(name)); }
