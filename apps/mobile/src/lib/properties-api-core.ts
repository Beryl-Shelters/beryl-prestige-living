import { nairaToKobo } from "./money";
import type { ComparedProperty, PropertyFilters, PublicPropertyDetail, PublicPropertyPage } from "./property-types";

type RequestOptions = { method?: string; authenticated?: boolean; body?: unknown };
export type PropertyApiTransport = { request<T>(path: string, options?: RequestOptions): Promise<T> };

export function propertyQuery(search: string, filters: PropertyFilters, page = 1, pageSize = 10) {
  const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize), sort: filters.sort });
  if (search.trim()) query.set("q", search.trim());
  for (const key of ["propertyType", "propertySubtype", "state", "city", "facility"] as const) if (filters[key].trim()) query.set(key, filters[key].trim());
  if (filters.maxPrice.trim()) { const minor = nairaToKobo(filters.maxPrice); if (minor !== null) query.set("maxPrice", String(minor)); }
  for (const key of ["bedrooms", "bathrooms"] as const) if (filters[key]) query.set(filters[key] === "7+" ? `${key}Min` : key, filters[key] === "7+" ? "7" : filters[key]);
  return query;
}

export function createPropertiesApi(client: PropertyApiTransport) { return {
  list(query: URLSearchParams) { return client.request<PublicPropertyPage>(`/api/v1/public/properties?${query}`, { authenticated: false }); },
  detail(code: string) { return client.request<{ property: PublicPropertyDetail; similar: PublicPropertyPage["items"] }>(`/api/v1/public/properties/${encodeURIComponent(code)}`, { authenticated: false }); },
  recordSearch() { return client.request<Record<string, never>>("/api/v1/public/property-searches", { method: "POST", authenticated: false, body: {} }); },
  saved(query: URLSearchParams) { return client.request<PublicPropertyPage>(`/api/v1/saved-properties?${query}`); },
  savedStates(codes: string[]) { const query = new URLSearchParams({ codes: codes.join(",") }); return client.request<{ propertyCodes: string[] }>(`/api/v1/saved-properties/states?${query}`); },
  save(propertyCode: string) { return client.request<{ propertyCode: string; saved: true }>("/api/v1/saved-properties", { method: "POST", body: { propertyCode } }); },
  unsave(propertyCode: string) { return client.request<{ propertyCode: string; saved: false }>(`/api/v1/saved-properties/${encodeURIComponent(propertyCode)}`, { method: "DELETE", body: {} }); },
  compare(codes: string[]) { const query = new URLSearchParams({ codes: codes.join(",") }); return client.request<{ items: ComparedProperty[] }>(`/api/v1/saved-properties/compare?${query}`); },
  referral(propertyCode: string) { return client.request<{ id: string; referralType: "PROPERTY"; propertyCode: string; referralUrl: string }>("/api/v1/dashboard/referrals/public-property", { method: "POST", body: { propertyCode } }); },
}; }
