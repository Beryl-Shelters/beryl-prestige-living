import { NextRequest, NextResponse } from "next/server";
import { customerRouteRedirectUrl } from "@/lib/site-urls";
import { isCustomerAuthRoute } from "@/lib/customer-route-policy";
import { SESSION_COOKIES } from "@/lib/server/session-cookies";

export function proxy(request: NextRequest) {
  const customerHostRedirect = customerRouteRedirectUrl(request.url);
  if (customerHostRedirect) return NextResponse.redirect(customerHostRedirect);

  const isProtectedRoute = isCustomerAuthRoute(request.nextUrl.pathname);
  if (!isProtectedRoute) return NextResponse.next();

  const hasAccessToken = request.cookies.has(SESSION_COOKIES.access);
  const hasRefreshSession = request.cookies.has(SESSION_COOKIES.refresh) && request.cookies.has(SESSION_COOKIES.state);
  if (!hasAccessToken && !hasRefreshSession) {
    const login = new URL("/login", request.url);
    login.searchParams.set("returnTo", `${request.nextUrl.pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/signup", "/login", "/verify-email", "/forgot-password", "/verify-reset-otp", "/reset-password", "/marketplace/:path*", "/buyer/:path*", "/saved/:path*", "/seller/:path*", "/onboarding/:path*"] };
