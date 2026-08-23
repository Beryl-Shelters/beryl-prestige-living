import { beforeEach, describe, expect, it, vi } from "vitest";

type Result = { data?: any; error?: unknown };
const database = vi.hoisted(() => ({ responses: [] as Result[], rpcResponses: [] as Result[], calls: [] as Array<{ table: string; method: string; args: unknown[] }> }));
const provider = vi.hoisted(() => ({ removeImage: vi.fn(), removeDocument: vi.fn() }));

vi.mock("../../config/supabase", () => ({ supabaseAdmin: {
  from: (table: string) => { const result = database.responses.shift() ?? { data: null, error: null }; const query: Record<string, any> = {}; for (const method of ["select", "eq"]) query[method] = (...args: unknown[]) => { database.calls.push({ table, method, args }); return query; }; query.maybeSingle = () => Promise.resolve(result); query.then = (resolve: (value: Result) => unknown) => Promise.resolve(result).then(resolve); return query; },
  rpc: (name: string, args: unknown) => { database.calls.push({ table: name, method: "rpc", args: [args] }); return Promise.resolve(database.rpcResponses.shift() ?? { data: null, error: null }); }
} }));
vi.mock("../../utils/cloudinary", () => ({ uploadImageWithPublicId: vi.fn(), deleteImageFromCloudinary: provider.removeImage, uploadPropertyDocument: vi.fn(), deletePropertyDocument: provider.removeDocument }));

import { deleteDraftProperty } from "./marketplace.service";

const seller = { data: { persona_type: "SELLER_DEVELOPER", onboarding_status: "COMPLETED" }, error: null };
const owned = (status = "DRAFT") => ({ data: { id: "property-1", marketplace_status: status }, error: null });
const successfulDelete = (...assets: Result[]) => { database.responses.push(seller, owned(), ...assets); database.rpcResponses.push({ data: [{ outcome: "DELETED", property_id: "property-1" }], error: null }); };

describe("Marketplace Seller draft deletion", () => {
  beforeEach(() => { database.responses.length = 0; database.rpcResponses.length = 0; database.calls.length = 0; provider.removeImage.mockReset().mockResolvedValue("deleted"); provider.removeDocument.mockReset().mockResolvedValue("deleted"); vi.restoreAllMocks(); });

  it("deletes an empty owned DRAFT atomically and returns only the safe DTO", async () => {
    successfulDelete({ data: [], error: null }, { data: [], error: null });
    await expect(deleteDraftProperty("property-1", "seller-1")).resolves.toEqual({ propertyId: "property-1", deleted: true });
    expect(database.calls).toContainEqual({ table: "delete_marketplace_draft_property", method: "rpc", args: [{ p_property_id: "property-1", p_owner_id: "seller-1" }] });
  });

  it("cleans up draft photos and private documents after database success", async () => {
    successfulDelete({ data: [{ cloudinary_public_id: "image/internal" }], error: null }, { data: [{ cloudinary_public_id: "document/internal" }], error: null });
    await deleteDraftProperty("property-1", "seller-1");
    expect(provider.removeImage).toHaveBeenCalledWith("image/internal");
    expect(provider.removeDocument).toHaveBeenCalledWith("document/internal");
  });

  it("keeps database deletion successful when provider cleanup fails without exposing provider data", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
    provider.removeImage.mockRejectedValueOnce(new Error("provider secret"));
    successfulDelete({ data: [{ cloudinary_public_id: "image/internal" }], error: null }, { data: [], error: null });
    await expect(deleteDraftProperty("property-1", "seller-1")).resolves.toEqual({ propertyId: "property-1", deleted: true });
    expect(logged).toHaveBeenCalledWith("Marketplace draft provider cleanup incomplete", { propertyId: "property-1", failedCleanupCount: 1 });
    expect(JSON.stringify(logged.mock.calls)).not.toContain("image/internal");
  });

  it("requires a completed Seller persona before property access", async () => {
    database.responses.push({ data: null, error: null });
    await expect(deleteDraftProperty("property-1", "buyer-1")).rejects.toMatchObject({ statusCode: 403, code: "SELLER_PERSONA_REQUIRED" });
  });

  it("does not reveal another Seller's or a missing draft", async () => {
    database.responses.push(seller, { data: null, error: null });
    await expect(deleteDraftProperty("property-1", "seller-2")).rejects.toMatchObject({ statusCode: 404, code: "PROPERTY_NOT_FOUND" });
  });

  it.each(["IN_REVIEW", "LIVE", "REJECTED"])("rejects %s without fetching assets or calling the RPC", async (status) => {
    database.responses.push(seller, owned(status));
    await expect(deleteDraftProperty("property-1", "seller-1")).rejects.toMatchObject({ statusCode: 409, code: "PROPERTY_NOT_EDITABLE" });
    expect(database.calls.some((call) => call.table === "property_images" || call.method === "rpc")).toBe(false);
  });

  it("maps a repeated atomic delete to stable not-found", async () => {
    database.responses.push(seller, owned(), { data: [], error: null }, { data: [], error: null });
    database.rpcResponses.push({ data: [{ outcome: "NOT_FOUND" }], error: null });
    await expect(deleteDraftProperty("property-1", "seller-1")).rejects.toMatchObject({ statusCode: 404, code: "PROPERTY_NOT_FOUND" });
  });

  it("sanitizes metadata failures without provider cleanup", async () => {
    database.responses.push(seller, owned(), { data: null, error: { message: "private SQL" } }, { data: [], error: null });
    await expect(deleteDraftProperty("property-1", "seller-1")).rejects.toMatchObject({ statusCode: 503, code: "DRAFT_DELETE_FAILED", message: "Property draft could not be deleted" });
    expect(provider.removeImage).not.toHaveBeenCalled();
  });
});
