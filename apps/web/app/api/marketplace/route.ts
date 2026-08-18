import { NextRequest, NextResponse } from "next/server";
import { ApiConfigurationError, backendApiUrl } from "@/lib/server/api-url";

const supportedParameters = new Set([
  "q",
  "location",
  "minPrice",
  "maxPrice",
  "propertyType",
  "category",
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
    const response = await fetch(upstream, {
      method: "GET",
      cache: "no-store",
      headers: { accept: "application/json" }
    });
    const payload = await response.json();
    return NextResponse.json(payload, { status: response.status });
  } catch (error) {
    if (error instanceof ApiConfigurationError) {
      return NextResponse.json({ success: false, message: error.message, code: "API_CONFIGURATION_ERROR" }, { status: 500 });
    }
    return NextResponse.json({ success: false, message: "Marketplace is temporarily unavailable", code: "MARKETPLACE_UNAVAILABLE" }, { status: 503 });
  }
}
