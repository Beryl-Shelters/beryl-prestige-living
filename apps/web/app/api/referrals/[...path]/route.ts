import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { backendApiUrl } from "@/lib/server/api-url";
import { REFERRAL_TRACKING_COOKIE, SESSION_COOKIES } from "@/lib/server/session-cookies";

type Context = { params: Promise<{ path: string[] }> };

const allowed = new Map([
  ["GET context", "referrals/context"],
  ["POST submit", "referrals"],
  ["POST tracking/request", "referrals/tracking/request"],
  ["POST tracking/verify", "referrals/tracking/verify"],
  ["GET dashboard", "referrals/dashboard"],
  ["GET banks", "referrals/banks"],
  ["GET payout-details", "referrals/payout-details"],
  ["PUT payout-details", "referrals/payout-details"]
]);
const codePattern = /^[A-Z0-9-]{5,40}$/;
const trackingCookieOptions = (maxAge: number) => ({
  httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge
});

const handler = async (request: NextRequest, context: Context) => {
  try {
    const segments = (await context.params).path;
    const browserPath = segments.join("/");
    let upstream = allowed.get(`${request.method} ${browserPath}`);
    if (!upstream && request.method === "GET" && segments[0] === "links" && segments.length === 2 && codePattern.test(segments[1])) {
      upstream = `referrals/links/${segments[1]}`;
    }
    if (!upstream) return NextResponse.json({ success: false, message: "Route not found" }, { status: 404 });

    const cookieStore = await cookies();
    const access = cookieStore.get(SESSION_COOKIES.access)?.value;
    const tracking = cookieStore.get(REFERRAL_TRACKING_COOKIE)?.value;
    const query = new URLSearchParams();
    if (browserPath === "dashboard") {
      for (const key of ["page", "limit"]) {
        const value = request.nextUrl.searchParams.get(key);
        if (value) query.set(key, value);
      }
    }
    const body = request.method === "GET" ? undefined : await request.json().catch(() => ({}));
    const backend = await fetch(backendApiUrl(`${upstream}${query.size ? `?${query}` : ""}`), {
      method: request.method,
      cache: "no-store",
      headers: {
        accept: "application/json",
        ...(body === undefined ? {} : { "content-type": "application/json" }),
        ...(access ? { authorization: `Bearer ${access}` } : {}),
        ...(tracking ? { "x-referral-tracking-token": tracking } : {})
      },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const payload = await backend.json();
    if (browserPath === "tracking/verify" && backend.ok) {
      const token = payload.data?.trackingToken;
      const expiresIn = Number(payload.data?.expiresIn || 0);
      const response = NextResponse.json({ ...payload, data: { expiresIn } }, { status: backend.status });
      if (typeof token === "string" && expiresIn > 0) response.cookies.set(REFERRAL_TRACKING_COOKIE, token, trackingCookieOptions(expiresIn));
      return response;
    }
    return NextResponse.json(payload, { status: backend.status });
  } catch {
    return NextResponse.json({ success: false, message: "We could not connect to the referral service. Please try again.", code: "UPSTREAM_UNAVAILABLE" }, { status: 503 });
  }
};

export const GET = handler;
export const POST = handler;
export const PUT = handler;
