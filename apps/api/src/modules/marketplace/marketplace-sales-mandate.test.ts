import { beforeEach, describe, expect, it, vi } from "vitest";
import { draftSchema, salesMandateSchema } from "./marketplace.validators";

type Result = { data?: any; error?: unknown };
const database = vi.hoisted(() => ({ responses: [] as Result[], calls: [] as Array<{ table: string; method: string; args: unknown[] }> }));

vi.mock("../../config/supabase", () => ({
  supabaseAdmin: {
    from: (table: string) => {
      const result = database.responses.shift() ?? { data: null, error: null };
      const query: Record<string, unknown> = {};
      for (const method of ["select", "eq", "not", "insert", "update"]) query[method] = (...args: unknown[]) => {
        database.calls.push({ table, method, args });
        return query;
      };
      query.single = () => Promise.resolve(result);
      query.maybeSingle = () => Promise.resolve(result);
      query.then = (resolve: (value: Result) => unknown) => Promise.resolve(result).then(resolve);
      return query;
    }
  }
}));
vi.mock("../../utils/cloudinary", () => ({ uploadImageWithPublicId: vi.fn(), deleteImageFromCloudinary: vi.fn(), uploadPropertyDocument: vi.fn(), deletePropertyDocument: vi.fn() }));

import { getSalesMandate, saveSalesMandate } from "./marketplace.service";

const seller = { data: { persona_type: "SELLER_DEVELOPER", onboarding_status: "COMPLETED" }, error: null };
const property = { data: { id: "property-1", full_address: "12 Private Street", marketplace_status: "DRAFT" }, error: null };
const profile = { data: { email: "seller@example.com", phone_number: "+2348012345678" }, error: null };
const stored = { id: "mandate-1", property_id: "property-1", user_id: "seller-1", marketplace_mandate_type: "EXCLUSIVE", full_name: "Test Seller", ownership_confirmed: true, mandate_accepted: true, accepted_at: "2026-08-18T12:00:00.000Z", agreement_version: null, commission_percentage: null, commission_amount: null };
const safe = { mandateType: "EXCLUSIVE", sellerFullName: "Test Seller", ownershipConfirmed: true, mandateAccepted: true, acceptedAt: "2026-08-18T12:00:00.000Z", agreementVersion: null, commissionPercentage: null, commissionAmount: null };
const acceptedInput = { mandateType: "EXCLUSIVE" as const, sellerFullName: "Test Seller", ownershipConfirmed: true, mandateAccepted: true };

