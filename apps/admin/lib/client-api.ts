import type { ApiEnvelope } from "./contracts";
export async function requestApi<T>(path: string, body: unknown, method: "POST" | "PATCH" = "POST"): Promise<ApiEnvelope<T>> { const response = await fetch(path, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); const payload = await response.json().catch(() => ({ success: false, message: "Unexpected response", code: "UPSTREAM_INVALID_RESPONSE" })); if (!response.ok) throw payload as ApiEnvelope<T>; return payload as ApiEnvelope<T>; }
export const postApi = <T>(path: string, body: unknown) => requestApi<T>(path, body);
export const errorMessage = (error: unknown, fallback: string) => { const api = error as ApiEnvelope<unknown>; return api?.message || fallback; };
