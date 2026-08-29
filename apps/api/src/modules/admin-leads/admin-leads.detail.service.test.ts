import { beforeEach, describe, expect, it, vi } from "vitest";

type Result = { data: any; error: any };
const database = vi.hoisted(() => ({
  calls: [] as Array<{ table: string; method: string; args: unknown[] }>,
  queues: {} as Record<string, Result[]>
}));

vi.mock("../../config/supabase", () => ({
  supabaseAdmin: {
    rpc: vi.fn(),
    from: (table: string) => {
      const query: Record<string, any> = {};
      for (const method of ["select", "eq", "not", "order"]) {
        query[method] = (...args: unknown[]) => {
          database.calls.push({ table, method, args });
          return query;
        };
      }
      const take = () => database.queues[table]?.shift() ?? { data: null, error: null };
      query.maybeSingle = () => {
        database.calls.push({ table, method: "maybeSingle", args: [] });
        return Promise.resolve(take());
      };
      query.then = (resolve: (value: Result) => unknown, reject: (reason: unknown) => unknown) =>
        Promise.resolve(take()).then(resolve, reject);
      return query;
    }
  }
}));

import { getLeadDetail } from "./admin-leads.service";

const leadId = "11111111-1111-4111-8111-111111111111";
const customerId = "22222222-2222-4222-8222-222222222222";
const propertyId = "33333333-3333-4333-8333-333333333333";
const inquiry = {
  id: leadId,
  user_id: customerId,
  property_id: propertyId,
  inquiry_type: "MARKETPLACE_INTEREST_WHATSAPP",
  full_name: "Inquiry Snapshot",
  email: "snapshot@example.com",
  phone_number: "+2348000000000",
  message: "Can I arrange a viewing?",
  status: "new",
  lead_stage: null,
  created_at: "2026-08-22T10:00:00.000Z",
  updated_at: "2026-08-22T10:00:00.000Z"
};
const property = {
  id: propertyId,
  owner_id: null,
  property_code: "BRL-101",
  title: "Three bedroom apartment",
  public_location: "Ikoyi, Lagos",
  price: 20000000,
  category: "RESIDENTIAL",
  property_type: "APARTMENT",
  marketplace_status: "LIVE",
  initial_deposit_type: "PERCENTAGE",
  initial_deposit_value: 20,
  property_images: [
    { id: "image-2", image_url: "https://example.com/second.jpg", sort_order: 1, is_cover: false },
    { id: "image-1", image_url: "https://example.com/cover.jpg", sort_order: 0, is_cover: true }
  ]
};

const arrange = (overrides?: {
  inquiry?: Result;
  profile?: Result;
  referrer?: Result;
  personas?: Result;
  property?: Result;
  history?: Result;
  mandate?: Result;
}) => {
  database.queues = {
    inquiries: [overrides?.inquiry ?? { data: inquiry, error: null }],
    profiles: [
      overrides?.profile ?? { data: { id: customerId, full_name: "Victor Beryl", email: "victor@example.com", phone_number: "+2348111111111", email_verified_at: "2026-08-01T00:00:00.000Z", account_status: "ACTIVE", referred_by: null }, error: null },
      ...(overrides?.referrer ? [overrides.referrer] : [])
    ],
    user_personas: [overrides?.personas ?? { data: [{ id: "persona-1", persona_type: "BUYER", onboarding_status: "COMPLETED" }], error: null }],
    properties: [overrides?.property ?? { data: property, error: null }],
    inquiry_lead_stage_history: [overrides?.history ?? { data: [], error: null }],
    mandates: [overrides?.mandate ?? { data: { marketplace_mandate_type: "EXCLUSIVE" }, error: null }]
  };
};

