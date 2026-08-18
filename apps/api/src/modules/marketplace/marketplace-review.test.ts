import { beforeEach, describe, expect, it, vi } from "vitest";
import { draftSchema } from "./marketplace.validators";

type Result = { data?: any; error?: unknown };
const database = vi.hoisted(() => ({ responses: [] as Result[], rpcResponses: [] as Result[], calls: [] as Array<{ table: string; method: string; args: unknown[] }> }));

vi.mock("../../config/supabase", () => ({
  supabaseAdmin: {
    from: (table: string) => {
      const result = database.responses.shift() ?? { data: null, error: null };
      const query: Record<string, any> = {};
      for (const method of ["select", "eq", "not", "order"]) query[method] = (...args: unknown[]) => {
        database.calls.push({ table, method, args });
        return query;
      };
      query.maybeSingle = () => Promise.resolve(result);
      query.then = (resolve: (value: Result) => unknown) => Promise.resolve(result).then(resolve);
      return query;
    },
    rpc: (name: string, args: unknown) => {
      database.calls.push({ table: name, method: "rpc", args: [args] });
      return Promise.resolve(database.rpcResponses.shift() ?? { data: null, error: null });
    }
  }
}));
vi.mock("../../utils/cloudinary", () => ({ uploadImageWithPublicId: vi.fn(), deleteImageFromCloudinary: vi.fn(), uploadPropertyDocument: vi.fn(), deletePropertyDocument: vi.fn() }));

import { getPropertyReview, submitPropertyForReview, validateListingSubmission } from "./marketplace.service";

const seller = { data: { persona_type: "SELLER_DEVELOPER", onboarding_status: "COMPLETED" }, error: null };
const property = { id: "property-1", owner_id: "seller-1", property_code: "BRL-EXISTING", marketplace_status: "DRAFT", marketplace_current_step: "REVIEW", title: "Four bedroom home", description: "A complete description", category: "RESIDENTIAL", property_type: "DETACHED", ownership_type: "PERSONAL", public_location: "Lekki, Lagos", full_address: "12 Private Street", price: 250000000, negotiable: true, initial_deposit_type: "PERCENTAGE", initial_deposit_value: 20, property_condition: "NEWLY_BUILT", furnishing: "UNFURNISHED", bedrooms: 4, bathrooms: 4, toilets: 5, parking_spaces: 3, number_of_floors: null, parking_capacity: null, amenities: ["Pool"] };
const photos = [
  { id: "image-1", image_url: "https://example.com/cover.jpg", cloudinary_public_id: "private-cover", sort_order: 0, is_cover: true },
  { id: "image-2", image_url: "https://example.com/second.jpg", cloudinary_public_id: "private-second", sort_order: 1, is_cover: false }
];
const mandate = { id: "mandate-1", marketplace_mandate_type: "EXCLUSIVE", full_name: "Test Seller", ownership_confirmed: true, mandate_accepted: true, accepted_at: "2026-08-18T12:00:00.000Z", agreement_version: null, commission_percentage: null, commission_amount: null, email: "private@example.com", address: "private" };

