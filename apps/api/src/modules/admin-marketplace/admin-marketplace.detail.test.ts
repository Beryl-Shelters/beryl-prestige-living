import { beforeEach, describe, expect, it, vi } from "vitest";

type Result = { data: any; error: any };
const database = vi.hoisted(() => ({ calls: [] as Array<{ table: string; method: string; args: unknown[] }>, queues: {} as Record<string, Result[]> }));
vi.mock("../../config/supabase", () => ({ supabaseAdmin: {
  rpc: vi.fn(),
  from: (table: string) => {
    const query: Record<string, any> = {};
    for (const method of ["select", "eq", "in", "not", "order"]) query[method] = (...args: unknown[]) => { database.calls.push({ table, method, args }); return query; };
    const take = () => database.queues[table]?.shift() ?? { data: null, error: null };
    query.maybeSingle = () => Promise.resolve(take());
    query.then = (resolve: (value: Result) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve(take()).then(resolve, reject);
    return query;
  }
} }));
vi.mock("../../utils/cloudinary", () => ({ createPropertyDocumentAccessUrl: vi.fn() }));

import { getReviewDetail } from "./admin-marketplace.service";

const propertyId = "11111111-1111-4111-8111-111111111111";
const property = (status: "LIVE" | "IN_REVIEW" | "REJECTED") => ({
  id: propertyId, property_code: "BRL-101", title: "Three bedroom apartment", description: "Operational description",
  category: "RESIDENTIAL", property_type: "APARTMENT", ownership_type: "OWNER", public_location: "Ikoyi, Lagos",
  full_address: "12 Private Street, Ikoyi", price: 20000000, negotiable: true, property_condition: "NEWLY_BUILT",
  furnishing: "SEMI_FURNISHED", bedrooms: 3, bathrooms: 4, toilets: 4, parking_spaces: 2, number_of_floors: 3,
  parking_capacity: 2, amenities: ["Security", "Pool"], marketplace_status: status,
  marketplace_submitted_at: "2026-08-20T10:00:00.000Z", marketplace_reviewed_at: status === "IN_REVIEW" ? null : "2026-08-21T10:00:00.000Z",
  marketplace_published_at: status === "LIVE" ? "2026-08-21T10:00:00.000Z" : null,
  marketplace_rejected_at: status === "REJECTED" ? "2026-08-21T10:00:00.000Z" : null,
  rejection_reason: status === "REJECTED" ? "Provide clearer ownership evidence" : null, updated_at: "2026-08-21T10:00:00.000Z",
  property_images: [{ id: "image-1", image_url: "https://example.com/cover.jpg", sort_order: 0, is_cover: true }],
  seller: { id: "seller-1", full_name: "Victor Beryl", email: "victor@example.com", phone_number: "+2348111111111", account_status: "ACTIVE", email_verified_at: "2026-08-01T00:00:00.000Z" },
  cloudinary_public_id: "must-not-leak", internal_secret: "must-not-leak"
});

const arrange = (status: "LIVE" | "IN_REVIEW" | "REJECTED", propertyResult: Result = { data: property(status), error: null }) => {
  database.queues = {
    properties: [propertyResult],
    property_documents: [{ data: [{ id: "document-1", document_type: "DEED", display_name: "Deed.pdf", mime_type: "application/pdf", size_bytes: 1200, created_at: "2026-08-20T11:00:00.000Z", cloudinary_public_id: "must-not-leak" }], error: null }],
    mandates: [{ data: { marketplace_mandate_type: "EXCLUSIVE", full_name: "Victor Beryl", ownership_confirmed: true, mandate_accepted: true, accepted_at: "2026-08-20T12:00:00.000Z", agreement_version: "v1", commission_percentage: 5, commission_amount: null }, error: null }],
    marketplace_property_review_history: [{ data: [], error: null }],
    user_personas: [{ data: { id: "seller-persona-1" }, error: null }],
    seller_profiles: [{ data: { company_name: "Victor Beryl Homes" }, error: null }]
  };
};

describe("Admin Marketplace operational property detail", () => {
  beforeEach(() => { database.calls.length = 0; arrange("LIVE"); });

  it.each(["LIVE", "IN_REVIEW", "REJECTED"] as const)("allows authenticated Admin detail architecture to fetch %s", async (status) => {
    arrange(status);
    await expect(getReviewDetail(propertyId)).resolves.toMatchObject({ summary: { id: propertyId, status }, property: { id: propertyId }, seller: { emailVerified: true } });
    expect(database.calls).toContainEqual({ table: "properties", method: "in", args: ["marketplace_status", ["IN_REVIEW", "LIVE", "REJECTED"]] });
  });

  it("returns operational fields while keeping provider identifiers private", async () => {
    const result = await getReviewDetail(propertyId);
    expect(result).toMatchObject({ property: { fullAddress: "12 Private Street, Ikoyi", initialDepositType: null, initialDepositValue: null, images: [{ id: "image-1", url: "https://example.com/cover.jpg" }] }, seller: { companyName: "Victor Beryl Homes" }, documents: [{ id: "document-1", displayName: "Deed.pdf" }], mandate: { mandateType: "EXCLUSIVE" }, history: [] });
    expect(JSON.stringify(result)).not.toMatch(/cloudinary_public_id|must-not-leak|internal_secret/);
    const documentSelect = database.calls.find((call) => call.table === "property_documents" && call.method === "select");
    expect(documentSelect?.args[0]).not.toMatch(/cloudinary|url|signature/);
  });

  it("returns the stable not-found error", async () => {
    arrange("LIVE", { data: null, error: null });
    await expect(getReviewDetail(propertyId)).rejects.toMatchObject({ statusCode: 404, code: "MARKETPLACE_REVIEW_NOT_FOUND" });
  });

  it("sanitizes infrastructure errors", async () => {
    arrange("LIVE", { data: null, error: { message: "private database error" } });
    await expect(getReviewDetail(propertyId)).rejects.toMatchObject({ statusCode: 503, code: "MARKETPLACE_REVIEW_UNAVAILABLE", message: "Marketplace review is temporarily unavailable" });
  });
});
