import { describe, expect, it, vi } from "vitest";
import { createLocationSearchService } from "./location.service";

const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json" },
});

describe("Nigeria location search service", () => {
  it("does not call the provider for a query shorter than two characters", async () => {
    const fetcher = vi.fn();
    const search = createLocationSearchService({ username: "test-user", fetcher });
    await expect(search(" I ")).resolves.toEqual([]);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("trims partial searches, requests Nigeria only, and returns bounded safe DTOs", async () => {
    const places = Array.from({ length: 14 }, (_, index) => ({
      geonameId: index + 1,
      name: `Ile Place ${index + 1}`,
      adminName1: "Osun",
      countryCode: "NG",
      featureClass: index === 0 ? "A" : "P",
      featureCode: index === 0 ? "ADM2" : "PPL",
      population: 123,
      lat: "private-provider-field",
    }));
    places.splice(2, 0, { ...places[1], geonameId: 100 });
    places.splice(3, 0, { ...places[1], geonameId: 101, countryCode: "GH" });
    const fetcher = vi.fn().mockResolvedValue(response({ geonames: places }));
    const search = createLocationSearchService({ username: "server-account", fetcher });

    const locations = await search("  Ile   Place ");

    const requested = fetcher.mock.calls[0][0] as URL;
    expect(requested.origin).toBe("https://secure.geonames.org");
    expect(requested.searchParams.get("name_startsWith")).toBe("Ile Place");
    expect(requested.searchParams.get("country")).toBe("NG");
    expect(requested.searchParams.getAll("featureClass")).toEqual(["A", "P", "L"]);
    expect(requested.searchParams.get("maxRows")).toBe("24");
    expect(locations).toHaveLength(12);
    expect(locations[0]).toEqual({ id: "1", label: "Ile Place 1, Osun", state: "Osun", type: "LGA" });
    expect(locations.every((location) => Object.keys(location).sort().join(",") === "id,label,state,type")).toBe(true);
  });

  it("caches normalized queries and coalesces concurrent provider requests", async () => {
    let resolve!: (value: Response) => void;
    const fetcher = vi.fn().mockImplementation(() => new Promise<Response>((done) => { resolve = done; }));
    const search = createLocationSearchService({ username: "test-user", fetcher });
    const first = search("Abeokuta");
    const concurrent = search(" abeokuta ");
    resolve(response({ geonames: [] }));

    await expect(Promise.all([first, concurrent])).resolves.toEqual([[], []]);
    await expect(search("ABEOKUTA")).resolves.toEqual([]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("expires cached searches after the configured TTL", async () => {
    let time = 1_000;
    const fetcher = vi.fn().mockImplementation(() => Promise.resolve(response({ geonames: [] })));
    const search = createLocationSearchService({
      username: "test-user",
      fetcher,
      cacheTtlMs: 50,
      now: () => time,
    });
    await search("Kano");
    time += 51;
    await search("Kano");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("maps provider timeouts, malformed payloads, and missing configuration to one safe error", async () => {
    const hangingFetcher = vi.fn().mockImplementation((_url: URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new Error("provider timeout details")));
      }));
    const timeoutSearch = createLocationSearchService({ username: "test-user", fetcher: hangingFetcher, timeoutMs: 5 });
    const malformedSearch = createLocationSearchService({
      username: "test-user",
      fetcher: vi.fn().mockResolvedValue(response({ status: { message: "provider account details" } })),
    });
    const unconfiguredSearch = createLocationSearchService({ username: "", fetcher: vi.fn() });

    for (const search of [timeoutSearch, malformedSearch, unconfiguredSearch]) {
      await expect(search("Ibadan")).rejects.toMatchObject({
        message: "Location suggestions are temporarily unavailable",
        statusCode: 503,
        code: "LOCATION_SEARCH_UNAVAILABLE",
      });
    }
  });

  it("sends no customer identity or onboarding data to the provider", async () => {
    const fetcher = vi.fn().mockResolvedValue(response({ geonames: [] }));
    const search = createLocationSearchService({ username: "server-account", fetcher });
    await search("Enugu");
    const requested = fetcher.mock.calls[0][0] as URL;
    expect([...requested.searchParams.keys()].sort()).toEqual([
      "country", "featureClass", "featureClass", "featureClass", "lang", "maxRows", "name_startsWith", "style", "username",
    ].sort());
    expect(requested.toString()).not.toMatch(/email|phone|customer|budget|persona/i);
  });
});
