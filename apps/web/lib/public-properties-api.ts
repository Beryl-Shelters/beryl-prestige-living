export type PublicProperty = {
  code: string; title: string; description: string; propertyType: string; propertySubtype: string;
  priceMinor: number; state: string; city: string; bedrooms: number; bathrooms: number;
  parkingSpaces: number; facilities: string[]; listedAt: string | null; images: string[];
};
export type PublicPropertyDetail = PublicProperty & {
  occupancyType: string; ownershipType: string; hasLien: boolean;
  minimumDownPaymentMinor: number; location: string; landArea: number | null; yearBuilt: number | null;
};
export type PublicPropertyPage = { items: PublicProperty[]; page: number; pageSize: number; total: number; totalPages: number };
export type PublicPropertyDetailResult = { property: PublicPropertyDetail; similar: PublicProperty[] };

function base() {
  const configured = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!configured) throw new Error("Property listings are not configured yet.");
  return configured.replace(/\/$/, "");
}

export async function fetchPublicProperties(query: URLSearchParams, signal: AbortSignal): Promise<PublicPropertyPage> {
  const response = await fetch(`${base()}/api/v1/public/properties?${query}`, { signal, cache: "no-store" });
  const payload = await response.json() as { success: boolean; data?: PublicPropertyPage };
  if (!response.ok || !payload.success || !payload.data) throw new Error("Properties are temporarily unavailable.");
  return payload.data;
}

export async function fetchPublicPropertyDetail(code: string, signal: AbortSignal): Promise<PublicPropertyDetailResult> {
  const response = await fetch(`${base()}/api/v1/public/properties/${encodeURIComponent(code)}`, { signal, cache: "no-store" });
  const payload = await response.json() as { success: boolean; data?: PublicPropertyDetailResult; error?: { code?: string } };
  if (response.status === 404) throw new Error("PROPERTY_NOT_FOUND");
  if (!response.ok || !payload.success || !payload.data) throw new Error("Properties are temporarily unavailable.");
  return payload.data;
}

export async function recordPublicPropertySearch(): Promise<void> {
  const response = await fetch(`${base()}/api/v1/public/property-searches`, {
    method: "POST", credentials: "omit", cache: "no-store", headers: { "Content-Type": "application/json" }, body: "{}",
  });
  if (!response.ok) throw new Error("Search tracking unavailable.");
}
