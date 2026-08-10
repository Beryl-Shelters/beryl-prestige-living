import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import type { ApiSuccess, CustomerSessionState } from "@/lib/contracts";
import { ApiConfigurationError, backendApiUrl } from "@/lib/server/api-url";
import { clearSessionCookies, SESSION_COOKIES, setSessionCookies } from "@/lib/server/session-cookies";

type Context = { params: Promise<{ path: string[] }> };
type BackendLoginData = CustomerSessionState & {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresIn: number;
  refreshTokenExpiresIn: number;
};

const upstreamPaths = new Map([
  ["POST register", "auth/register"],
  ["POST verify-email", "auth/verify-email"],
  ["POST resend-verification-otp", "auth/resend-verification-otp"],
  ["POST login", "auth/login"],
  ["POST forgot-password", "auth/forgot-password"],
  ["POST verify-password-reset-otp", "auth/verify-password-reset-otp"],
  ["POST reset-password", "auth/reset-password"],
  ["POST refresh", "auth/refresh"],
  ["POST logout", "auth/logout"],
  ["PATCH change-password", "auth/change-password"],
  ["GET onboarding/status", "onboarding/status"],
  ["PATCH onboarding/buyer", "onboarding/buyer"],
  ["PATCH onboarding/seller", "onboarding/seller"],
  ["GET personas", "personas"],
  ["POST personas/activate", "personas/activate"],
  ["PATCH personas/active", "personas/active"]
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

const backendFetch = (path: string, method: string, body: unknown, accessToken?: string) =>
  fetch(backendApiUrl(path), {
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

const upstreamNotFound = (method: string, path: string) => {
  console.warn(`[customer-bff] upstream 404 ${method} ${backendApiUrl(path)}`);
  return NextResponse.json({ success: false, message: "The authentication service route could not be reached.", code: "UPSTREAM_ROUTE_NOT_FOUND" }, { status: 502 });
};

const handleRequest = async (request: NextRequest, context: Context) => {
  const browserPath = (await context.params).path.join("/");
  const path = upstreamPaths.get(`${request.method} ${browserPath}`);
  if (!path) {
    return NextResponse.json({ success: false, message: "Route not found" }, { status: 404 });
  }

  const cookieStore = await cookies();
  let body = await readJson(request);
  let accessToken = cookieStore.get(SESSION_COOKIES.access)?.value;
  const refreshToken = cookieStore.get(SESSION_COOKIES.refresh)?.value;

  if (path === "auth/refresh") {
    if (!refreshToken) return NextResponse.json({ success: false, message: "Session not found", code: "SESSION_NOT_FOUND" }, { status: 401 });
    const refreshed = await refreshSession(refreshToken);
    if (refreshed.response.status === 404) return upstreamNotFound("POST", "auth/refresh");
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
  if (backend.status === 404) return upstreamNotFound(request.method, path);

  if (backend.status === 401 && protectedPaths.has(path) && path !== "auth/logout" && refreshToken) {
    const refreshed = await refreshSession(refreshToken);
    if (refreshed.response.ok) {
      const tokenData = refreshed.payload.data as BackendLoginData;
      accessToken = tokenData.accessToken;
      backend = await backendFetch(path, request.method, body, accessToken);
      payload = await backend.json();
      if (backend.status === 404) return upstreamNotFound(request.method, path);
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
  if (backend.ok && (path === "auth/reset-password" || path === "auth/change-password")) {
    if (path === "auth/reset-password") response.cookies.delete(SESSION_COOKIES.resetProof);
    clearSessionCookies(response);
  }
  return response;
};

const handle = async (request: NextRequest, context: Context) => {
  try {
    return await handleRequest(request, context);
  } catch (error) {
    const browserPath = (await context.params).path.join("/");
    if (error instanceof ApiConfigurationError) {
      const response = NextResponse.json({ success: false, message: error.message, code: "API_CONFIGURATION_ERROR" }, { status: 500 });
      if (browserPath === "logout") clearSessionCookies(response);
      return response;
    }
    const response = NextResponse.json({ success: false, message: "We could not connect to the service. Please try again.", code: "UPSTREAM_UNAVAILABLE" }, { status: 503 });
    if (browserPath === "logout") clearSessionCookies(response);
    return response;
  }
};

export const GET = handle;
export const POST = handle;
export const PATCH = handle;
