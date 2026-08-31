import { NextRequest, NextResponse } from "next/server";
import { ApiConfigurationError, backendApiUrl } from "@/lib/server/api-url";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (query.length < 2 || query.length > 80) {
    return NextResponse.json(
      { success: false, message: "Enter at least two characters to search", code: "INVALID_LOCATION_QUERY" },
      { status: 400 },
    );
  }

  try {
    const upstream = new URL(backendApiUrl("locations/search"));
    upstream.searchParams.set("q", query);
    const response = await fetch(upstream, {
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    const payload = await response.json();
    return NextResponse.json(payload, { status: response.status });
  } catch (error) {
    if (error instanceof ApiConfigurationError) {
      return NextResponse.json(
        { success: false, message: error.message, code: "API_CONFIGURATION_ERROR" },
        { status: 500 },
      );
    }
    return NextResponse.json(
      { success: false, message: "Location suggestions are temporarily unavailable", code: "LOCATION_SEARCH_UNAVAILABLE" },
      { status: 503 },
    );
  }
}
