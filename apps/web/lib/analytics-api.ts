import { AuthApiError } from "./auth-api";

export type CustomerAnalytics = {
  year: number;
  categoryPerformance: { month: number; label: string; buy: number; sell: number; referral: number }[];
  listingsOverview: { total: number } & Record<"listed" | "pending" | "rejected", { count: number; percentage: number }>;
  bedrooms: Record<1 | 2 | 3 | 4 | 5 | 6, number>;
  propertyTypes: { commercial: number; detachedHouses: number; flats: number; others: number; residential: number };
};

export async function fetchAnalytics(q: string, year: number, signal: AbortSignal, refreshAttempts = 0): Promise<CustomerAnalytics> {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!base) throw new AuthApiError("CONFIGURATION_UNAVAILABLE", "Dashboard services are not configured. Please try again later.");
  let response: Response;
  try {
    response = await fetch(`${base.replace(/\/$/, "")}/api/v1/dashboard/analytics?${new URLSearchParams({ q, year: String(year) })}`, {
      credentials: "include", cache: "no-store", signal,
    });
  } catch (error) {
    if (signal.aborted) throw error;
    throw new AuthApiError("NETWORK_ERROR", "Could not connect to dashboard services. Please try again.");
  }
  let payload: { success: boolean; data: CustomerAnalytics; error?: { code: string; message: string } };
  try { payload = await response.json(); }
  catch { throw new AuthApiError("INVALID_RESPONSE", "Analytics is temporarily unavailable. Please try again."); }
  if (payload.error?.code === "SESSION_REFRESHING" && refreshAttempts < 3) {
    await new Promise(resolve => setTimeout(resolve, 400));
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    return fetchAnalytics(q, year, signal, refreshAttempts + 1);
  }
  if (!response.ok || !payload.success) throw new AuthApiError(payload.error?.code ?? "ANALYTICS_UNAVAILABLE", payload.error?.message ?? "Analytics is temporarily unavailable. Please try again.", response.status);
  return payload.data;
}
