export type PublicAnalytics = {
  period: "monthly" | "annually";
  priceSeries: { label: string; valueMinor: number | null }[];
  propertyPercentage: { totalListedProperties: number; residentialListedProperties: number; residentialPercentage: number };
  searchesPerDay: { date: string; count: number }[];
};

function base() {
  if (!process.env.NEXT_PUBLIC_API_BASE_URL) throw new Error("Analytics is not configured yet.");
  return process.env.NEXT_PUBLIC_API_BASE_URL.replace(/\/$/, "");
}

export async function fetchPublicAnalytics(period: "monthly" | "annually", signal: AbortSignal): Promise<PublicAnalytics> {
  const response = await fetch(`${base()}/api/v1/public/analytics?period=${period}`, { signal, cache: "no-store" });
  const payload = await response.json() as { success: boolean; data?: PublicAnalytics };
  if (!response.ok || !payload.success || !payload.data) throw new Error("Analytics is temporarily unavailable.");
  return payload.data;
}
