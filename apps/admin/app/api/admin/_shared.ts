import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { ApiEnvelope } from "@/lib/contracts";
import { ApiConfigurationError, backendApiUrl } from "@/lib/server/api-url";
import { ADMIN_COOKIES, clearAdminCookies, setAdminSession } from "@/lib/server/admin-cookies";
import type { AdminSessionState } from "@/lib/contracts";

export async function bodyOf(request: Request) { try { return await request.json(); } catch { return {}; } }
const analyticsDistinctId = (value: string | null) => value && /^\$device:[A-Za-z0-9_-]{1,120}$/.test(value) ? value : undefined;
export async function upstream(path: string, body: unknown, method = "POST", accessToken?: string, anonymousAnalyticsId?: string) {
  const response = await fetch(backendApiUrl(path), { method, cache: "no-store", headers: { accept: "application/json", "content-type": "application/json", ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}), ...(anonymousAnalyticsId ? { "x-beryl-analytics-distinct-id": anonymousAnalyticsId } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const payload = await response.json().catch(() => ({ success: false, message: "The authentication service returned an invalid response.", code: "UPSTREAM_INVALID_RESPONSE" }));
  return { response, payload: payload as ApiEnvelope<Record<string, unknown>> };
}
export const preAuthAnalyticsId = (request: Request) => analyticsDistinctId(request.headers.get("x-beryl-analytics-distinct-id"));
const stateFromCookie = (value?: string): AdminSessionState | null => { try { return value ? JSON.parse(value) as AdminSessionState : null; } catch { return null; } };
export async function protectedAdminRequest(path: string, method: "GET" | "POST" | "PATCH", body?: unknown) {
  const jar = await cookies(); let access = jar.get(ADMIN_COOKIES.access)?.value; const refresh = jar.get(ADMIN_COOKIES.refresh)?.value;
  let result = await upstream(path, body, method, access);
  let refreshed: { accessToken: string; refreshToken: string; accessTokenExpiresIn: number; refreshTokenExpiresIn: number } | null = null;
  if (result.response.status === 401 && refresh) {
    const rotation = await upstream("admin/auth/refresh", { refreshToken: refresh });
    if (rotation.response.ok && rotation.payload.data) {
      const rotationData = rotation.payload.data as {
        accessToken: string;
        refreshToken: string;
        accessTokenExpiresIn: number;
        refreshTokenExpiresIn: number;
      };
      refreshed = rotationData;
      access = rotationData.accessToken;
      result = await upstream(path, body, method, access);
    } else {
      const expired = NextResponse.json(rotation.payload, { status: rotation.response.status }); clearAdminCookies(expired); return expired;
    }
  }
  const response = NextResponse.json(result.payload, { status: result.response.status });
  if (refreshed) {
    const state = stateFromCookie(jar.get(ADMIN_COOKIES.state)?.value);
    if (state) setAdminSession(response, { accessToken: refreshed.accessToken, refreshToken: refreshed.refreshToken, state: { ...state, accessTokenExpiresIn: refreshed.accessTokenExpiresIn, refreshTokenExpiresIn: refreshed.refreshTokenExpiresIn } });
  }
  return response;
}

async function multipartUpstream(path: string, body: FormData, accessToken?: string) {
  const response = await fetch(backendApiUrl(path), { method: "POST", cache: "no-store", headers: { accept: "application/json", ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}) }, body });
  const payload = await response.json().catch(() => ({ success: false, message: "The Admin service returned an invalid response.", code: "UPSTREAM_INVALID_RESPONSE" }));
  return { response, payload: payload as ApiEnvelope<Record<string, unknown>> };
}

export async function protectedAdminMultipartRequest(path: string, request: Request) {
  const jar = await cookies();
  let access = jar.get(ADMIN_COOKIES.access)?.value;
  const refresh = jar.get(ADMIN_COOKIES.refresh)?.value;
  const source = await request.formData();
  let result = await multipartUpstream(path, source, access);
  type Rotation = { accessToken: string; refreshToken: string; accessTokenExpiresIn: number; refreshTokenExpiresIn: number };
  let refreshed: Rotation | null = null;
  if (result.response.status === 401 && refresh) {
    const rotation = await upstream("admin/auth/refresh", { refreshToken: refresh });
    if (!rotation.response.ok || !rotation.payload.data) {
      const expired = NextResponse.json(rotation.payload, { status: rotation.response.status }); clearAdminCookies(expired); return expired;
    }
    refreshed = rotation.payload.data as unknown as Rotation;
    access = refreshed.accessToken;
    result = await multipartUpstream(path, source, access);
  }
  const response = NextResponse.json(result.payload, { status: result.response.status });
  if (refreshed) {
    const state = stateFromCookie(jar.get(ADMIN_COOKIES.state)?.value);
    if (state) setAdminSession(response, { accessToken: refreshed.accessToken, refreshToken: refreshed.refreshToken, state: { ...state, accessTokenExpiresIn: refreshed.accessTokenExpiresIn, refreshTokenExpiresIn: refreshed.refreshTokenExpiresIn } });
  }
  return response;
}
export function errorResponse(error: unknown) {
  if (error instanceof ApiConfigurationError) return NextResponse.json({ success: false, message: error.message, code: "API_CONFIGURATION_ERROR" }, { status: 500 });
  return NextResponse.json({ success: false, message: "We could not connect to the Admin authentication service. Please try again.", code: "UPSTREAM_UNAVAILABLE" }, { status: 503 });
}