describe("Marketplace sales mandate", () => {
  beforeEach(() => {
    database.responses.length = 0;
    database.calls.length = 0;
  });

  it.each(["EXCLUSIVE", "OPEN"] as const)("accepts %s mandate type", (mandateType) => {
    expect(salesMandateSchema.safeParse({ ...acceptedInput, mandateType }).success).toBe(true);
  });

  it("validates type, Seller name, ownership acceptance, and rejects server-owned fields", () => {
    expect(salesMandateSchema.safeParse({ ...acceptedInput, mandateType: "SOLE" }).success).toBe(false);
    expect(salesMandateSchema.safeParse({ ...acceptedInput, sellerFullName: " " }).success).toBe(false);
    const ownership = salesMandateSchema.safeParse({ ...acceptedInput, ownershipConfirmed: false });
    expect(ownership.success).toBe(false);
    if (!ownership.success) expect(ownership.error.issues[0]).toMatchObject({ params: { errorCode: "MANDATE_OWNERSHIP_CONFIRMATION_REQUIRED" } });
    for (const field of ["acceptedAt", "commissionPercentage", "commissionAmount", "agreementVersion", "userId", "sellerId"]) expect(salesMandateSchema.safeParse({ ...acceptedInput, [field]: field === "acceptedAt" ? "2000-01-01" : 99 }).success).toBe(false);
  });

  it("saves an accepted mandate for the Seller's own DRAFT with server-owned terms", async () => {
    database.responses.push(seller, property, profile, { data: null, error: null }, { data: stored, error: null });
    await expect(saveSalesMandate("property-1", "seller-1", acceptedInput)).resolves.toEqual(safe);
    const insert = database.calls.find((call) => call.table === "mandates" && call.method === "insert");
    expect(insert?.args[0]).toMatchObject({ user_id: "seller-1", property_id: "property-1", mandate_type: "seller", marketplace_mandate_type: "EXCLUSIVE", ownership_confirmed: true, mandate_accepted: true, agreement_version: null, commission_percentage: null, commission_amount: null });
    expect((insert?.args[0] as any).accepted_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("allows saving an unaccepted Step 3 draft without fabricating acceptance", async () => {
    const unaccepted = { ...stored, ownership_confirmed: false, mandate_accepted: false, accepted_at: null };
    database.responses.push(seller, property, profile, { data: null, error: null }, { data: unaccepted, error: null });
    const result = await saveSalesMandate("property-1", "seller-1", { ...acceptedInput, ownershipConfirmed: false, mandateAccepted: false });
    expect(result).toMatchObject({ ownershipConfirmed: false, mandateAccepted: false, acceptedAt: null });
  });

  it("rejects Buyer-only and other-Seller access before mandate persistence", async () => {
    database.responses.push({ data: null, error: null });
    await expect(saveSalesMandate("property-1", "buyer-1", acceptedInput)).rejects.toMatchObject({ code: "SELLER_PERSONA_REQUIRED" });
    database.responses.push(seller, { data: null, error: null });
    await expect(saveSalesMandate("property-1", "seller-2", acceptedInput)).rejects.toMatchObject({ code: "PROPERTY_NOT_FOUND" });
    expect(database.calls.some((call) => call.table === "mandates")).toBe(false);
  });

  it("updates the one current mandate and preserves an existing accepted state", async () => {
    database.responses.push(seller, property, profile, { data: stored, error: null }, { data: { ...stored, marketplace_mandate_type: "OPEN" }, error: null });
    await saveSalesMandate("property-1", "seller-1", { mandateType: "OPEN", sellerFullName: "Test Seller", ownershipConfirmed: false, mandateAccepted: false });
    expect(database.calls.filter((call) => call.table === "mandates" && call.method === "insert")).toHaveLength(0);
    const update = database.calls.find((call) => call.table === "mandates" && call.method === "update");
    expect(update?.args[0]).toMatchObject({ marketplace_mandate_type: "OPEN", ownership_confirmed: true, mandate_accepted: true, accepted_at: stored.accepted_at });
    expect(update?.args[0]).not.toHaveProperty("commission_percentage");
    expect(update?.args[0]).not.toHaveProperty("commission_amount");
  });

  it("returns the saved Seller-safe mandate and rejects another Seller", async () => {
    database.responses.push(seller, property, { data: stored, error: null });
    await expect(getSalesMandate("property-1", "seller-1")).resolves.toEqual(safe);
    expect(JSON.stringify(safe)).not.toMatch(/user_id|email|phone|address|terms_accepted/i);
    database.responses.push(seller, { data: null, error: null });
    await expect(getSalesMandate("property-1", "seller-2")).rejects.toMatchObject({ code: "PROPERTY_NOT_FOUND" });
  });

  it("returns a stable not-found error when no current mandate exists", async () => {
    database.responses.push(seller, property, { data: null, error: null });
    await expect(getSalesMandate("property-1", "seller-1")).rejects.toMatchObject({ statusCode: 404, code: "MANDATE_NOT_FOUND" });
  });

  it("supports all three creation steps without adding REVIEW", () => {
    for (const currentStep of ["PROPERTY_INFORMATION", "PHOTOS_DOCUMENTS", "SALES_MANDATE"]) expect(draftSchema.safeParse({ currentStep }).success).toBe(true);
    expect(draftSchema.safeParse({ currentStep: "REVIEW" }).success).toBe(false);
  });
});
