import { describe, expect, it, vi } from "vitest";
import { createCustomerServerAnalytics } from "./customer-server-analytics";

describe("customer server analytics", () => {
  it("uses the EU client with only approved, non-PII properties", () => {
    const track = vi.fn();
    const analytics = createCustomerServerAnalytics("token", { track });

    analytics.accountCreated("customer-id", "Find a Property");
    analytics.signupBlockedDuplicate("email", "$device:anonymous-customer-1");
    analytics.loginFailed("$device:anonymous-customer-1");

    expect(track).toHaveBeenNthCalledWith(1, "[Test] Account Created", {
      distinct_id: "customer-id",
      account_id: "customer-id",
      Initial_Persona: "Find a Property", environment: "Test"
    }, expect.any(Function));
    expect(track).toHaveBeenNthCalledWith(2, "[Test] Signup Blocked – Duplicate Email/Phone", {
      distinct_id: "$device:anonymous-customer-1",
      duplicate_field: "email", environment: "Test"
    }, expect.any(Function));
    expect(track).toHaveBeenNthCalledWith(3, "[Test] Login Failed", {
      distinct_id: "$device:anonymous-customer-1",
      failure_reason: "generic", environment: "Test"
    }, expect.any(Function));
    const properties = track.mock.calls.map(([, value]) => value);
    expect(JSON.stringify(properties)).not.toMatch(/email@example|\+234|Password123|419205|reset-proof-token/i);
  });

  it("uses the production prefix only when explicitly configured", () => {
    const track = vi.fn();
    createCustomerServerAnalytics("token", { track }, "production").accountCreated("customer-id", "Find a Property");
    expect(track).toHaveBeenCalledWith("[Production] Account Created", expect.objectContaining({ environment: "Production" }), expect.any(Function));
  });

  it("does not emit pre-auth events without a safe anonymous identity", () => {
    const track = vi.fn();
    const analytics = createCustomerServerAnalytics("token", { track });
    analytics.signupBlockedDuplicate("phone");
    analytics.loginFailed();
    expect(track).not.toHaveBeenCalled();
  });

  it("is safe when no Mixpanel token is configured", () => {
    const analytics = createCustomerServerAnalytics("");
    expect(() => analytics.passwordResetCompleted("customer-id")).not.toThrow();
  });

  it("swallows synchronous Mixpanel failures", () => {
    const analytics = createCustomerServerAnalytics("token", {
      track: () => { throw new Error("telemetry unavailable"); }
    });
    expect(() => analytics.customerLoggedIn("customer-id", "Buyer")).not.toThrow();
  });
});
