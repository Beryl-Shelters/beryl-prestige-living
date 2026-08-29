import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../../utils/AppError";
import type { ReferralOtpDelivery } from "./referral.provider";

type Result = { data: unknown; error: null | { message: string } };
const database = vi.hoisted(() => ({
  calls: [] as Array<{ table: string; method: string; args: unknown[] }>,
  queues: {} as Record<string, Result[]>
}));

vi.mock("../../config/env", () => ({ env: {
  clientWebUrl: "http://localhost:3000",
  otpSecret: "test-referral-otp-secret-at-least-32-characters",
  referralOtpProvider: "disabled",
  termiiApiKey: "",
  termiiBaseUrl: "",
  termiiSenderId: "",
  termiiChannel: "",
  referralPayoutEncryptionKey: ""
} }));

vi.mock("../../config/supabase", () => ({
  supabaseAdmin: {
    from(table: string) {
      let terminalResult: Result | undefined;
      const query: Record<string, unknown> = {};
      const chain = (method: string) => (...args: unknown[]) => {
        database.calls.push({ table, method, args });
        return query;
      };
      for (const method of ["select", "eq", "is", "order", "limit", "insert", "delete", "update"]) {
        query[method] = chain(method);
      }
      const take = () => {
        terminalResult = database.queues[table]?.shift() ?? { data: null, error: null };
        return Promise.resolve(terminalResult);
      };
      query.maybeSingle = take;
      query.single = take;
      query.then = (resolve: (value: Result) => unknown, reject: (reason: unknown) => unknown) => {
        terminalResult ??= database.queues[table]?.shift() ?? { data: null, error: null };
        return Promise.resolve(terminalResult).then(resolve, reject);
      };
      return query;
    }
  }
}));

import { requestReferralTrackingOtp } from "./referral.service";

const availableDelivery = (send: ReferralOtpDelivery["send"]): ReferralOtpDelivery => ({
  available: true,
  provider: "termii",
  configurationStatus: "configured",
  send
});

describe("referral tracking OTP request", () => {
  beforeEach(() => {
    database.calls = [];
    database.queues = {
      referrers: [{ data: { id: "referrer-1" }, error: null }],
      referral_tracking_challenges: [
        { data: null, error: null },
        { data: { id: "challenge-1" }, error: null }
      ]
    };
  });

  it("creates a hashed challenge and reports success only after delivery accepts", async () => {
    const send = vi.fn(async (_input: Parameters<ReferralOtpDelivery["send"]>[0]) => undefined);
    const result = await requestReferralTrackingOtp("Ada Example", "0801 234 5678", availableDelivery(send));

    expect(result).toEqual({ accepted: true, resendAvailableIn: 60 });
    expect(send).toHaveBeenCalledOnce();
    const outbound = send.mock.calls[0][0];
    expect(outbound.phone).toBe("+2348012345678");
    expect(outbound.code).toMatch(/^\d{6}$/);
    expect(outbound.expiresInMinutes).toBe(10);
    const insert = database.calls.find((call) => call.table === "referral_tracking_challenges" && call.method === "insert");
    expect(insert).toBeDefined();
    expect(JSON.stringify(insert?.args)).not.toContain(outbound.code);
    expect(result).not.toHaveProperty("otp");
    expect(database.calls.some((call) => call.table === "referral_tracking_sessions")).toBe(false);
  });

  it("deletes a newly-created challenge when provider delivery fails", async () => {
    database.queues.referral_tracking_challenges.push({ data: null, error: null });
    const send = vi.fn(async (_input: Parameters<ReferralOtpDelivery["send"]>[0]) => { throw new Error("raw provider failure"); });
    let failure: AppError | undefined;
    try {
      await requestReferralTrackingOtp("Ada Example", "+2348012345678", availableDelivery(send));
    } catch (error) {
      failure = error as AppError;
    }

    expect(failure).toMatchObject({
      statusCode: 502,
      code: "REFERRAL_OTP_DELIVERY_FAILED",
      message: "We could not deliver the referral tracking code"
    });
    expect(failure?.message).not.toContain("raw provider failure");
    expect(database.calls).toContainEqual({
      table: "referral_tracking_challenges",
      method: "delete",
      args: []
    });
    expect(database.calls).toContainEqual({
      table: "referral_tracking_challenges",
      method: "eq",
      args: ["id", "challenge-1"]
    });
  });

  it("keeps cooldown enforcement ahead of challenge creation and provider delivery", async () => {
    database.queues.referral_tracking_challenges = [{
      data: { resend_available_at: new Date(Date.now() + 60_000).toISOString() },
      error: null
    }];
    const send = vi.fn(async () => undefined);
    await expect(requestReferralTrackingOtp("Ada Example", "+2348012345678", availableDelivery(send)))
      .rejects.toMatchObject({ statusCode: 429, code: "REFERRAL_OTP_RATE_LIMITED" });
    expect(send).not.toHaveBeenCalled();
    expect(database.calls.filter((call) => call.method === "insert")).toHaveLength(0);
  });

  it("marks the challenge consumed when deletion cannot complete", async () => {
    database.queues.referral_tracking_challenges.push(
      { data: null, error: { message: "delete unavailable" } },
      { data: null, error: null }
    );
    const send = vi.fn(async (_input: Parameters<ReferralOtpDelivery["send"]>[0]) => { throw new Error("delivery failed"); });
    await expect(requestReferralTrackingOtp("Ada Example", "+2348012345678", availableDelivery(send)))
      .rejects.toMatchObject({ code: "REFERRAL_OTP_DELIVERY_FAILED" });
    const update = database.calls.find((call) => call.table === "referral_tracking_challenges" && call.method === "update");
    expect(update?.args[0]).toMatchObject({ consumed_at: expect.any(String) });
  });

  it("returns the same generic acceptance for an unknown phone without creating a challenge", async () => {
    database.queues.referrers = [{ data: null, error: null }];
    const send = vi.fn(async () => undefined);
    await expect(requestReferralTrackingOtp("Ada Example", "+2348099999999", availableDelivery(send)))
      .resolves.toEqual({ accepted: true, resendAvailableIn: 60 });
    expect(send).not.toHaveBeenCalled();
    expect(database.calls.filter((call) => call.method === "insert")).toHaveLength(0);
  });
});
