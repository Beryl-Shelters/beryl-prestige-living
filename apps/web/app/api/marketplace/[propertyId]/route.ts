import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { ApiConfigurationError, backendApiUrl } from "@/lib/server/api-url";
import { SESSION_COOKIES } from "@/lib/server/session-cookies";

type Context = { params: Promise<{ propertyId: string }> };

const safeUnavailable = () => NextResponse.json({ success: false, message: "Marketplace property is unavailable", code: "MARKETPLACE_PROPERTY_NOT_FOUND" }, { status: 404 });

export async function GET(_request: NextRequest, context: Context) {
  try {
    const { propertyId } = await context.params;
    if (!/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(propertyId)) return safeUnavailable();
    const cookieStore = await cookies();
    const accessToken = cookieStore.get(SESSION_COOKIES.access)?.value;
    const fetchDetail = (token?: string) => fetch(backendApiUrl(`marketplace/properties/${propertyId}`), {
      cache: "no-store",
      headers: { accept: "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }
    });
    let response = await fetchDetail(accessToken);
    if (response.status === 401 && accessToken) response = await fetchDetail();
    const payload = await response.json();
    return NextResponse.json(payload, { status: response.status });
  } catch (error) {
    if (error instanceof ApiConfigurationError) {
      return NextResponse.json({ success: false, message: error.message, code: "API_CONFIGURATION_ERROR" }, { status: 500 });
    }
    return NextResponse.json({ success: false, message: "Marketplace is temporarily unavailable", code: "MARKETPLACE_UNAVAILABLE" }, { status: 503 });
  }
}
