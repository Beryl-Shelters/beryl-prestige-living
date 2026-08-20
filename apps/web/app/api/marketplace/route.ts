import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ApiConfigurationError, backendApiUrl } from "@/lib/server/api-url";
import { SESSION_COOKIES } from "@/lib/server/session-cookies";

const supportedParameters = new Set([
  "q",
  "location",
  "minPrice",
  "maxPrice",
  "propertyType",
  "category",
  "condition",
  "furnishing",
  "bedrooms",
  "sort",
  "page",
  "limit"
]);

export async function GET(request: NextRequest) {
  try {
    const upstream = new URL(backendApiUrl("marketplace/properties"));
    request.nextUrl.searchParams.forEach((value, key) => {
      if (supportedParameters.has(key)) upstream.searchParams.append(key, value);
    });
    const accessToken = (await cookies()).get(SESSION_COOKIES.access)?.value;
    const fetchSearch = (token?: string) => fetch(upstream, {
      method: "GET",
      cache: "no-store",
      headers: { accept: "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }
    });
    let response = await fetchSearch(accessToken);
    if (response.status === 401 && accessToken) response = await fetchSearch();
    const payload = await response.json();
    return NextResponse.json(payload, { status: response.status });
  } catch (error) {
    if (error instanceof ApiConfigurationError) {
      return NextResponse.json({ success: false, message: error.message, code: "API_CONFIGURATION_ERROR" }, { status: 500 });
    }
    return NextResponse.json({ success: false, message: "Marketplace is temporarily unavailable", code: "MARKETPLACE_UNAVAILABLE" }, { status: 503 });
  }
}
