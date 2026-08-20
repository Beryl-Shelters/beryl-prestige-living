import { beforeEach, describe, expect, it, vi } from "vitest";
import { draftSchema } from "./marketplace.validators";

type Row = Record<string, any>;
const database = vi.hoisted(() => ({
  properties: [] as Row[],
  calls: [] as Array<{ table: string; method: string; args: unknown[] }>,
  failPropertyWrite: false
}));

vi.mock("../../config/supabase", () => ({
  supabaseAdmin: {
    from: (table: string) => {
      const filters: Array<[string, unknown]> = [];
      let mutation: { kind: "insert" | "update"; values: Row } | undefined;
      const query: Record<string, any> = {};
      query.select = (...args: unknown[]) => { database.calls.push({ table, method: "select", args }); return query; };
      query.eq = (column: string, value: unknown) => { database.calls.push({ table, method: "eq", args: [column, value] }); filters.push([column, value]); return query; };
      query.order = (...args: unknown[]) => { database.calls.push({ table, method: "order", args }); return query; };
      query.insert = (values: Row) => { database.calls.push({ table, method: "insert", args: [values] }); mutation = { kind: "insert", values }; return query; };
      query.update = (values: Row) => { database.calls.push({ table, method: "update", args: [values] }); mutation = { kind: "update", values }; return query; };

      const execute = () => {
        if (table === "user_personas") return { data: { persona_type: "SELLER_DEVELOPER", onboarding_status: "COMPLETED" }, error: null };
        if (table === "property_images" || table === "property_documents") return { data: [], error: null };
        if (table !== "properties") return { data: null, error: null };
        if (mutation && database.failPropertyWrite) return { data: null, error: { message: "invalid input value for enum property_category" } };
        if (mutation?.kind === "insert") {
          const row = { id: "11111111-1111-4111-8111-111111111111", created_at: "2026-08-20T10:00:00.000Z", updated_at: "2026-08-20T10:00:00.000Z", ...mutation.values };
          database.properties.push(row);
          return { data: row, error: null };
        }
        const row = database.properties.find((candidate) => filters.every(([column, value]) => candidate[column] === value));
        if (mutation?.kind === "update" && row) {
          Object.assign(row, mutation.values, { updated_at: "2026-08-20T10:01:00.000Z" });
          return { data: row, error: null };
        }
        return { data: row ?? null, error: null };
      };
      query.single = async () => execute();
      query.maybeSingle = async () => execute();
      query.then = (resolve: (value: unknown) => unknown) => Promise.resolve(execute()).then(resolve);
      return query;
    }
  }
}));
vi.mock("../../utils/cloudinary", () => ({ uploadImageWithPublicId: vi.fn(), deleteImageFromCloudinary: vi.fn(), uploadPropertyDocument: vi.fn(), deletePropertyDocument: vi.fn() }));

import { createDraft, getDraft, updateDraft } from "./marketplace.service";

describe("Marketplace Seller draft persistence", () => {
  beforeEach(() => { database.properties.length = 0; database.calls.length = 0; database.failPropertyWrite = false; });

  it("creates once, stores the legacy category enum, patches Step 1, advances, and restores the same draft", async () => {
    const sellerId = "seller-1";
    const initial = draftSchema.parse({ title: "3 bedroom", propertyCategory: "RESIDENTIAL", propertyType: "DUPLEX", ownershipType: "PERSONAL", negotiable: true, amenities: [" Pool ", "pool"] });
    const created = await createDraft(sellerId, initial);

    expect(created).toMatchObject({ id: "11111111-1111-4111-8111-111111111111", propertyCategory: "RESIDENTIAL", status: "DRAFT", currentStep: "PROPERTY_INFORMATION" });
    expect(database.properties).toHaveLength(1);
    expect(database.properties[0]).toMatchObject({ category: "residential", property_type: "DUPLEX", owner_id: sellerId, listing_purpose: "sale" });

    const completedStep = draftSchema.parse({ description: "3 bedroom home", publicLocation: "Lekki, Lagos", fullAddress: "12 Private Street", askingPrice: 75000000, bedrooms: 3, bathrooms: 3, initialDepositType: "PERCENTAGE", initialDepositValue: 20, condition: "NEWLY_BUILT", furnishing: "SEMI_FURNISHED" });
    await updateDraft(created.id, sellerId, completedStep);
    await updateDraft(created.id, sellerId, { currentStep: "PHOTOS_DOCUMENTS" });
    const restored = await getDraft(created.id, sellerId);

    expect(database.properties).toHaveLength(1);
    expect(restored).toMatchObject({ id: created.id, propertyCategory: "RESIDENTIAL", propertyType: "DUPLEX", askingPrice: 75000000, bedrooms: 3, initialDepositType: "PERCENTAGE", initialDepositValue: 20, currentStep: "PHOTOS_DOCUMENTS", images: [], documents: [] });
    expect(database.calls.filter((call) => call.table === "properties" && call.method === "insert")).toHaveLength(1);
  });

  it("rejects arbitrary property types and unknown fields before persistence", () => {
    expect(draftSchema.safeParse({ propertyType: "resd" }).success).toBe(false);
    expect(draftSchema.safeParse({ propertyType: "DUPLEX", serverOwned: "blocked" }).success).toBe(false);
    expect(database.properties).toHaveLength(0);
  });

  it("maps both public category values to legacy storage values and back", async () => {
    const commercial = await createDraft("seller-1", draftSchema.parse({ propertyCategory: "COMMERCIAL", propertyType: "TERRACE" }));
    expect(database.properties[0]?.category).toBe("commercial");
    expect(commercial.propertyCategory).toBe("COMMERCIAL");
  });

  it("returns a stable persistence error without leaking database details", async () => {
    database.failPropertyWrite = true;
    await expect(createDraft("seller-1", draftSchema.parse({ propertyCategory: "RESIDENTIAL" }))).rejects.toMatchObject({
      statusCode: 503,
      code: "DRAFT_PERSISTENCE_UNAVAILABLE",
      message: "Property draft could not be saved"
    });
  });
});
