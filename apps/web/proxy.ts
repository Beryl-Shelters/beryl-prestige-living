import { NextRequest, NextResponse } from "next/server";
import { customerRouteRedirectUrl } from "@/lib/site-urls";

export function proxy(request: NextRequest) {
  const customerHostRedirect = customerRouteRedirectUrl(request.url);
  if (customerHostRedirect) return NextResponse.redirect(customerHostRedirect);

  const isProtectedRoute = request.nextUrl.pathname === "/buyer" || request.nextUrl.pathname === "/seller" || request.nextUrl.pathname.startsWith("/seller/") || request.nextUrl.pathname.startsWith("/onboarding/");
  if (!isProtectedRoute) return NextResponse.next();

  const hasAccessToken = request.cookies.has("beryl_customer_access");
  if (!hasAccessToken) {
    const login = new URL("/login", request.url);
    login.searchParams.set("returnTo", `${request.nextUrl.pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/signup", "/login", "/verify-email", "/forgot-password", "/verify-reset-otp", "/reset-password", "/buyer", "/seller/:path*", "/onboarding/:path*"] };
