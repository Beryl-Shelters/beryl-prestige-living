import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import type { ApiSuccess, CustomerSessionState } from "@/lib/contracts";
import { clearSessionCookies, SESSION_COOKIES, setSessionCookies } from "@/lib/server/session-cookies";

type Context = { params: Promise<{ path: string[] }> };
type BackendLoginData = CustomerSessionState & {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresIn: number;
  refreshTokenExpiresIn: number;
};

const allowed = new Set([
  "POST auth/register",
  "POST auth/verify-email",
  "POST auth/resend-verification-otp",
  "POST auth/login",
  "POST auth/forgot-password",
  "POST auth/verify-password-reset-otp",
  "POST auth/reset-password",
  "POST auth/refresh",
  "POST auth/logout",
  "PATCH auth/change-password",
  "GET onboarding/status",
  "PATCH onboarding/buyer",
  "PATCH onboarding/seller",
  "GET personas",
  "POST personas/activate",
  "PATCH personas/active"
]);

const protectedPaths = new Set([
  "auth/logout",
  "auth/change-password",
  "onboarding/status",
  "onboarding/buyer",
  "onboarding/seller",
  "personas",
  "personas/activate",
  "personas/active"
]);

const apiBase = () => (process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000/api/v1").replace(/\/$/, "");

const backendFetch = (path: string, method: string, body: unknown, accessToken?: string) =>
  fetch(`${apiBase()}/${path}`, {
    method,
    cache: "no-store",
    headers: {
      accept: "application/json",
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {})
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });

const readJson = async (request: NextRequest) => {
  if (request.method === "GET") return undefined;
  try {
    return await request.json();
  } catch {
    return {};
  }
};

const refreshSession = async (refreshToken: string) => {
  const response = await backendFetch("auth/refresh", "POST", { refreshToken });
  const payload = await response.json();
  return { response, payload };
};

const handle = async (request: NextRequest, context: Context) => {
  const path = (await context.params).path.join("/");
  if (!allowed.has(`${request.method} ${path}`)) {
    return NextResponse.json({ success: false, message: "Route not found" }, { status: 404 });
  }

  const cookieStore = await cookies();
  let body = await readJson(request);
  let accessToken = cookieStore.get(SESSION_COOKIES.access)?.value;
  const refreshToken = cookieStore.get(SESSION_COOKIES.refresh)?.value;

  if (path === "auth/refresh") {
    if (!refreshToken) return NextResponse.json({ success: false, message: "Session not found", code: "SESSION_NOT_FOUND" }, { status: 401 });
    const refreshed = await refreshSession(refreshToken);
    if (!refreshed.response.ok) return NextResponse.json(refreshed.payload, { status: refreshed.response.status });
    const tokenData = refreshed.payload.data as BackendLoginData;
    const next = NextResponse.json({ success: true, message: refreshed.payload.message, data: { refreshed: true } });
    const currentState = cookieStore.get(SESSION_COOKIES.state)?.value;
    setSessionCookies(next, { ...tokenData, state: currentState ? JSON.parse(currentState) : undefined });
    return next;
  }

  if (path === "auth/logout") body = { refreshToken };
  if (path === "auth/reset-password") {
    const resetToken = cookieStore.get(SESSION_COOKIES.resetProof)?.value;
    if (!resetToken) return NextResponse.json({ success: false, message: "Password reset session expired", code: "INVALID_RESET_TOKEN" }, { status: 401 });
    body = { ...(body as object), resetToken };
  }

  let backend = await backendFetch(path, request.method, body, protectedPaths.has(path) ? accessToken : undefined);
  let payload = await backend.json();

  if (backend.status === 401 && protectedPaths.has(path) && path !== "auth/logout" && refreshToken) {
    const refreshed = await refreshSession(refreshToken);
    if (refreshed.response.ok) {
      const tokenData = refreshed.payload.data as BackendLoginData;
      accessToken = tokenData.accessToken;
      backend = await backendFetch(path, request.method, body, accessToken);
      payload = await backend.json();
      const retried = NextResponse.json(payload, { status: backend.status });
      const currentState = cookieStore.get(SESSION_COOKIES.state)?.value;
      setSessionCookies(retried, { ...tokenData, state: currentState ? JSON.parse(currentState) : undefined });
      return retried;
    }
  }

  if (path === "auth/login" && backend.ok) {
    const login = payload as ApiSuccess<BackendLoginData>;
    const { accessToken: nextAccess, refreshToken: nextRefresh, accessTokenExpiresIn, refreshTokenExpiresIn, ...state } = login.data;
    const next = NextResponse.json({ ...login, data: { ...state, accessTokenExpiresIn, refreshTokenExpiresIn } });
    setSessionCookies(next, { accessToken: nextAccess, refreshToken: nextRefresh, accessTokenExpiresIn, refreshTokenExpiresIn, state });
    return next;
  }

  if (path === "auth/verify-password-reset-otp" && backend.ok) {
    const { resetToken, ...safeData } = payload.data as { resetToken: string; expiresIn: number; nextAction: string };
    const next = NextResponse.json({ ...payload, data: safeData });
    next.cookies.set(SESSION_COOKIES.resetProof, resetToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: safeData.expiresIn
    });
    return next;
  }

  const response = NextResponse.json(payload, { status: backend.status });
  if (path === "auth/logout") clearSessionCookies(response);
  if (path === "auth/reset-password" && backend.ok) {
    response.cookies.delete(SESSION_COOKIES.resetProof);
    clearSessionCookies(response);
  }
  return response;
};

export const GET = handle;
export const POST = handle;
export const PATCH = handle;
