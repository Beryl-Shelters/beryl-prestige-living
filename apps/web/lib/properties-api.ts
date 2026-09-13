import { AuthApiError } from "./auth-api";

export type PurchasedProperty = {
  id: string;
  propertyTitle: string;
  propertyCode: string;
  state: string;
  type: string;
  subtype: string;
  price: string;
  status: string;
  closedAt: string;
};

export type PurchasedPropertiesPage = {
  items: PurchasedProperty[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export async function fetchPurchasedProperties(q: string, page: number, signal: AbortSignal, refreshAttempts = 0): Promise<PurchasedPropertiesPage> {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!base) throw new AuthApiError("CONFIGURATION_UNAVAILABLE", "Dashboard services are not configured. Please try again later.");
  let response: Response;
  try {
    response = await fetch(`${base.replace(/\/$/, "")}/api/v1/dashboard/properties?${new URLSearchParams({ q, page: String(page) })}`, {
      credentials: "include", cache: "no-store", signal,
    });
  } catch (error) {
    if (signal.aborted) throw error;
    throw new AuthApiError("NETWORK_ERROR", "Could not connect to dashboard services. Please try again.");
  }
  let payload: { success: boolean; data: PurchasedPropertiesPage; error?: { code: string; message: string } };
  try { payload = await response.json(); }
  catch { throw new AuthApiError("INVALID_RESPONSE", "Purchased properties are temporarily unavailable. Please try again."); }
  if (payload.error?.code === "SESSION_REFRESHING" && refreshAttempts < 3) {
    await new Promise(resolve => setTimeout(resolve, 400));
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    return fetchPurchasedProperties(q, page, signal, refreshAttempts + 1);
  }
  if (!response.ok || !payload.success) throw new AuthApiError(payload.error?.code ?? "PROPERTIES_UNAVAILABLE", payload.error?.message ?? "Purchased properties are temporarily unavailable. Please try again.", response.status);
  return payload.data;
}
