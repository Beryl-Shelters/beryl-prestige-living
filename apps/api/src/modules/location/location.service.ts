import { env } from "../../config/env";
import { AppError } from "../../utils/AppError";

export type LocationType = "STATE" | "CITY" | "LGA" | "AREA";

export type NigeriaLocation = {
  id: string;
  label: string;
  state: string;
  type: LocationType;
};

type GeoNamesPlace = {
  geonameId?: number;
  name?: string;
  adminName1?: string;
  countryCode?: string;
  featureClass?: string;
  featureCode?: string;
};

type CacheEntry = { expiresAt: number; locations: NigeriaLocation[] };

export type LocationSearchOptions = {
  username: string;
  fetcher?: typeof fetch;
  timeoutMs?: number;
  cacheTtlMs?: number;
  maxCacheEntries?: number;
  now?: () => number;
};

const unavailable = () =>
  new AppError(
    "Location suggestions are temporarily unavailable",
    503,
    "LOCATION_SEARCH_UNAVAILABLE",
  );

const locationType = (place: GeoNamesPlace): LocationType | null => {
  if (place.featureClass === "P") return "CITY";
  if (place.featureClass === "L") return "AREA";
  if (place.featureClass !== "A") return null;
  if (place.featureCode === "ADM1") return "STATE";
  if (place.featureCode === "ADM2") return "LGA";
  return "AREA";
};

const mapPlace = (place: GeoNamesPlace): NigeriaLocation | null => {
  const name = place.name?.trim();
  const state = place.adminName1?.trim() ?? "";
  const type = locationType(place);
  if (
    place.countryCode !== "NG" ||
    !name ||
    !type ||
    !Number.isSafeInteger(place.geonameId)
  ) return null;

  const label = state && state.toLocaleLowerCase("en") !== name.toLocaleLowerCase("en")
    ? `${name}, ${state}`
    : name;
  return { id: String(place.geonameId), label, state, type };
};

export function createLocationSearchService({
  username,
  fetcher = fetch,
  timeoutMs = 3_000,
  cacheTtlMs = 15 * 60 * 1_000,
  maxCacheEntries = 200,
  now = Date.now,
}: LocationSearchOptions) {
  const cache = new Map<string, CacheEntry>();
  const inFlight = new Map<string, Promise<NigeriaLocation[]>>();

  const searchProvider = async (query: string) => {
    if (!username) throw unavailable();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const url = new URL("https://secure.geonames.org/searchJSON");
      url.searchParams.set("name_startsWith", query);
      url.searchParams.set("country", "NG");
      url.searchParams.append("featureClass", "A");
      url.searchParams.append("featureClass", "P");
      url.searchParams.append("featureClass", "L");
      url.searchParams.set("maxRows", "24");
      url.searchParams.set("style", "FULL");
      url.searchParams.set("lang", "en");
      url.searchParams.set("username", username);

      const response = await fetcher(url, {
        headers: { accept: "application/json" },
        signal: controller.signal,
      });
      if (!response.ok) throw unavailable();
      const payload = await response.json() as { geonames?: unknown };
      if (!Array.isArray(payload.geonames)) throw unavailable();

      const seen = new Set<string>();
      const locations: NigeriaLocation[] = [];
      for (const rawPlace of payload.geonames) {
        if (!rawPlace || typeof rawPlace !== "object") continue;
        const place = mapPlace(rawPlace as GeoNamesPlace);
        if (!place) continue;
        const key = place.label.toLocaleLowerCase("en");
        if (seen.has(key)) continue;
        seen.add(key);
        locations.push(place);
        if (locations.length === 12) break;
      }
      return locations;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw unavailable();
    } finally {
      clearTimeout(timeout);
    }
  };

  return async (rawQuery: string): Promise<NigeriaLocation[]> => {
    const query = rawQuery.trim().replace(/\s+/g, " ");
    if (query.length < 2) return [];
    const cacheKey = query.toLocaleLowerCase("en-NG");
    const cached = cache.get(cacheKey);
    if (cached && cached.expiresAt > now()) return cached.locations;
    cache.delete(cacheKey);

    const existingRequest = inFlight.get(cacheKey);
    if (existingRequest) return existingRequest;

    const request = searchProvider(query).then((locations) => {
      if (cache.size >= maxCacheEntries) {
        const oldestKey = cache.keys().next().value as string | undefined;
        if (oldestKey) cache.delete(oldestKey);
      }
      cache.set(cacheKey, { expiresAt: now() + cacheTtlMs, locations });
      return locations;
    }).finally(() => inFlight.delete(cacheKey));
    inFlight.set(cacheKey, request);
    return request;
  };
}

export const searchNigeriaLocations = createLocationSearchService({
  username: env.geonamesUsername,
});
