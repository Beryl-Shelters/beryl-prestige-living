// @vitest-environment node
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ cookies: new Map<string, string>() }));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) => state.cookies.has(name) ? { name, value: state.cookies.get(name) } : undefined
  }))
}));

import { POST } from "./[...path]/route";

const call = (path: string[], body: object = {}) => POST(
  new NextRequest(`http://localhost/api/customer/${path.join("/")}`, { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } }),
  { params: Promise.resolve({ path }) }
);

const backendResponse = (data: object, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { "content-type": "application/json" }
});

describe("customer BFF cookie bridge", () => {
  beforeEach(() => {
    state.cookies.clear();
    vi.restoreAllMocks();
  });

  it("stores login tokens in HttpOnly cookies and strips them from browser JSON", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(backendResponse({ success: true, message: "Login successful", data: {
      user: { id: "customer-id", fullName: "Test Customer", email: "customer@example.com", phone: "+2348012345678", accountStatus: "ACTIVE", emailVerified: true },
      activePersona: "BUYER", personas: [{ type: "BUYER", onboardingStatus: "COMPLETED" }], nextAction: "OPEN_BUYER_DASHBOARD",
      accessToken: "dummy-access-token", refreshToken: "dummy-refresh-token", accessTokenExpiresIn: 900, refreshTokenExpiresIn: 2592000
    } })));
    const response = await call(["auth", "login"], { identifier: "customer@example.com", password: "not-a-real-password" });
    const body = await response.json();
    expect(body.data).not.toHaveProperty("accessToken");
    expect(body.data).not.toHaveProperty("refreshToken");
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("set-cookie")).toContain("beryl_customer_refresh=dummy-refresh-token");
  });

  it("rotates a refresh cookie without exposing replacement tokens", async () => {
    state.cookies.set("beryl_customer_refresh", "old-dummy-refresh-token");
    state.cookies.set("beryl_customer_state", JSON.stringify({ activePersona: "BUYER" }));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(backendResponse({ success: true, message: "Session refreshed successfully", data: {
      accessToken: "new-dummy-access-token", refreshToken: "new-dummy-refresh-token", accessTokenExpiresIn: 900, refreshTokenExpiresIn: 2592000
    } })));
    const response = await call(["auth", "refresh"]);
    expect(await response.json()).toEqual({ success: true, message: "Session refreshed successfully", data: { refreshed: true } });
    expect(response.headers.get("set-cookie")).toContain("beryl_customer_refresh=new-dummy-refresh-token");
  });

  it("clears session cookies after logout", async () => {
    state.cookies.set("beryl_customer_access", "dummy-access-token");
    state.cookies.set("beryl_customer_refresh", "dummy-refresh-token");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(backendResponse({ success: true, message: "Logout successful" })));
    const response = await call(["auth", "logout"]);
    const cookieHeader = response.headers.get("set-cookie") ?? "";
    expect(cookieHeader).toContain("beryl_customer_access=");
    expect(cookieHeader).toContain("beryl_customer_refresh=");
    expect(cookieHeader).toContain("Expires=Thu, 01 Jan 1970 00:00:00 GMT");
  });
});