describe("Admin lead detail retrieval", () => {
  beforeEach(() => {
    database.calls.length = 0;
    arrange();
  });

  it("returns a Preview-like lead with canonical customer, property, cover, empty history and NEW fallback", async () => {
    const result = await getLeadDetail(leadId);
    expect(result).toMatchObject({
      id: leadId,
      referenceId: "ENQ-11111111",
      stage: "NEW",
      customer: {
        id: customerId,
        fullName: "Victor Beryl",
        email: "victor@example.com",
        phone: "+2348111111111",
        emailVerified: true,
        preferredContactMethod: "WHATSAPP",
        personas: [{ type: "BUYER", onboardingStatus: "COMPLETED" }]
      },
      property: {
        id: propertyId,
        referenceId: "BRL-101",
        mandateType: "EXCLUSIVE",
        coverImage: { id: "image-1", url: "https://example.com/cover.jpg", order: 0, isCover: true },
        seller: null
      },
      referredBy: null,
      history: []
    });
    const profileSelect = database.calls.find((call) => call.table === "profiles" && call.method === "select");
    expect(profileSelect?.args[0]).toContain("email_verified_at");
    expect(profileSelect?.args[0]).toContain("referred_by");
    expect(profileSelect?.args[0]).not.toMatch(/email_verified(?:,|$)/);
  });

  it("returns only the bounded referrer identity when the customer profile has one", async () => {
    arrange({
      profile: { data: { id: customerId, full_name: "Victor Beryl", email: "victor@example.com", phone_number: "+2348111111111", email_verified_at: "2026-08-01T00:00:00.000Z", account_status: "ACTIVE", referred_by: "referrer-1" }, error: null },
      referrer: { data: { id: "referrer-1", full_name: "Emeka Chukwu", email: "must-not-leak@example.com" }, error: null }
    });
    const result = await getLeadDetail(leadId);
    expect(result.referredBy).toEqual({ id: "referrer-1", fullName: "Emeka Chukwu" });
    expect(JSON.stringify(result.referredBy)).not.toContain("must-not-leak");
    const referrerSelect = database.calls.filter((call) => call.table === "profiles" && call.method === "select").at(-1);
    expect(referrerSelect?.args[0]).toBe("id,full_name");
  });

  it.each([
    ["MARKETPLACE_INTEREST_WHATSAPP", "WHATSAPP"],
    ["MARKETPLACE_INTEREST_CALL", "CALL"],
    ["MARKETPLACE_INTEREST_EMAIL", "EMAIL"]
  ])("maps %s to preferred contact %s", async (inquiryType, expected) => {
    arrange({ inquiry: { data: { ...inquiry, inquiry_type: inquiryType }, error: null } });
    await expect(getLeadDetail(leadId)).resolves.toMatchObject({ customer: { preferredContactMethod: expected } });
  });

  it("falls back to the inquiry identity and tolerates no property, personas, or history", async () => {
    arrange({
      inquiry: { data: { ...inquiry, property_id: null, message: null, lead_stage: null, status: "scheduled" }, error: null },
      profile: { data: null, error: null },
      personas: { data: [], error: null },
      history: { data: [], error: null }
    });
    await expect(getLeadDetail(leadId)).resolves.toMatchObject({
      stage: "CONTACTED",
      customer: { fullName: "Inquiry Snapshot", email: "snapshot@example.com", phone: "+2348000000000", emailVerified: false, personas: [] },
      message: null,
      property: null,
      history: []
    });
  });

  it("tolerates absent images, mandate, Seller, and placeholder message", async () => {
    arrange({
      inquiry: { data: { ...inquiry, message: "Marketplace interest submitted" }, error: null },
      property: { data: { ...property, property_images: [] }, error: null },
      mandate: { data: null, error: null }
    });
    await expect(getLeadDetail(leadId)).resolves.toMatchObject({
      message: null,
      property: { coverImage: null, mandateType: null, seller: null }
    });
  });

  it("returns LEAD_NOT_FOUND only when the inquiry is absent", async () => {
    arrange({ inquiry: { data: null, error: null } });
    await expect(getLeadDetail(leadId)).rejects.toMatchObject({ statusCode: 404, code: "LEAD_NOT_FOUND", message: "Lead not found" });
  });

  it("keeps real database failures behind LEADS_UNAVAILABLE", async () => {
    arrange({ profile: { data: null, error: { message: "column profiles.email_verified does not exist" } } });
    await expect(getLeadDetail(leadId)).rejects.toMatchObject({ statusCode: 503, code: "LEADS_UNAVAILABLE", message: "Lead management is temporarily unavailable" });
  });
});
