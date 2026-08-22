import { request } from "@/api/client";
import { marketplaceQuery, queryString } from "@/marketplace/filters";
import type {
  MarketplaceFilters,
  MarketplaceInterestRequest,
  MarketplaceInterestResult,
  MarketplacePropertyDetailResult,
  MarketplaceSavedPropertyListResult,
  MarketplaceSavedPropertyMutation,
  MarketplaceSearchResult
} from "@/types/marketplace";
import type { ApiEnvelope } from "@/types/auth";

export type AuthenticatedRequester = <T>(path: string, method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE", body?: unknown) => Promise<ApiEnvelope<T>>;

export const marketplaceSearchPath = (filters: MarketplaceFilters, page: number) => `/marketplace/properties?${queryString(marketplaceQuery(filters, page))}`;
export const searchMarketplace = (filters: MarketplaceFilters, page: number, accessToken?: string | null) =>
  request<MarketplaceSearchResult>(marketplaceSearchPath(filters, page), "GET", undefined, accessToken ?? undefined);
export const marketplaceDetail = (propertyId: string, accessToken?: string | null) =>
  request<MarketplacePropertyDetailResult>(`/marketplace/properties/${propertyId}`, "GET", undefined, accessToken ?? undefined);
export const saveMarketplaceProperty = (requester: AuthenticatedRequester, propertyId: string) => requester<MarketplaceSavedPropertyMutation>(`/properties/${propertyId}/save`, "POST", {});
export const unsaveMarketplaceProperty = (requester: AuthenticatedRequester, propertyId: string) => requester<never>(`/properties/${propertyId}/save`, "DELETE");
export const listSavedMarketplaceProperties = (requester: AuthenticatedRequester, page: number) => requester<MarketplaceSavedPropertyListResult>(`/properties/saved/me?page=${page}&limit=20`, "GET");
export const expressMarketplaceInterest = (requester: AuthenticatedRequester, propertyId: string, body: MarketplaceInterestRequest) => requester<MarketplaceInterestResult>(`/marketplace/properties/${propertyId}/interest`, "POST", body);
