import { describe, expect, it } from "vitest";
import { payoutDetailsSchema, referralPaginationSchema, submitReferralSchema, trackingVerifySchema } from "./referral.validators";

const valid = {
  referrer: { fullName: "Ada Okafor", phone: "0801 234 5678" },
  referred: { fullName: "Tomi Balogun", contactMethod: "WHATSAPP" as const, phone: "0802 345 6789" },
  purpose: "BUYING" as const,
  privateReferrerDisclosure: false,
  consent: true as const
};

describe("referral request validation", () => {
  it("accepts an anonymous Buying referral and normalizes both phones", () => {
    const result = submitReferralSchema.parse(valid);
    expect(result.referrer?.phone).toBe("+2348012345678");
    expect(result.referred.phone).toBe("+2348023456789");
    expect(result.purpose).toBe("BUYING");
  });
  it("accepts a Selling referral for an authenticated caller without referrer fields", () => {
    expect(submitReferralSchema.parse({ ...valid, referrer: undefined, purpose: "SELLING" }).purpose).toBe("SELLING");
  });
  it("requires email for the Email contact method", () => {
    expect(submitReferralSchema.safeParse({ ...valid, referred: { fullName: "Tomi Balogun", contactMethod: "EMAIL" } }).success).toBe(false);
  });
  it("requires phone for WhatsApp and Call", () => {
    expect(submitReferralSchema.safeParse({ ...valid, referred: { fullName: "Tomi Balogun", contactMethod: "CALL" } }).success).toBe(false);
  });
  it("rejects unknown server-owned fields", () => {
    expect(submitReferralSchema.safeParse({ ...valid, rewardAmount: 2500000 }).success).toBe(false);
  });
  it("rejects false consent", () => {
    expect(submitReferralSchema.safeParse({ ...valid, consent: false }).success).toBe(false);
  });
  it("validates ten-digit payout accounts", () => {
    expect(payoutDetailsSchema.safeParse({ bankCode: "999992", accountNumber: "0123456789", accountName: "Ada Okafor" }).success).toBe(true);
    expect(payoutDetailsSchema.safeParse({ bankCode: "999992", accountNumber: "1234", accountName: "Ada Okafor" }).success).toBe(false);
  });
  it("rejects non-numeric and server-owned payout fields", () => {
    expect(payoutDetailsSchema.safeParse({ bankCode: "044", accountNumber: "01234A6789", accountName: "Ada Okafor" }).success).toBe(false);
    expect(payoutDetailsSchema.safeParse({ bankCode: "044", accountNumber: "0123456789", accountName: "Ada Okafor", paid: true }).success).toBe(false);
  });
  it("requires a six-digit tracking OTP", () => {
    expect(trackingVerifySchema.safeParse({ phone: "08012345678", otp: "123456" }).success).toBe(true);
    expect(trackingVerifySchema.safeParse({ phone: "08012345678", otp: "12345" }).success).toBe(false);
  });
  it("bounds referral pagination", () => {
    expect(referralPaginationSchema.parse({ page: "2", limit: "20" })).toEqual({ page: 2, limit: 20 });
    expect(referralPaginationSchema.safeParse({ page: 0, limit: 50 }).success).toBe(false);
  });
});
