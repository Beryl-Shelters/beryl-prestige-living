// @vitest-environment node
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ cookies: new Map<string, string>() }));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) => state.cookies.has(name) ? { name, value: state.cookies.get(name) } : undefined
  }))
}));

import { DELETE, GET, PATCH, POST, PUT } from "./[...path]/route";

const call = (path: string[], body: object = {}, headers: Record<string, string> = {}) => POST(
  new NextRequest(`http://localhost/api/customer/${path.join("/")}`, { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json", ...headers } }),
  { params: Promise.resolve({ path }) }
);

const callPatch = (path: string[], body: object = {}) => PATCH(
  new NextRequest(`http://localhost/api/customer/${path.join("/")}`, { method: "PATCH", body: JSON.stringify(body), headers: { "content-type": "application/json" } }),
  { params: Promise.resolve({ path }) }
);

const callDelete = (path: string[]) => DELETE(
  new NextRequest(`http://localhost/api/customer/${path.join("/")}`, { method: "DELETE" }),
  { params: Promise.resolve({ path }) }
);
const callGet = (path: string[]) => GET(new NextRequest(`http://localhost/api/customer/${path.join("/")}`), { params: Promise.resolve({ path }) });
const callPut = (path: string[], body: object) => PUT(new NextRequest(`http://localhost/api/customer/${path.join("/")}`, { method: "PUT", body: JSON.stringify(body), headers: { "content-type": "application/json" } }), { params: Promise.resolve({ path }) });

const backendResponse = (data: object, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { "content-type": "application/json" }
});

describe("customer BFF cookie bridge", () => {
  beforeEach(() => {
    state.cookies.clear();
    vi.restoreAllMocks();
    process.env.API_BASE_URL = "http://localhost:5000/api/v1/";
  });

  it.each([
    ["register", "http://localhost:5000/api/v1/auth/register"],
    ["login", "http://localhost:5000/api/v1/auth/login"]
  ])("maps the %s BFF route to the correct upstream URL", async (path, expectedUrl) => {
    const fetchMock = vi.fn().mockResolvedValue(backendResponse({ success: false, message: "validation", code: "VALIDATION_ERROR" }, 400));
    vi.stubGlobal("fetch", fetchMock);
    await call([path]);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(expectedUrl);
  });

  it("forwards only a valid anonymous analytics identity on pre-auth requests", async () => {
    const fetchMock = vi.fn().mockResolvedValue(backendResponse({ success: false }, 401));
    vi.stubGlobal("fetch", fetchMock);
    await call(["login"], {}, { "x-beryl-analytics-distinct-id": "$device:anonymous-customer-1" });
    expect(fetchMock.mock.calls[0]?.[1].headers).toMatchObject({ "x-beryl-analytics-distinct-id": "$device:anonymous-customer-1" });
    await call(["login"], {}, { "x-beryl-analytics-distinct-id": "spoofed-account-id" });
    expect(fetchMock.mock.calls[1]?.[1].headers).not.toHaveProperty("x-beryl-analytics-distinct-id");
  });

  it("maps an upstream 404 to a stable sanitized error", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(backendResponse({ success: false, message: "Route not found" }, 404)));
    const response = await call(["register"]);
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ success: false, message: "The authentication service route could not be reached.", code: "UPSTREAM_ROUTE_NOT_FOUND" });
    expect(console.warn).toHaveBeenCalledWith("[customer-bff] upstream 404 POST http://localhost:5000/api/v1/auth/register");
  });

  it("stores login tokens in HttpOnly cookies and strips them from browser JSON", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(backendResponse({ success: true, message: "Login successful", data: {
      user: { id: "customer-id", fullName: "Test Customer", email: "customer@example.com", phone: "+2348012345678", accountStatus: "ACTIVE", emailVerified: true },
      activePersona: "BUYER", personas: [{ type: "BUYER", onboardingStatus: "COMPLETED" }], nextAction: "OPEN_BUYER_DASHBOARD",
      accessToken: "dummy-access-token", refreshToken: "dummy-refresh-token", accessTokenExpiresIn: 900, refreshTokenExpiresIn: 2592000
    } })));
    const response = await call(["login"], { identifier: "customer@example.com", password: "not-a-real-password" });
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
    const response = await call(["refresh"]);
    expect(await response.json()).toEqual({ success: true, message: "Session refreshed successfully", data: { refreshed: true } });
    expect(response.headers.get("set-cookie")).toContain("beryl_customer_refresh=new-dummy-refresh-token");
  });

  it("stores the reset proof in an HttpOnly cookie without exposing it", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(backendResponse({ success: true, message: "Code verified", data: {
      resetToken: "dummy-reset-proof", expiresIn: 600, nextAction: "SET_NEW_PASSWORD"
    } })));
    const response = await call(["verify-password-reset-otp"], { email: "customer@example.com", otp: "123456" });
    expect(await response.json()).toEqual({ success: true, message: "Code verified", data: { expiresIn: 600, nextAction: "SET_NEW_PASSWORD" } });
    expect(response.headers.get("set-cookie")).toContain("beryl_reset_proof=dummy-reset-proof");
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
  });

  it("clears session cookies after logout", async () => {
    state.cookies.set("beryl_customer_access", "dummy-access-token");
    state.cookies.set("beryl_customer_refresh", "dummy-refresh-token");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(backendResponse({ success: true, message: "Logout successful" })));
    const response = await call(["logout"]);
    const cookieHeader = response.headers.get("set-cookie") ?? "";
    expect(cookieHeader).toContain("beryl_customer_access=");
    expect(cookieHeader).toContain("beryl_customer_refresh=");
    expect(cookieHeader).toContain("Expires=Thu, 01 Jan 1970 00:00:00 GMT");
  });

  it("clears session cookies when the logout upstream is unavailable", async () => {
    state.cookies.set("beryl_customer_access", "dummy-access-token");
    state.cookies.set("beryl_customer_refresh", "dummy-refresh-token");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network unavailable")));
    const response = await call(["logout"]);
    const cookieHeader = response.headers.get("set-cookie") ?? "";
    expect(response.status).toBe(503);
    expect(cookieHeader).toContain("beryl_customer_access=");
    expect(cookieHeader).toContain("beryl_customer_refresh=");
  });

  it("clears stale session cookies after a successful password change", async () => {
    state.cookies.set("beryl_customer_access", "dummy-access-token");
    state.cookies.set("beryl_customer_refresh", "dummy-refresh-token");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(backendResponse({ success: true, message: "Password changed", data: { sessionsInvalidated: true } })));
    const response = await callPatch(["change-password"], { currentPassword: "OldPassword123!", newPassword: "NewPassword123!", confirmPassword: "NewPassword123!" });
    const cookieHeader = response.headers.get("set-cookie") ?? "";
    expect(cookieHeader).toContain("beryl_customer_access=");
    expect(cookieHeader).toContain("beryl_customer_refresh=");
    expect(cookieHeader).toContain("Expires=Thu, 01 Jan 1970 00:00:00 GMT");
  });

  it("refreshes the canonical HttpOnly session state after a persona switch", async () => {
    state.cookies.set("beryl_customer_access", "dummy-access-token");
    state.cookies.set("beryl_customer_state", JSON.stringify({
      user: { id: "customer-id", fullName: "Test Customer", email: "customer@example.com", phone: null, accountStatus: "ACTIVE", emailVerified: true },
      activePersona: "BUYER", personas: [{ type: "BUYER", onboardingStatus: "COMPLETED" }], nextAction: "OPEN_BUYER_DASHBOARD"
    }));
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(backendResponse({ success: true, message: "Active persona changed", data: { activePersona: "SELLER_DEVELOPER", onboardingStatus: "COMPLETED", nextAction: "OPEN_SELLER_DASHBOARD" } }))
      .mockResolvedValueOnce(backendResponse({ success: true, message: "Status fetched", data: { activePersona: "SELLER_DEVELOPER", personas: [{ type: "BUYER", onboardingStatus: "COMPLETED" }, { type: "SELLER_DEVELOPER", onboardingStatus: "COMPLETED" }], nextAction: "OPEN_SELLER_DASHBOARD" } }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await callPatch(["personas", "active"], { personaType: "SELLER_DEVELOPER" });

    expect(fetchMock.mock.calls[1]?.[0]).toBe("http://localhost:5000/api/v1/onboarding/status");
    expect(fetchMock.mock.calls[1]?.[1].headers).toMatchObject({ authorization: "Bearer dummy-access-token" });
    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("beryl_customer_state=");
    expect(cookie).toContain("HttpOnly");
    expect(decodeURIComponent(cookie)).toContain('"activePersona":"SELLER_DEVELOPER"');
  });

  it("proxies authenticated property save and unsave requests through the secure cookie bridge", async () => {
    const id = "11111111-1111-4111-8111-111111111111";
    state.cookies.set("beryl_customer_access", "dummy-access-token");
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(backendResponse({ success: true, data: { saved_property: { id: "saved", propertyId: id, savedAt: "2026-08-18T10:00:00.000Z" } } }, 201))
      .mockResolvedValueOnce(backendResponse({ success: true, data: {} }));
    vi.stubGlobal("fetch", fetchMock);

    await call(["properties", id, "save"]);
    await callDelete(["properties", id, "save"]);

    expect(fetchMock.mock.calls[0]?.[0]).toBe(`http://localhost:5000/api/v1/properties/${id}/save`);
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: "POST", headers: expect.objectContaining({ authorization: "Bearer dummy-access-token" }) });
    expect(fetchMock.mock.calls[1]?.[0]).toBe(`http://localhost:5000/api/v1/properties/${id}/save`);
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ method: "DELETE", headers: expect.objectContaining({ authorization: "Bearer dummy-access-token" }), body: undefined });
  });

  it("proxies the authenticated canonical saved-property list", async () => {
    state.cookies.set("beryl_customer_access", "dummy-access-token");
    const fetchMock = vi.fn().mockResolvedValue(backendResponse({ success: true, data: { saved_properties: [], pagination: { page: 1, limit: 10, total: 0, total_pages: 0 } } }));
    vi.stubGlobal("fetch", fetchMock);
    const response = await callGet(["properties", "saved", "me"]);
    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith("http://localhost:5000/api/v1/properties/saved/me", expect.objectContaining({ method: "GET", headers: expect.objectContaining({ authorization: "Bearer dummy-access-token" }) }));
  });

  it("forwards Seller draft POST and PATCH JSON with the HttpOnly customer session", async () => {
    const id = "11111111-1111-4111-8111-111111111111";
    const body = { title: "3 bedroom", propertyCategory: "RESIDENTIAL", propertyType: "DUPLEX", ownershipType: "PERSONAL", askingPrice: 75000000 };
    state.cookies.set("beryl_customer_access", "seller-access-token");
    const fetchMock = vi.fn().mockResolvedValue(backendResponse({ success: true, message: "Saved", data: { property: { id } } }, 201));
    vi.stubGlobal("fetch", fetchMock);

    await call(["marketplace", "seller", "properties"], body);
    await callPatch(["marketplace", "seller", "properties", id], { ...body, currentStep: "PHOTOS_DOCUMENTS" });

    expect(fetchMock.mock.calls[0]?.[0]).toBe("http://localhost:5000/api/v1/marketplace/seller/properties");
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: "POST", body: JSON.stringify(body), headers: expect.objectContaining({ authorization: "Bearer seller-access-token", "content-type": "application/json" }) });
    expect(fetchMock.mock.calls[1]?.[0]).toBe(`http://localhost:5000/api/v1/marketplace/seller/properties/${id}`);
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ method: "PATCH", body: JSON.stringify({ ...body, currentStep: "PHOTOS_DOCUMENTS" }), headers: expect.objectContaining({ authorization: "Bearer seller-access-token", "content-type": "application/json" }) });
  });

  it("forwards Seller draft DELETE without a request body through the HttpOnly session", async () => {
    const id = "11111111-1111-4111-8111-111111111111";
    state.cookies.set("beryl_customer_access", "seller-access-token");
    const fetchMock = vi.fn().mockResolvedValue(backendResponse({ success: true, message: "Deleted", data: { propertyId: id, deleted: true } }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await callDelete(["marketplace", "seller", "properties", id]);

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(`http://localhost:5000/api/v1/marketplace/seller/properties/${id}`, expect.objectContaining({ method: "DELETE", body: undefined, headers: expect.objectContaining({ authorization: "Bearer seller-access-token" }) }));
  });

  it("preserves safe Seller draft validation errors through the BFF", async () => {
    state.cookies.set("beryl_customer_access", "seller-access-token");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(backendResponse({ success: false, message: "Validation failed", code: "INVALID_DRAFT_PAYLOAD", errors: { fieldErrors: { propertyType: ["Invalid enum value"] } } }, 400)));

    const response = await call(["marketplace", "seller", "properties"], { propertyType: "resd" });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "INVALID_DRAFT_PAYLOAD", errors: { fieldErrors: { propertyType: expect.any(Array) } } });
  });

  it("proxies Express Interest with its safe request body and preserves domain availability errors", async () => {
    const id = "11111111-1111-4111-8111-111111111111";
    state.cookies.set("beryl_customer_access", "dummy-access-token");
    const fetchMock = vi.fn().mockResolvedValue(backendResponse({ success: false, message: "Property not available", code: "PROPERTY_NOT_AVAILABLE" }, 404));
    vi.stubGlobal("fetch", fetchMock);

    const response = await call(["marketplace", "properties", id, "interest"], { contactMethod: "EMAIL", message: "Please contact me" });

    expect(fetchMock.mock.calls[0]?.[0]).toBe(`http://localhost:5000/api/v1/marketplace/properties/${id}/interest`);
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: "POST",
      headers: expect.objectContaining({ authorization: "Bearer dummy-access-token" }),
      body: JSON.stringify({ contactMethod: "EMAIL", message: "Please contact me" })
    });
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: "PROPERTY_NOT_AVAILABLE" });
  });

  it("securely proxies Seller mandate, review, and submit operations", async () => {
    const id = "11111111-1111-4111-8111-111111111111";
    state.cookies.set("beryl_customer_access", "dummy-access-token");
    const fetchMock = vi.fn().mockResolvedValue(backendResponse({ success: true, message: "ok", data: {} }));
    vi.stubGlobal("fetch", fetchMock);
    const mandate = { mandateType: "OPEN", sellerFullName: "Test Seller", ownershipConfirmed: true, mandateAccepted: true };

    await callGet(["marketplace", "seller", "properties", id, "mandate"]);
    await callPut(["marketplace", "seller", "properties", id, "mandate"], mandate);
    await callGet(["marketplace", "seller", "properties", id, "review"]);
    await call(["marketplace", "seller", "properties", id, "submit"]);

    expect(fetchMock.mock.calls.map((entry) => entry[0])).toEqual([
      `http://localhost:5000/api/v1/marketplace/seller/properties/${id}/mandate`,
      `http://localhost:5000/api/v1/marketplace/seller/properties/${id}/mandate`,
      `http://localhost:5000/api/v1/marketplace/seller/properties/${id}/review`,
      `http://localhost:5000/api/v1/marketplace/seller/properties/${id}/submit`
    ]);
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ method: "PUT", body: JSON.stringify(mandate), headers: expect.objectContaining({ authorization: "Bearer dummy-access-token" }) });
    expect(fetchMock.mock.calls[3]?.[1]).toMatchObject({ method: "POST", body: "{}", headers: expect.objectContaining({ authorization: "Bearer dummy-access-token" }) });
  });

  it("proxies a rejected Seller listing reopen with the existing property ID and no client data", async () => {
    const id = "11111111-1111-4111-8111-111111111111";
    state.cookies.set("beryl_customer_access", "dummy-access-token");
    const fetchMock = vi.fn().mockResolvedValue(backendResponse({ success: true, message: "Reopened", data: { propertyId: id, status: "DRAFT", currentStep: "REVIEW" } }));
    vi.stubGlobal("fetch", fetchMock);

    await call(["marketplace", "seller", "properties", id, "reopen"]);

    expect(fetchMock).toHaveBeenCalledWith(`http://localhost:5000/api/v1/marketplace/seller/properties/${id}/reopen`, expect.objectContaining({ method: "POST", body: "{}", headers: expect.objectContaining({ authorization: "Bearer dummy-access-token" }) }));
  });
});