describe("Marketplace Step 4 review and submission", () => {
  beforeEach(() => { database.responses.length = 0; database.rpcResponses.length = 0; database.calls.length = 0; });

  it("accepts REVIEW as navigation state without submitting", () => {
    expect(draftSchema.safeParse({ currentStep: "REVIEW" }).success).toBe(true);
    expect(database.calls.some((call) => call.method === "rpc")).toBe(false);
  });

  it("returns an ordered, privacy-safe Seller review DTO", async () => {
    database.responses.push(seller, { data: property, error: null }, { data: photos, error: null }, { data: mandate, error: null });
    const review = await getPropertyReview("property-1", "seller-1");
    expect(review.buyerPreview.images.map((image) => image.id)).toEqual(["image-1", "image-2"]);
    expect(review.buyerPreview.coverImage?.id).toBe("image-1");
    expect(review.buyerPreview.photoCount).toBe(2);
    expect(review.buyerPreview).not.toHaveProperty("fullAddress");
    expect(review.sellerPrivate).toEqual({ fullAddress: "12 Private Street" });
    expect(JSON.stringify(review.buyerPreview)).not.toMatch(/cloudinary|private street|document/i);
  });

  it("rejects Buyer-only and another Seller before returning a review", async () => {
    database.responses.push({ data: null, error: null });
    await expect(getPropertyReview("property-1", "buyer-1")).rejects.toMatchObject({ code: "SELLER_PERSONA_REQUIRED" });
    database.responses.push(seller, { data: null, error: null });
    await expect(getPropertyReview("property-1", "seller-2")).rejects.toMatchObject({ code: "PROPERTY_NOT_FOUND" });
  });

  it("reports strict property, photo, and mandate completeness without requiring documents", () => {
    const incomplete = validateListingSubmission({}, [], null);
    expect(incomplete.missingSections).toEqual(["PROPERTY_INFORMATION", "PHOTOS", "SALES_MANDATE"]);
    expect(incomplete.missingFields).toEqual(expect.arrayContaining(["title", "askingPrice", "images", "coverImage", "mandate"]));
    expect(incomplete.missingFields).not.toContain("documents");
    expect(validateListingSubmission(property, photos, mandate)).toEqual({ missingSections: [], missingFields: [] });
  });

  it("blocks over-limit, missing-cover, invalid-order, and invalid mandate states", () => {
    const tooMany = Array.from({ length: 11 }, (_, index) => ({ sort_order: index, is_cover: index === 0 }));
    expect(validateListingSubmission(property, tooMany, mandate).missingFields).toContain("images");
    expect(validateListingSubmission(property, photos.map((image) => ({ ...image, is_cover: false })), mandate).missingFields).toContain("coverImage");
    expect(validateListingSubmission(property, photos.map((image) => ({ ...image, sort_order: image.sort_order + 1 })), mandate).missingFields).toContain("imageOrder");
    expect(validateListingSubmission(property, photos, { ...mandate, ownership_confirmed: false, mandate_accepted: false, accepted_at: null }).missingFields).toEqual(expect.arrayContaining(["ownershipConfirmed", "mandateAccepted", "acceptedAt"]));
  });

  it("submits a complete DRAFT atomically and returns its existing reference", async () => {
    database.responses.push(seller, { data: property, error: null }, { data: photos, error: null }, { data: mandate, error: null });
    database.rpcResponses.push({ data: [{ outcome: "SUBMITTED", property_id: "property-1", reference_id: "BRL-EXISTING", marketplace_status: "IN_REVIEW", submitted_at: "2026-08-18T13:00:00.000Z", missing_sections: [], missing_fields: [] }], error: null });
    await expect(submitPropertyForReview("property-1", "seller-1")).resolves.toEqual({ propertyId: "property-1", referenceId: "BRL-EXISTING", status: "IN_REVIEW", submittedAt: "2026-08-18T13:00:00.000Z", nextAction: "OPEN_MY_LISTINGS" });
    expect(database.calls.filter((call) => call.method === "rpc")).toHaveLength(1);
  });

  it("resubmits a corrected reopened DRAFT with a new server timestamp and without duplicating the property", async () => {
    const reopened = { ...property, marketplace_status: "DRAFT", marketplace_rejected_at: "2026-08-18T13:00:00.000Z", marketplace_reviewed_at: "2026-08-18T13:00:00.000Z", rejection_reason: "Provide a clearer survey plan" };
    database.responses.push(seller, { data: reopened, error: null }, { data: photos, error: null }, { data: mandate, error: null });
    database.rpcResponses.push({ data: [{ outcome: "SUBMITTED", property_id: "property-1", reference_id: "BRL-EXISTING", marketplace_status: "IN_REVIEW", submitted_at: "2026-08-18T15:00:00.000Z", missing_sections: [], missing_fields: [] }], error: null });
    await expect(submitPropertyForReview("property-1", "seller-1")).resolves.toMatchObject({ propertyId: "property-1", status: "IN_REVIEW", submittedAt: "2026-08-18T15:00:00.000Z", nextAction: "OPEN_MY_LISTINGS" });
    expect(database.calls.filter((call) => call.method === "rpc")).toHaveLength(1);
    expect(database.calls.find((call) => call.method === "rpc")?.args[0]).toEqual({ p_property_id: "property-1", p_owner_id: "seller-1" });
  });

  it("does not call the transaction for an incomplete draft", async () => {
    database.responses.push(seller, { data: { ...property, title: null }, error: null }, { data: [], error: null }, { data: null, error: null });
    await expect(submitPropertyForReview("property-1", "seller-1")).rejects.toMatchObject({ code: "LISTING_SUBMISSION_INCOMPLETE", details: { missingSections: ["PROPERTY_INFORMATION", "PHOTOS", "SALES_MANDATE"] } });
    expect(database.calls.some((call) => call.method === "rpc")).toBe(false);
  });

  it("returns a stable duplicate conflict without creating a second review record", async () => {
    database.responses.push(seller, { data: { ...property, marketplace_status: "IN_REVIEW" }, error: null });
    await expect(submitPropertyForReview("property-1", "seller-1")).rejects.toMatchObject({ statusCode: 409, code: "LISTING_ALREADY_SUBMITTED" });
    expect(database.calls.some((call) => call.method === "rpc")).toBe(false);
  });

  it("rejects another Seller before submission", async () => {
    database.responses.push(seller, { data: null, error: null });
    await expect(submitPropertyForReview("property-1", "seller-2")).rejects.toMatchObject({ code: "PROPERTY_NOT_FOUND" });
    expect(database.calls.some((call) => call.method === "rpc")).toBe(false);
  });
});
