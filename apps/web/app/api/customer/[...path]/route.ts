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

const propertyId = "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}";
const dynamicCustomerPath = (method: string, browserPath: string) => {
  const save = new RegExp(`^properties/(${propertyId})/save$`).exec(browserPath);
  if (save && (method === "POST" || method === "DELETE")) return `properties/${save[1]}/save`;
  const interest = new RegExp(`^marketplace/properties/(${propertyId})/interest$`).exec(browserPath);
  if (interest && method === "POST") return `marketplace/properties/${interest[1]}/interest`;
  if (method === "GET" && browserPath === "marketplace/seller/properties") return browserPath;
  const management = new RegExp(`^marketplace/seller/properties/(${propertyId})/management$`).exec(browserPath);
  if (management && method === "GET") return `marketplace/seller/properties/${management[1]}/management`;
  if (method === "POST" && browserPath === "marketplace/seller/properties") return browserPath;
  const draft = new RegExp(`^marketplace/seller/properties/(${propertyId})$`).exec(browserPath);
  if (draft && (method === "GET" || method === "PATCH")) return `marketplace/seller/properties/${draft[1]}`;
  const mandate = new RegExp(`^marketplace/seller/properties/(${propertyId})/mandate$`).exec(browserPath);
  if (mandate && (method === "GET" || method === "PUT")) return `marketplace/seller/properties/${mandate[1]}/mandate`;
  const review = new RegExp(`^marketplace/seller/properties/(${propertyId})/review$`).exec(browserPath);
  if (review && method === "GET") return `marketplace/seller/properties/${review[1]}/review`;
  const submit = new RegExp(`^marketplace/seller/properties/(${propertyId})/submit$`).exec(browserPath);
  if (submit && method === "POST") return `marketplace/seller/properties/${submit[1]}/submit`;
  const image = new RegExp(`^marketplace/seller/properties/(${propertyId})/images/(${propertyId})$`).exec(browserPath);
  if (image && (method === "DELETE" || method === "PATCH")) return `marketplace/seller/properties/${image[1]}/images/${image[2]}${method === "PATCH" ? "/cover" : ""}`;
  const images = new RegExp(`^marketplace/seller/properties/(${propertyId})/images$`).exec(browserPath);
  if (images && method === "POST") return `marketplace/seller/properties/${images[1]}/images`;
  if (images && method === "PATCH") return `marketplace/seller/properties/${images[1]}/images/order`;
  const document = new RegExp(`^marketplace/seller/properties/(${propertyId})/documents/(${propertyId})$`).exec(browserPath);
  if (document && method === "DELETE") return `marketplace/seller/properties/${document[1]}/documents/${document[2]}`;
  const documents = new RegExp(`^marketplace/seller/properties/(${propertyId})/documents$`).exec(browserPath);
  if (documents && method === "POST") return `marketplace/seller/properties/${documents[1]}/documents`;
  return undefined;
};

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
const preAuthAnalyticsPaths = new Set(["auth/register", "auth/login"]);
const analyticsDistinctIdHeader = "x-beryl-analytics-distinct-id";
const anonymousDistinctId = /^\$device:[A-Za-z0-9_-]{1,120}$/;

const backendFetch = (path: string, method: string, body: unknown, accessToken?: string, analyticsDistinctId?: string) =>
  fetch(backendApiUrl(path), {
    method,
    cache: "no-store",
    headers: {
      accept: "application/json",
      ...(body === undefined || body instanceof FormData ? {} : { "content-type": "application/json" }),
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
      ...(analyticsDistinctId ? { [analyticsDistinctIdHeader]: analyticsDistinctId } : {})
    },
    body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body)
  });

const readJson = async (request: NextRequest) => {
  if (request.method === "GET" || request.method === "DELETE") return undefined;
  if (request.headers.get("content-type")?.includes("multipart/form-data")) return request.formData();
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
  const path = upstreamPaths.get(`${request.method} ${browserPath}`) ?? dynamicCustomerPath(request.method, browserPath);
  if (!path) {
    return NextResponse.json({ success: false, message: "Route not found" }, { status: 404 });
  }

  const cookieStore = await cookies();
  let body = await readJson(request);
  let accessToken = cookieStore.get(SESSION_COOKIES.access)?.value;
  const refreshToken = cookieStore.get(SESSION_COOKIES.refresh)?.value;
  const suppliedDistinctId = request.headers.get(analyticsDistinctIdHeader);
  const analyticsDistinctId = preAuthAnalyticsPaths.has(path) && suppliedDistinctId && anonymousDistinctId.test(suppliedDistinctId)
    ? suppliedDistinctId
    : undefined;

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

  const isProtectedPath = protectedPaths.has(path) || path.startsWith("properties/") || path.startsWith("marketplace/properties/") || path.startsWith("marketplace/seller/properties");
  const isAuthenticationPath = path.startsWith("auth/");
  let backend = await backendFetch(path, request.method, body, isProtectedPath ? accessToken : undefined, analyticsDistinctId);
  let payload = await backend.json();
  if (backend.status === 404 && isAuthenticationPath) return upstreamNotFound(request.method, path);

  if (backend.status === 401 && isProtectedPath && path !== "auth/logout" && refreshToken) {
    const refreshed = await refreshSession(refreshToken);
    if (refreshed.response.ok) {
      const tokenData = refreshed.payload.data as BackendLoginData;
      accessToken = tokenData.accessToken;
      backend = await backendFetch(path, request.method, body, accessToken);
      payload = await backend.json();
      if (backend.status === 404 && isAuthenticationPath) return upstreamNotFound(request.method, path);
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
export const PUT = handle;
export const DELETE = handle;
