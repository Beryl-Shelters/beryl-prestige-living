import { beforeEach, describe, expect, it, vi } from "vitest";

type Result = { data: any; error: any };
const database = vi.hoisted(() => ({
  calls: [] as Array<{ table: string; method: string; args: unknown[] }>,
  queues: {} as Record<string, Result[]>,
  rpc: vi.fn()
}));

vi.mock("../../config/env", () => ({ env: {
  clientWebUrl: "https://preview.example.com",
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
    rpc: database.rpc,
    from(table: string) {
      const query: Record<string, any> = {};
      for (const method of ["select", "eq", "insert", "update", "is"]) {
        query[method] = (...args: unknown[]) => {
          database.calls.push({ table, method, args });
          return query;
        };
      }
      query.maybeSingle = () => Promise.resolve(database.queues[table]?.shift() ?? { data: null, error: null });
      query.single = () => Promise.resolve(database.queues[table]?.shift() ?? { data: null, error: null });
      return query;
    }
  }
}));

import { submitReferral } from "./referral.service";

const guestIdentity = {
  id: "11111111-1111-4111-8111-111111111111",
  customer_user_id: null,
  full_name: "Guest Referrer",
  phone_e164: "+2348011111111",
  referral_code: "BSR-GUEST"
};
const customerIdentity = {
  ...guestIdentity,
  id: "22222222-2222-4222-8222-222222222222",
  customer_user_id: "33333333-3333-4333-8333-333333333333",
  full_name: "Customer Referrer",
  referral_code: "BSR-CUSTOMER"
};
const rpcRow = (id: string, leadId: string) => ({
  referral_id: id,
  reference_id: "REF-2609-0001",
  purpose: "BUYING",
  lifecycle_status: "NEW",
  created_at: "2026-09-01T10:00:00.000Z",
  lead_inquiry_id: leadId
});

describe("referral Admin Lead projection", () => {
  beforeEach(() => {
    database.calls.length = 0;
    database.queues = { referrers: [{ data: guestIdentity, error: null }] };
    database.rpc.mockReset();
    database.rpc.mockResolvedValue({ data: [rpcRow("referral-1", "lead-1")], error: null });
  });

  it("creates a guest email-only referral and Lead through the atomic RPC", async () => {
    const result = await submitReferral({
      referrer: { fullName: "Guest Referrer", phone: "+2348011111111" },
      referred: { fullName: "Ada Lead", contactMethod: "EMAIL", email: "ADA@example.com" },
      purpose: "BUYING",
      privateReferrerDisclosure: false,
      consent: true
    });

    expect(database.rpc).toHaveBeenCalledOnce();
    expect(database.rpc).toHaveBeenCalledWith("create_referral_with_lead", expect.objectContaining({
      p_referrer_identity_id: guestIdentity.id,
      p_referred_full_name: "Ada Lead",
      p_referred_email: "ADA@example.com",
      p_referred_phone: null,
      p_preferred_contact_method: "EMAIL"
    }));
    expect(result.referral).toMatchObject({ id: "referral-1", status: "NEW" });
    expect(database.calls.some((call) => call.table === "referrals" && call.method === "insert")).toBe(false);
    expect(database.calls.some((call) => call.table === "inquiries" && call.method === "insert")).toBe(false);
  });

  it("creates a Customer phone-only referral without changing Customer identity", async () => {
    database.queues.referrers = [{ data: customerIdentity, error: null }];
    await submitReferral({
      referred: { fullName: "Phone Lead", contactMethod: "CALL", phone: "+2348022222222" },
      purpose: "SELLING",
      privateReferrerDisclosure: true,
      consent: true
    }, customerIdentity.customer_user_id);

    expect(database.rpc).toHaveBeenCalledWith("create_referral_with_lead", expect.objectContaining({
      p_referrer_identity_id: customerIdentity.id,
      p_referred_email: null,
      p_referred_phone: "+2348022222222",
      p_purpose: "SELLING",
      p_private_referrer_disclosure: true
    }));
  });

  it("preserves both contacts when both are supplied", async () => {
    await submitReferral({
      referrer: { fullName: "Guest Referrer", phone: "+2348011111111" },
      referred: { fullName: "Both Contacts", contactMethod: "EMAIL", email: "both@example.com", phone: "+2348033333333" },
      purpose: "BUYING",
      privateReferrerDisclosure: false,
      consent: true
    });
    expect(database.rpc).toHaveBeenCalledWith("create_referral_with_lead", expect.objectContaining({
      p_referred_email: "both@example.com",
      p_referred_phone: "+2348033333333"
    }));
  });

  it("keeps separately accepted referrals for the same contact as separate submissions", async () => {
    database.queues.referrers = [
      { data: guestIdentity, error: null },
      { data: guestIdentity, error: null }
    ];
    database.rpc
      .mockResolvedValueOnce({ data: [rpcRow("referral-1", "lead-1")], error: null })
      .mockResolvedValueOnce({ data: [rpcRow("referral-2", "lead-2")], error: null });
    const input = {
      referrer: { fullName: "Guest Referrer", phone: "+2348011111111" },
      referred: { fullName: "Repeated Lead", contactMethod: "CALL" as const, phone: "+2348044444444" },
      purpose: "BUYING" as const,
      privateReferrerDisclosure: false,
      consent: true as const
    };
    const first = await submitReferral(input);
    const second = await submitReferral(input);
    expect(database.rpc).toHaveBeenCalledTimes(2);
    expect([first.referral.id, second.referral.id]).toEqual(["referral-1", "referral-2"]);
  });

  it("surfaces an atomic persistence failure without attempting independent inserts", async () => {
    database.rpc.mockResolvedValue({ data: null, error: { message: "inquiry insert failed" } });
    await expect(submitReferral({
      referrer: { fullName: "Guest Referrer", phone: "+2348011111111" },
      referred: { fullName: "Failed Lead", contactMethod: "CALL", phone: "+2348055555555" },
      purpose: "BUYING",
      privateReferrerDisclosure: false,
      consent: true
    })).rejects.toMatchObject({ code: "REFERRAL_SUBMISSION_FAILED", statusCode: 503 });
    expect(database.calls.some((call) => call.method === "insert")).toBe(false);
  });
});
