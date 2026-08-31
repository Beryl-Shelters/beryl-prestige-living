// @vitest-environment node
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const backendResponse = (data: object, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { "content-type": "application/json" },
});

describe("Nigeria location-search BFF", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.API_BASE_URL = "http://localhost:5000/api/v1";
  });

  it("forwards only the trimmed query to the public API", async () => {
    const fetchMock = vi.fn().mockResolvedValue(backendResponse({ success: true, data: { locations: [] } }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await GET(new NextRequest("http://localhost/api/locations/search?q=%20%20Ile%20%20&customerId=blocked"));
    const [url, options] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe("http://localhost:5000/api/v1/locations/search?q=Ile");
    expect(options).toEqual({ headers: { accept: "application/json" }, cache: "no-store" });
    expect(result.status).toBe(200);
  });

  it("rejects invalid search text before calling the backend", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const result = await GET(new NextRequest("http://localhost/api/locations/search?q=I"));
    expect(result.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await result.json()).toMatchObject({ code: "INVALID_LOCATION_QUERY" });
  });

  it("returns a sanitized unavailable response when the API cannot be reached", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("private upstream details")));
    const result = await GET(new NextRequest("http://localhost/api/locations/search?q=Kaduna"));
    expect(result.status).toBe(503);
    expect(await result.json()).toEqual({
      success: false,
      message: "Location suggestions are temporarily unavailable",
      code: "LOCATION_SEARCH_UNAVAILABLE",
    });
  });
});
