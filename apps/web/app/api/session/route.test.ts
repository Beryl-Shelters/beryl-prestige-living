// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ cookies: new Map<string, string>() }));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) => state.cookies.has(name) ? { name, value: state.cookies.get(name) } : undefined,
  })),
}));

import { GET } from "./route";

const buyerState = {
  user: { id: "customer-id", fullName: "Ada Buyer", email: "ada@example.com", phone: null, accountStatus: "ACTIVE", emailVerified: true },
  activePersona: "BUYER",
  personas: [{ type: "BUYER", onboardingStatus: "COMPLETED" }],
  nextAction: "OPEN_BUYER_DASHBOARD",
};

const backendResponse = (data: object, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { "content-type": "application/json" },
});

describe("canonical customer session bootstrap", () => {
  beforeEach(() => {
    state.cookies.clear();
    vi.restoreAllMocks();
    process.env.API_BASE_URL = "http://localhost:5000/api/v1/";
  });

  it.each([
    ["no credentials", []],
    ["referral tracking only", [["beryl_referral_tracking", "tracking-token"]]],
    ["Admin only", [["beryl_admin_access", "admin-token"]]],
  ] as const)("rejects %s as a Customer session", async (_label, entries) => {
    for (const [name, value] of entries) state.cookies.set(name, value);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET();

    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.headers.get("set-cookie")).toContain("beryl_customer_access=");
  });

  it("validates an access cookie and refreshes canonical persona/onboarding state", async () => {
    state.cookies.set("beryl_customer_access", "access-token");
    state.cookies.set("beryl_customer_state", JSON.stringify({ ...buyerState, activePersona: "SELLER_DEVELOPER", nextAction: "OPEN_SELLER_DASHBOARD" }));
    const fetchMock = vi.fn().mockResolvedValue(backendResponse({
      success: true,
      message: "Status fetched",
      data: { activePersona: "BUYER", personas: buyerState.personas, nextAction: "OPEN_BUYER_DASHBOARD" },
    }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toMatchObject({ activePersona: "BUYER", nextAction: "OPEN_BUYER_DASHBOARD", user: buyerState.user });
    expect(fetchMock).toHaveBeenCalledWith("http://localhost:5000/api/v1/onboarding/status", expect.objectContaining({ headers: expect.objectContaining({ authorization: "Bearer access-token" }) }));
    expect(decodeURIComponent(response.headers.get("set-cookie") ?? "")).toContain('"activePersona":"BUYER"');
  });

  it("restores an expired access session by rotating the HttpOnly refresh token once", async () => {
    state.cookies.set("beryl_customer_access", "expired-access");
    state.cookies.set("beryl_customer_refresh", "refresh-token");
    state.cookies.set("beryl_customer_state", JSON.stringify(buyerState));
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(backendResponse({ success: false }, 401))
      .mockResolvedValueOnce(backendResponse({ success: true, data: { accessToken: "new-access", refreshToken: "new-refresh", accessTokenExpiresIn: 900, refreshTokenExpiresIn: 2592000 } }))
      .mockResolvedValueOnce(backendResponse({ success: true, data: { activePersona: "BUYER", personas: buyerState.personas, nextAction: "OPEN_BUYER_DASHBOARD" } }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      "http://localhost:5000/api/v1/onboarding/status",
      "http://localhost:5000/api/v1/auth/refresh",
      "http://localhost:5000/api/v1/onboarding/status",
    ]);
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ method: "POST", body: JSON.stringify({ refreshToken: "refresh-token" }) });
    expect(fetchMock.mock.calls[2]?.[1].headers).toMatchObject({ authorization: "Bearer new-access" });
    expect(response.headers.get("set-cookie")).toContain("beryl_customer_refresh=new-refresh");
  });

  it("can bootstrap from refresh and state cookies when the access cookie has expired", async () => {
    state.cookies.set("beryl_customer_refresh", "refresh-token");
    state.cookies.set("beryl_customer_state", JSON.stringify(buyerState));
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(backendResponse({ success: true, data: { accessToken: "new-access", refreshToken: "new-refresh", accessTokenExpiresIn: 900, refreshTokenExpiresIn: 2592000 } }))
      .mockResolvedValueOnce(backendResponse({ success: true, data: { activePersona: "BUYER", personas: buyerState.personas, nextAction: "OPEN_BUYER_DASHBOARD" } }));
    vi.stubGlobal("fetch", fetchMock);

    expect((await GET()).status).toBe(200);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("http://localhost:5000/api/v1/auth/refresh");
  });

  it("clears the Customer session when refresh is rejected", async () => {
    state.cookies.set("beryl_customer_refresh", "invalid-refresh");
    state.cookies.set("beryl_customer_state", JSON.stringify(buyerState));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(backendResponse({ success: false }, 401)));

    const response = await GET();

    expect(response.status).toBe(401);
    expect(response.headers.get("set-cookie")).toContain("beryl_customer_refresh=");
  });
});
