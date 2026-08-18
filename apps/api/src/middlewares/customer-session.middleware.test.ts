import { beforeEach, describe, expect, it, vi } from "vitest";
import { issueCustomerAccessToken } from "../modules/auth-onboarding/customer-session.tokens";

const accessSecret = vi.hoisted(
  () => "access-secret-that-is-at-least-32-characters"
);
const sessionSingle = vi.hoisted(() => vi.fn());
const profileSingle = vi.hoisted(() => vi.fn());
const from = vi.hoisted(() =>
  vi.fn((table: string) => ({
    select: () => ({
      eq: () => ({
        eq: () => ({ maybeSingle: sessionSingle }),
        maybeSingle: table === "profiles" ? profileSingle : sessionSingle
      })
    })
  }))
);

vi.mock("../config/env", () => ({
  env: { customerAccessTokenSecret: accessSecret }
}));
vi.mock("../config/supabase", () => ({ supabaseAdmin: { from } }));

import {
  customerLogoutMiddleware,
  customerSessionMiddleware,
  optionalCustomerSessionMiddleware
} from "./customer-session.middleware";

const now = new Date();
const token = issueCustomerAccessToken({
  secret: accessSecret,
  userId: "user-id",
  sessionId: "session-id",
  sessionVersion: 3,
  expiresIn: 900,
  now
});

const run = async (
  middleware: typeof customerSessionMiddleware | typeof optionalCustomerSessionMiddleware,
  bearer?: string
) => {
  const req = {
    headers: bearer ? { authorization: `Bearer ${bearer}` } : {}
  } as any;
  const next = vi.fn();
  await middleware(req, {} as any, next);
  return { req, next };
};

describe("customer session middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionSingle.mockResolvedValue({
      data: {
        id: "session-id",
        user_id: "user-id",
        session_version: 3,
        expires_at: new Date(Date.now() + 60_000).toISOString(),
        revoked_at: null,
        replaced_by_session_id: null
      },
      error: null
    });
    profileSingle.mockResolvedValue({
      data: {
        session_version: 3,
        account_status: "ACTIVE",
        email_verified_at: new Date().toISOString()
      },
      error: null
    });
  });

  it("rejects missing customer access tokens", async () => {
    const { next } = await run(customerSessionMiddleware);
    expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 401 });
  });

  it("rejects tokens signed for another/Admin domain", async () => {
    const adminToken = issueCustomerAccessToken({
      secret: "admin-secret-that-is-distinct-and-at-least-32-characters",
      userId: "admin-id",
      sessionId: "admin-session",
      sessionVersion: 1,
      expiresIn: 900,
      now
    });
    const { next } = await run(customerSessionMiddleware, adminToken);
    expect(next.mock.calls[0][0]).toMatchObject({
      statusCode: 401,
      code: "INVALID_ACCESS_TOKEN"
    });
  });

  it("accepts an active version-matched customer session", async () => {
    const { req, next } = await run(customerSessionMiddleware, token);
    expect(next).toHaveBeenCalledWith();
    expect(req.user).toEqual({ id: "user-id" });
    expect(req.customerSession).toEqual({ id: "session-id", version: 3 });
  });

  it("allows an anonymous optional customer session without database work", async () => {
    const { req, next } = await run(optionalCustomerSessionMiddleware);
    expect(next).toHaveBeenCalledWith();
    expect(req.user).toBeUndefined();
    expect(from).not.toHaveBeenCalled();
  });

  it("rejects malformed credentials supplied to optional authentication", async () => {
    const req = { headers: { authorization: "Basic not-a-bearer" } } as any;
    const next = vi.fn();
    await optionalCustomerSessionMiddleware(req, {} as any, next);
    expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 401 });
    expect(req.user).toBeUndefined();
  });

  it("rejects stale access tokens after session-version changes", async () => {
    profileSingle.mockResolvedValue({
      data: {
        session_version: 4,
        account_status: "ACTIVE",
        email_verified_at: new Date().toISOString()
      },
      error: null
    });
    const { next } = await run(customerSessionMiddleware, token);
    expect(next.mock.calls[0][0]).toMatchObject({
      statusCode: 401,
      code: "SESSION_NOT_FOUND"
    });
  });

  it("allows signed logout claims to reach idempotent session revocation", async () => {
    const { req, next } = await run(
      customerLogoutMiddleware as typeof customerSessionMiddleware,
      token
    );
    expect(next).toHaveBeenCalledWith();
    expect(req.customerSession.id).toBe("session-id");
    expect(from).not.toHaveBeenCalled();
  });
});
