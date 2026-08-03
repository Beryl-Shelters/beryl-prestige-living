import { describe, expect, it } from "vitest";
import {
  CustomerTokenError,
  hashToken,
  issueCustomerAccessToken,
  issueCustomerRefreshToken,
  verifyCustomerAccessToken,
  verifyCustomerRefreshToken
} from "./customer-session.tokens";

const accessSecret = "access-secret-that-is-at-least-32-characters";
const refreshSecret = "refresh-secret-that-is-at-least-32-characters";
const now = new Date("2026-08-03T10:00:00.000Z");

describe("customer session tokens", () => {
  it("issues minimal customer-only access claims", () => {
    const token = issueCustomerAccessToken({
      secret: accessSecret,
      userId: "user-id",
      sessionId: "session-id",
      sessionVersion: 4,
      expiresIn: 900,
      now
    });

    expect(verifyCustomerAccessToken(token, accessSecret, now)).toEqual({
      sub: "user-id",
      sid: "session-id",
      ver: 4,
      aud: "beryl-customer",
      typ: "customer_access",
      iat: 1785751200,
      exp: 1785752100
    });
    expect(token).not.toContain("password");
  });

  it("issues signed random customer refresh tokens", () => {
    const first = issueCustomerRefreshToken({
      secret: refreshSecret,
      userId: "user-id",
      sessionId: "session-id",
      expiresIn: 2_592_000,
      now
    });
    const second = issueCustomerRefreshToken({
      secret: refreshSecret,
      userId: "user-id",
      sessionId: "session-id",
      expiresIn: 2_592_000,
      now
    });

    expect(first).not.toBe(second);
    expect(verifyCustomerRefreshToken(first, refreshSecret, now)).toMatchObject({
      sub: "user-id",
      sid: "session-id",
      aud: "beryl-customer",
      typ: "customer_refresh"
    });
    expect(hashToken(first)).toMatch(/^[a-f0-9]{64}$/);
  });

  it("rejects customer tokens under a different/Admin secret", () => {
    const token = issueCustomerAccessToken({
      secret: accessSecret,
      userId: "user-id",
      sessionId: "session-id",
      sessionVersion: 1,
      expiresIn: 900,
      now
    });

    expect(() =>
      verifyCustomerAccessToken(
        token,
        "admin-secret-that-is-distinct-and-at-least-32-characters",
        now
      )
    ).toThrow(CustomerTokenError);
  });

  it("rejects expired access and refresh tokens", () => {
    const access = issueCustomerAccessToken({
      secret: accessSecret,
      userId: "user-id",
      sessionId: "session-id",
      sessionVersion: 1,
      expiresIn: 1,
      now
    });
    const refresh = issueCustomerRefreshToken({
      secret: refreshSecret,
      userId: "user-id",
      sessionId: "session-id",
      expiresIn: 1,
      now
    });
    const later = new Date(now.getTime() + 2_000);

    expect(() => verifyCustomerAccessToken(access, accessSecret, later)).toThrow(
      expect.objectContaining({ reason: "EXPIRED" })
    );
    expect(() => verifyCustomerRefreshToken(refresh, refreshSecret, later)).toThrow(
      expect.objectContaining({ reason: "EXPIRED" })
    );
  });
});
