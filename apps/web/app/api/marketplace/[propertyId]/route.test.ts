// @vitest-environment node
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ cookies: new Map<string, string>() }));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) => state.cookies.has(name) ? { name, value: state.cookies.get(name) } : undefined
  }))
}));

import { GET } from "./route";

const id = "11111111-1111-4111-8111-111111111111";
const request = (propertyId = id) => GET(new NextRequest(`http://localhost/api/marketplace/${propertyId}`), { params: Promise.resolve({ propertyId }) });
const backendResponse = (data: object, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });

describe("Marketplace property detail BFF", () => {
  beforeEach(() => {
    state.cookies.clear();
    vi.restoreAllMocks();
    process.env.API_BASE_URL = "http://localhost:5000/api/v1/";
  });

  it("serves a public property detail anonymously through the server-only API base URL", async () => {
    const fetchMock = vi.fn().mockResolvedValue(backendResponse({ success: true, data: { property: { id } } }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await request();

    expect(fetchMock).toHaveBeenCalledWith(`http://localhost:5000/api/v1/marketplace/properties/${id}`, expect.objectContaining({ headers: { accept: "application/json" } }));
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).headers).not.toHaveProperty("authorization");
    expect(response.status).toBe(200);
  });

  it("forwards only the HttpOnly access cookie and retries anonymously when it is stale", async () => {
    state.cookies.set("beryl_customer_access", "stale-access-token");
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(backendResponse({ success: false }, 401))
      .mockResolvedValueOnce(backendResponse({ success: true, data: { property: { id, saved: false } } }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await request();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ headers: { accept: "application/json", authorization: "Bearer stale-access-token" } });
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ headers: { accept: "application/json" } });
    expect(response.status).toBe(200);
  });

  it("returns a safe unavailable response without requesting malformed identifiers", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await request("not-a-property-id");

    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: "MARKETPLACE_PROPERTY_NOT_FOUND" });
  });
});
