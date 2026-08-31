import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { ApiSuccess, CustomerSessionState } from "@/lib/contracts";
import { ApiConfigurationError, backendApiUrl } from "@/lib/server/api-url";
import { clearSessionCookies, SESSION_COOKIES, setSessionCookies, setSessionStateCookie } from "@/lib/server/session-cookies";

type RefreshedTokens = {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresIn: number;
  refreshTokenExpiresIn: number;
};

const backendFetch = (path: string, method: "GET" | "POST", accessToken?: string, body?: unknown) =>
  fetch(backendApiUrl(path), {
    method,
    cache: "no-store",
    headers: {
      accept: "application/json",
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

const unauthorized = () => {
  const response = NextResponse.json(
    { success: false, message: "Session not found", code: "SESSION_NOT_FOUND" },
    { status: 401 },
  );
  clearSessionCookies(response);
  return response;
};

const canonicalState = async (accessToken: string, current: CustomerSessionState) => {
  const response = await backendFetch("onboarding/status", "GET", accessToken);
  if (!response.ok) return { response, state: null };
  const payload = await response.json() as ApiSuccess<Pick<CustomerSessionState, "activePersona" | "personas" | "nextAction">>;
  return { response, state: { ...current, ...payload.data } satisfies CustomerSessionState };
};

export const GET = async () => {
  try {
    const cookieStore = await cookies();
    const rawState = cookieStore.get(SESSION_COOKIES.state)?.value;
    let accessToken = cookieStore.get(SESSION_COOKIES.access)?.value;
    const refreshToken = cookieStore.get(SESSION_COOKIES.refresh)?.value;
    if (!rawState) return unauthorized();

    let current: CustomerSessionState;
    try {
      current = JSON.parse(rawState) as CustomerSessionState;
    } catch {
      return unauthorized();
    }

    if (accessToken) {
      const verified = await canonicalState(accessToken, current);
      if (verified.state) {
        const response = NextResponse.json({ success: true, message: "Session restored", data: verified.state });
        setSessionStateCookie(response, verified.state);
        return response;
      }
      if (verified.response.status !== 401) {
        return NextResponse.json({ success: false, message: "Session verification is temporarily unavailable", code: "SESSION_UNAVAILABLE" }, { status: 503 });
      }
    }

    if (!refreshToken) return unauthorized();
    const refreshedResponse = await backendFetch("auth/refresh", "POST", undefined, { refreshToken });
    if (!refreshedResponse.ok) return unauthorized();
    const refreshedPayload = await refreshedResponse.json() as ApiSuccess<RefreshedTokens>;
    accessToken = refreshedPayload.data.accessToken;
    const verified = await canonicalState(accessToken, current);
    if (!verified.state) return unauthorized();

    const response = NextResponse.json({ success: true, message: "Session restored", data: verified.state });
    setSessionCookies(response, { ...refreshedPayload.data, state: verified.state });
    return response;
  } catch (error) {
    if (error instanceof ApiConfigurationError) {
      return NextResponse.json({ success: false, message: error.message, code: "API_CONFIGURATION_ERROR" }, { status: 500 });
    }
    return NextResponse.json({ success: false, message: "Session verification is temporarily unavailable", code: "SESSION_UNAVAILABLE" }, { status: 503 });
  }
};
