import { describe, expect, it } from "vitest";
import { issueAdminAccessToken, issueAdminRefreshToken, verifyAdminAccessToken, verifyAdminRefreshToken } from "./admin-session.tokens";
import { issueCustomerAccessToken, verifyCustomerAccessToken } from "../auth-onboarding/customer-session.tokens";

const adminSecret = "a".repeat(40);
const customerSecret = "c".repeat(40);
const now = new Date("2026-08-05T12:00:00.000Z");
const base = { secret: adminSecret, adminId: "admin-1", sessionId: "session-1", sessionVersion: 1, role: "SUPER_ADMIN" as const, department: "MANAGEMENT" as const, restricted: false, expiresIn: 900, now };

describe("isolated Admin session tokens", () => {
  it("issues and verifies Admin-only access and refresh tokens", () => {
    const access = issueAdminAccessToken(base);
    const refresh = issueAdminRefreshToken(base);
    expect(verifyAdminAccessToken(access, adminSecret, now).aud).toBe("beryl-admin");
    expect(verifyAdminRefreshToken(refresh, adminSecret, now).typ).toBe("admin_refresh");
  });

  it("rejects a customer token even when token secrets are accidentally shared", () => {
    const customer = issueCustomerAccessToken({ secret: adminSecret, userId: "customer-1", sessionId: "customer-session", sessionVersion: 1, expiresIn: 900, now });
    expect(() => verifyAdminAccessToken(customer, adminSecret, now)).toThrow();
  });

  it("rejects an Admin token through customer verification", () => {
    const access = issueAdminAccessToken(base);
    expect(() => verifyCustomerAccessToken(access, adminSecret, now)).toThrow();
  });
});
