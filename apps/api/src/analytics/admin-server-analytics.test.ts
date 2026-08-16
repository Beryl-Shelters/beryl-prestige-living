import { describe, expect, it, vi } from "vitest";
import { createAdminServerAnalytics } from "./admin-server-analytics";
import { sanitizeAdminAnalyticsDistinctId } from "./admin-analytics-identity";

describe("Admin server Mixpanel analytics", () => {
  it("is a no-op without an Admin project token", () => {
    expect(() => createAdminServerAnalytics("").loginFailed("$device:test")).not.toThrow();
  });

  it("uses only the Admin project client and excludes PII", () => {
    const track = vi.fn();
    const analytics = createAdminServerAnalytics("admin-token", { track });
    analytics.adminInvited("actor-1", "TECH", "ADMIN");
    analytics.loginFailed("$device:anonymous");
    expect(track).toHaveBeenCalledWith("[Test] Admin Invited", expect.objectContaining({ distinct_id: "actor-1", invitee_department: "Tech", invitee_role: "Admin", environment: "Test" }), expect.any(Function));
    expect(track).toHaveBeenCalledWith("[Test] Login Failed", { distinct_id: "$device:anonymous", failure_reason: "generic", environment: "Test" }, expect.any(Function));
    expect(JSON.stringify(track.mock.calls)).not.toMatch(/email|password|otp|token/i);
  });

  it("uses the explicit production label", () => {
    const track = vi.fn();
    createAdminServerAnalytics("admin-token", { track }, "production").adminLoggedIn({ id: "admin-1", adminRole: "ADMIN", department: "TECH" });
    expect(track).toHaveBeenCalledWith("[Production] Admin Logged In", expect.objectContaining({ environment: "Production" }), expect.any(Function));
  });

  it("accepts only telemetry-safe anonymous device identities", () => {
    expect(sanitizeAdminAnalyticsDistinctId("$device:abc_123")).toBe("$device:abc_123");
    expect(sanitizeAdminAnalyticsDistinctId("admin@example.com")).toBeUndefined();
    expect(sanitizeAdminAnalyticsDistinctId("$device:contains space")).toBeUndefined();
  });
});
