import { AuthApiError } from "./auth-api";

export type RevenuePoint = { label: string; amount: number };
export type DashboardOverview = {
  customer: { id: string; first_name: string | null; last_name: string | null; account_type: string | null; profile_type: string | null };
  summary: { total_investments: number; properties_owned: number; referral_earnings: number; new_messages: number };
  revenue: { monthly: RevenuePoint[]; yearly: RevenuePoint[] };
  recent_messages: { id: string; subject: string }[];
  recent_property_listings: { id: string; title: string }[];
};

// Read-only dashboard client. Keep the stable auth client and its paths intact.
export async function fetchDashboard(signal: AbortSignal, refreshAttempts = 0): Promise<DashboardOverview> {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!base) throw new AuthApiError("CONFIGURATION_UNAVAILABLE", "Dashboard services are not configured. Please try again later.");
  let response: Response;
  try {
    response = await fetch(`${base.replace(/\/$/, "")}/api/v1/dashboard/overview`, {
      credentials: "include", cache: "no-store", signal,
    });
  } catch (error) {
    if (signal.aborted) throw error;
    throw new AuthApiError("NETWORK_ERROR", "Could not connect to dashboard services. Please try again.");
  }
  let payload: { success: boolean; data: DashboardOverview; error?: { code: string; message: string } };
  try { payload = await response.json(); }
  catch { throw new AuthApiError("INVALID_RESPONSE", "Dashboard is temporarily unavailable. Please try again."); }
  if (payload.error?.code === "SESSION_REFRESHING" && refreshAttempts < 3) {
    await new Promise((resolve) => setTimeout(resolve, 400));
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    return fetchDashboard(signal, refreshAttempts + 1);
  }
  if (!response.ok || !payload.success) throw new AuthApiError(payload.error?.code ?? "DASHBOARD_UNAVAILABLE", payload.error?.message ?? "Dashboard is temporarily unavailable. Please try again.", response.status);
  return payload.data;
}
