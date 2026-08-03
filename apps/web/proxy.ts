import { NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  const hasAccessToken = request.cookies.has("beryl_customer_access");
  if (!hasAccessToken) {
    const login = new URL("/login", request.url);
    login.searchParams.set("returnTo", request.nextUrl.pathname);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/buyer", "/seller", "/onboarding/:path*"] };
