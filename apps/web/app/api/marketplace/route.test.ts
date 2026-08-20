// @vitest-environment node
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const cookieState = vi.hoisted(() => ({ access: undefined as string | undefined }));
vi.mock("next/headers", () => ({ cookies: vi.fn(async () => ({ get: () => cookieState.access ? { value: cookieState.access } : undefined })) }));

const backendResponse = (data: object, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { "content-type": "application/json" }
});

describe("public Marketplace BFF", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.API_BASE_URL = "http://localhost:5000/api/v1";
    cookieState.access = undefined;
  });

  it("forwards supported public search parameters without authentication", async () => {
    const fetchMock = vi.fn().mockResolvedValue(backendResponse({ success: true, data: { properties: [], pagination: {} } }));
    vi.stubGlobal("fetch", fetchMock);
    const request = new NextRequest("http://localhost/api/marketplace?q=lekki&location=Lagos&minPrice=100&maxPrice=500&propertyType=DUPLEX&category=RESIDENTIAL&condition=NEWLY_BUILT,OFF_PLAN&furnishing=FULLY_FURNISHED&bedrooms=5%2B&sort=MOST_RECENT&page=2&limit=12&privateField=blocked");
    const response = await GET(request);
    const [url, options] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe("http://localhost:5000/api/v1/marketplace/properties?q=lekki&location=Lagos&minPrice=100&maxPrice=500&propertyType=DUPLEX&category=RESIDENTIAL&condition=NEWLY_BUILT%2COFF_PLAN&furnishing=FULLY_FURNISHED&bedrooms=5%2B&sort=MOST_RECENT&page=2&limit=12");
    expect(options.headers).toEqual({ accept: "application/json" });
    expect(response.status).toBe(200);
  });

  it("forwards the HttpOnly customer session for saved-state enrichment", async () => {
    cookieState.access = "dummy-access-token";
    const fetchMock = vi.fn().mockResolvedValue(backendResponse({ success: true, data: { properties: [], pagination: {} } }));
    vi.stubGlobal("fetch", fetchMock);
    await GET(new NextRequest("http://localhost/api/marketplace"));
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ headers: { accept: "application/json", authorization: "Bearer dummy-access-token" } });
  });

  it("preserves safe upstream errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(backendResponse({ success: false, message: "Invalid Marketplace search filters", code: "INVALID_PRICE_RANGE" }, 400)));
    const response = await GET(new NextRequest("http://localhost/api/marketplace?minPrice=500&maxPrice=100"));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ success: false, code: "INVALID_PRICE_RANGE" });
  });

  it("returns a sanitized unavailable response when the upstream cannot be reached", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("private upstream details")));
    const response = await GET(new NextRequest("http://localhost/api/marketplace"));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ success: false, message: "Marketplace is temporarily unavailable", code: "MARKETPLACE_UNAVAILABLE" });
  });
});
