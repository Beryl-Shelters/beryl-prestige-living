import type { PublicPropertyPage } from "./public-properties-api";

export class SavedPropertiesApiError extends Error {
  constructor(public code: string, message: string, public status = 0) { super(message); }
}

function base() {
  const configured = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!configured) throw new SavedPropertiesApiError("CONFIGURATION_UNAVAILABLE", "Saved properties are not configured yet.");
  return configured.replace(/\/$/, "");
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${base()}/api/v1/saved-properties${path}`, { credentials: "include", cache: "no-store", ...init,
      headers: { "Content-Type": "application/json", ...init.headers } });
  } catch (error) {
    if (error instanceof SavedPropertiesApiError) throw error;
    throw new SavedPropertiesApiError("NETWORK_ERROR", "Could not connect to saved properties.");
  }
  let payload: { success: boolean; data?: T; error?: { code: string; message: string } };
  try { payload = await response.json(); }
  catch { throw new SavedPropertiesApiError("INVALID_RESPONSE", "Saved properties are temporarily unavailable.", response.status); }
  if (!response.ok || !payload.success || payload.data === undefined)
    throw new SavedPropertiesApiError(payload.error?.code ?? "REQUEST_FAILED", payload.error?.message ?? "Please try again.", response.status);
  return payload.data;
}

export function fetchSavedProperties(query: URLSearchParams, signal?: AbortSignal) {
  return request<PublicPropertyPage>(`?${query}`, signal ? { signal } : {});
}
export function saveProperty(propertyCode: string) {
  return request<{ propertyCode: string; saved: true }>("", { method: "POST", body: JSON.stringify({ propertyCode }) });
}
export function removeSavedProperty(propertyCode: string) {
  return request<{ propertyCode: string; saved: false }>(`/${encodeURIComponent(propertyCode)}`, { method: "DELETE", body: "{}" });
}
export async function fetchSavedPropertyStates(propertyCodes: string[], signal?: AbortSignal) {
  if (!propertyCodes.length) return [];
  const query = new URLSearchParams({ codes: propertyCodes.join(",") });
  return (await request<{ propertyCodes: string[] }>(`/states?${query}`, signal ? { signal } : {})).propertyCodes;
}
