const MAX_MINOR = 999999999999999n;
const allowed = ["q", "propertyType", "propertySubtype", "state", "city", "bedrooms", "bathrooms", "facility"] as const;

export function nairaToKobo(value: string): string | null {
  const normalized = value.trim().replace(/,/g, "");
  if (!/^(0|[1-9]\d{0,12})(\.\d{1,2})?$/.test(normalized)) return null;
  const [whole = "0", fraction = ""] = normalized.split(".");
  const minor = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
  return minor <= MAX_MINOR ? minor.toString() : null;
}

export function formatNaira(priceMinor: number): string {
  const minor = BigInt(priceMinor);
  const whole = minor / 100n;
  const cents = minor % 100n;
  return `₦${new Intl.NumberFormat("en-NG").format(Number(whole))}${cents ? `.${cents.toString().padStart(2, "0")}` : ""}`;
}

export function apiQueryFromBuyUrl(url: URLSearchParams): { query: URLSearchParams; error: string | null; locationNotice: string | null } {
  const query = new URLSearchParams();
  for (const key of allowed) { const value = url.get(key)?.trim(); if (value) query.set(key, value); }
  const code = url.get("code")?.trim();
  if (code && query.has("q")) return { query, error: "Use either Search properties or Property Code, not both.", locationNotice: null };
  if (code) query.set("q", code);
  const budget = url.get("budget")?.trim();
  if (budget) {
    const minor = nairaToKobo(budget);
    if (minor === null) return { query, error: "Enter a valid naira budget with at most two decimal places.", locationNotice: null };
    query.set("maxPrice", minor);
  }
  const page = url.get("page"); if (page) query.set("page", page);
  query.set("pageSize", "10");
  const location = url.get("location")?.trim();
  // The legacy Landing location does not distinguish state from city.
  const locationNotice = location ? `“${location}” is not an available location filter yet; other filters are applied.` : null;
  return { query, error: null, locationNotice };
}
