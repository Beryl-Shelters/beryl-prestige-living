import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  init: vi.fn(),
  identify: vi.fn(),
  register: vi.fn(),
  reset: vi.fn(),
  track: vi.fn(),
  get_distinct_id: vi.fn(() => "$device:anonymous-customer-1")
}));

vi.mock("mixpanel-browser", () => ({ default: mocks }));

const loadAnalytics = async () => import("./customer");

describe("Customer Mixpanel identity lifecycle", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_MIXPANEL_CUSTOMER_TOKEN", "test-customer-token");
  });

  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  it("tracks anonymous signup views with only the always-available global properties", async () => {
    const { trackCustomerEvent } = await loadAnalytics();
    await trackCustomerEvent("Signup Screen Viewed", { entry_point: "direct" });
    expect(mocks.init).toHaveBeenCalledTimes(1);
    expect(mocks.track).toHaveBeenCalledWith("[Test] Signup Screen Viewed", expect.objectContaining({ entry_point: "direct", platform: "Web", app_version: "1.0.0", environment: "Test" }));
    expect(mocks.track).not.toHaveBeenCalledWith("[Test] Signup Screen Viewed", expect.objectContaining({ account_id: expect.anything() }));
  });

  it("returns the existing safe anonymous Mixpanel identity for pre-auth telemetry", async () => {
    const { anonymousCustomerAnalyticsDistinctId } = await loadAnalytics();
    await expect(anonymousCustomerAnalyticsDistinctId()).resolves.toBe("$device:anonymous-customer-1");
  });

  it("identifies with the internal account ID and keeps the actual active persona in context", async () => {
    const { customerPersonaForAnalytics, identifyCustomerAnalytics, trackCustomerEvent, updateCustomerAnalyticsPersona } = await loadAnalytics();
    await identifyCustomerAnalytics("customer-internal-id", customerPersonaForAnalytics("BUYER"));
    await updateCustomerAnalyticsPersona(customerPersonaForAnalytics("SELLER_DEVELOPER"));
    await trackCustomerEvent("Signup Screen Viewed", { entry_point: "direct" });
    expect(mocks.identify).toHaveBeenCalledWith("customer-internal-id");
    expect(mocks.track).toHaveBeenCalledWith("[Test] Signup Screen Viewed", expect.objectContaining({ account_id: "customer-internal-id", active_persona: "Seller-Developer" }));
  });

  it("initializes once and resets identity on logout", async () => {
    const { identifyCustomerAnalytics, resetCustomerAnalytics, trackCustomerEvent } = await loadAnalytics();
    await identifyCustomerAnalytics("customer-internal-id", "Buyer");
    await trackCustomerEvent("Signup Screen Viewed", { entry_point: "direct" });
    await resetCustomerAnalytics();
    await trackCustomerEvent("Signup Screen Viewed", { entry_point: "direct" });
    expect(mocks.init).toHaveBeenCalledTimes(1);
    expect(mocks.reset).toHaveBeenCalledTimes(1);
    expect(mocks.track).toHaveBeenLastCalledWith("[Test] Signup Screen Viewed", expect.not.objectContaining({ account_id: expect.anything(), active_persona: expect.anything() }));
  });

  it("is SSR-safe and skips analytics when the token is missing", async () => {
    vi.stubEnv("NEXT_PUBLIC_MIXPANEL_CUSTOMER_TOKEN", "");
    const { trackCustomerEvent } = await loadAnalytics();
    await trackCustomerEvent("Signup Screen Viewed", { entry_point: "direct" });
    expect(mocks.init).not.toHaveBeenCalled();
    vi.stubEnv("NEXT_PUBLIC_MIXPANEL_CUSTOMER_TOKEN", "test-customer-token");
    vi.stubGlobal("window", undefined);
    vi.resetModules();
    const { trackCustomerEvent: trackOnServer } = await loadAnalytics();
    await trackOnServer("Signup Screen Viewed", { entry_point: "direct" });
    expect(mocks.init).not.toHaveBeenCalled();
  });

  it("accepts only the approved onboarding client-event properties", async () => {
    const { trackCustomerEvent } = await loadAnalytics();
    await trackCustomerEvent("Signup Submitted", { Initial_Persona: "Find a Property" });
    await trackCustomerEvent("Verification Screen Viewed", { otp_context: "signup" });
    await trackCustomerEvent("OTP Resend Requested", { otp_context: "signup", resend_count: 1 });
    await trackCustomerEvent("OTP Verification Failed", { otp_context: "forgot_password", attempt_number: 1, failure_reason: "expired" });
    await trackCustomerEvent("Onboarding Wizard Started", { persona_type: "Buyer", trigger_source: "signup" });
    await trackCustomerEvent("Buyer Onboarding Completed", { preferred_locations: ["Ikeja, Lagos"], budget_provided: true, skipped_budget: false });
    await trackCustomerEvent("Seller Onboarding Completed", { profile_type: "Business", company_name_provided: true, company_address_provided: true });
    await trackCustomerEvent("Persona Activation Started", { target_persona: "Seller-Developer" });
    await trackCustomerEvent("Persona Switched", { from_persona: "Buyer", to_persona: "Seller-Developer" });
    await trackCustomerEvent("Login Submitted", { login_identifier_type: "phone" });
    await trackCustomerEvent("Forgot Password Requested", {});
    await trackCustomerEvent("Logout", {});
    expect(mocks.track).toHaveBeenCalledTimes(12);
    expect(JSON.stringify(mocks.track.mock.calls)).not.toMatch(/"email"|"phone_number"|"password"|"full_name"|"company_name"|"company_address"|"access_token"|"refresh_token"/i);
  });

  it("uses an explicit production environment without changing canonical constants", async () => {
    vi.stubEnv("NEXT_PUBLIC_MIXPANEL_ENVIRONMENT", "production");
    const { customerMixpanelEventName, trackCustomerEvent } = await loadAnalytics();
    expect(customerMixpanelEventName("Signup Submitted", "Production")).toBe("[Production] Signup Submitted");
    expect(customerMixpanelEventName("[Test] Signup Submitted", "Production")).toBe("[Test] Signup Submitted");
    await trackCustomerEvent("Signup Submitted", { Initial_Persona: "Find a Property" });
    expect(mocks.track).toHaveBeenCalledWith("[Production] Signup Submitted", expect.objectContaining({ environment: "Production", Initial_Persona: "Find a Property" }));
  });
});
