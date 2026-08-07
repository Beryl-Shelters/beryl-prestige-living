import { NextResponse } from "next/server";
import type { ApiEnvelope } from "@/lib/contracts";
import { ApiConfigurationError, backendApiUrl } from "@/lib/server/api-url";

export async function bodyOf(request: Request) { try { return await request.json(); } catch { return {}; } }
export async function upstream(path: string, body: unknown) {
  const response = await fetch(backendApiUrl(path), { method: "POST", cache: "no-store", headers: { accept: "application/json", "content-type": "application/json" }, body: JSON.stringify(body) });
  const payload = await response.json().catch(() => ({ success: false, message: "The authentication service returned an invalid response.", code: "UPSTREAM_INVALID_RESPONSE" }));
  return { response, payload: payload as ApiEnvelope<Record<string, unknown>> };
}
export function errorResponse(error: unknown) {
  if (error instanceof ApiConfigurationError) return NextResponse.json({ success: false, message: error.message, code: "API_CONFIGURATION_ERROR" }, { status: 500 });
  return NextResponse.json({ success: false, message: "We could not connect to the Admin authentication service. Please try again.", code: "UPSTREAM_UNAVAILABLE" }, { status: 503 });
}
