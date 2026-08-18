import { beforeEach, describe, expect, it, vi } from "vitest";

type Result = { data?: unknown; error?: unknown };
const database = vi.hoisted(() => ({ responses: [] as Result[], calls: [] as Array<{ table: string; method: string; args: unknown[] }> }));
const provider = vi.hoisted(() => ({ upload: vi.fn(), remove: vi.fn() }));

vi.mock("../../config/supabase", () => ({
  supabaseAdmin: {
    from: (table: string) => {
      const result = database.responses.shift() ?? { data: null, error: null };
      const query: Record<string, unknown> = {};
      for (const method of ["select", "eq", "order", "insert", "delete"]) query[method] = (...args: unknown[]) => {
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
vi.mock("../../utils/cloudinary", () => ({
  uploadImageWithPublicId: vi.fn(),
  deleteImageFromCloudinary: vi.fn(),
  uploadPropertyDocument: provider.upload,
  deletePropertyDocument: provider.remove
}));

import { deleteDraftDocument, getDraft, uploadDraftDocument } from "./marketplace.service";

const seller = { data: { persona_type: "SELLER_DEVELOPER", onboarding_status: "COMPLETED" }, error: null };
const property = { data: { id: "property-1", marketplace_status: "DRAFT", full_address: "12 Private Street" }, error: null };
const stored = { id: "doc-1", property_id: "property-1", document_type: "DEED", display_name: "Deed.pdf", cloudinary_public_id: "private/doc-1", cloudinary_resource_type: "raw", mime_type: "application/pdf", size_bytes: 24, created_at: "2026-08-17T00:00:00Z" };
const safe = { id: "doc-1", documentType: "DEED", displayName: "Deed.pdf", mimeType: "application/pdf", sizeBytes: 24, uploadedAt: "2026-08-17T00:00:00Z" };
const pdf = (overrides: Partial<Express.Multer.File> = {}): Express.Multer.File => ({ fieldname: "document", originalname: "Deed.pdf", encoding: "7bit", mimetype: "application/pdf", size: 24, destination: "", filename: "", path: "", buffer: Buffer.from("%PDF-1.7 valid test document"), stream: undefined as never, ...overrides });
const uploadResponses = (insert: Result = { data: stored, error: null }) => database.responses.push(seller, property, seller, property, insert);

describe("Marketplace private document upload and delete", () => {
  beforeEach(() => {
    database.responses.length = 0;
    database.calls.length = 0;
    provider.upload.mockReset().mockResolvedValue({ public_id: "private/doc-1", resource_type: "raw" });
    provider.remove.mockReset().mockResolvedValue("deleted");
  });

  it("uploads a valid PDF to the Seller's own DRAFT and persists safe metadata", async () => {
    uploadResponses();
    await expect(uploadDraftDocument("property-1", "seller-1", pdf(), { documentType: "DEED" })).resolves.toEqual(safe);
    expect(provider.upload).toHaveBeenCalledWith(expect.any(Buffer), "beryl-prestige/properties/documents");
    expect(database.calls).toContainEqual({ table: "property_documents", method: "insert", args: [expect.objectContaining({ property_id: "property-1", document_type: "DEED", cloudinary_public_id: "private/doc-1", cloudinary_resource_type: "raw" })] });
    expect(JSON.stringify(safe)).not.toMatch(/cloudinary|secure_url|provider/i);
  });

  it("sanitizes a supplied display name", async () => {
    uploadResponses({ data: { ...stored, display_name: "_evil_.pdf" }, error: null });
    await uploadDraftDocument("property-1", "seller-1", pdf(), { documentType: "DEED", displayName: "../<evil>.pdf" });
    expect(database.calls).toContainEqual({ table: "property_documents", method: "insert", args: [expect.objectContaining({ display_name: "_evil_.pdf" })] });
  });

  it("rejects a Buyer-only customer before provider upload", async () => {
    database.responses.push({ data: null, error: null });
    await expect(uploadDraftDocument("property-1", "buyer-1", pdf(), { documentType: "DEED" })).rejects.toMatchObject({ statusCode: 403, code: "SELLER_PERSONA_REQUIRED" });
    expect(provider.upload).not.toHaveBeenCalled();
  });

  it("blocks another Seller before provider upload", async () => {
    database.responses.push(seller, { data: null, error: null });
    await expect(uploadDraftDocument("property-1", "seller-2", pdf(), { documentType: "DEED" })).rejects.toMatchObject({ statusCode: 404, code: "PROPERTY_NOT_FOUND" });
    expect(provider.upload).not.toHaveBeenCalled();
  });

  it("rejects oversized, unsafe MIME, and spoofed PDF files", async () => {
    await expect(uploadDraftDocument("property-1", "seller-1", pdf({ size: 10 * 1024 * 1024 + 1 }), { documentType: "DEED" })).rejects.toMatchObject({ code: "DOCUMENT_TOO_LARGE" });
    await expect(uploadDraftDocument("property-1", "seller-1", pdf({ mimetype: "application/zip" }), { documentType: "DEED" })).rejects.toMatchObject({ code: "INVALID_DOCUMENT_TYPE" });
    await expect(uploadDraftDocument("property-1", "seller-1", pdf({ buffer: Buffer.from("not a pdf") }), { documentType: "DEED" })).rejects.toMatchObject({ code: "INVALID_DOCUMENT_TYPE" });
    expect(provider.upload).not.toHaveBeenCalled();
  });

  it("cleans up the provider asset when metadata persistence fails", async () => {
    uploadResponses({ data: null, error: { message: "insert failed" } });
    await expect(uploadDraftDocument("property-1", "seller-1", pdf(), { documentType: "DEED" })).rejects.toMatchObject({ statusCode: 503, code: "DOCUMENT_UPLOAD_FAILED" });
    expect(provider.remove).toHaveBeenCalledWith("private/doc-1");
  });

  it("deletes the owned document from provider and metadata storage", async () => {
    database.responses.push(seller, property, { data: stored, error: null }, seller, property, { data: null, error: null });
    await expect(deleteDraftDocument("property-1", "doc-1", "seller-1")).resolves.toBeUndefined();
    expect(provider.remove).toHaveBeenCalledWith("private/doc-1");
    expect(database.calls).toContainEqual({ table: "property_documents", method: "delete", args: [] });
  });

  it("allows metadata cleanup when the provider asset is already missing", async () => {
    provider.remove.mockResolvedValue("not_found");
    database.responses.push(seller, property, { data: stored, error: null }, seller, property, { data: null, error: null });
    await expect(deleteDraftDocument("property-1", "doc-1", "seller-1")).resolves.toBeUndefined();
    expect(database.calls).toContainEqual({ table: "property_documents", method: "delete", args: [] });
  });

  it("does not delete metadata after an unexpected provider failure", async () => {
    provider.remove.mockRejectedValue(new Error("provider unavailable"));
    database.responses.push(seller, property, { data: stored, error: null });
    await expect(deleteDraftDocument("property-1", "doc-1", "seller-1")).rejects.toMatchObject({ statusCode: 503, code: "DOCUMENT_DELETE_FAILED" });
    expect(database.calls.some((call) => call.table === "property_documents" && call.method === "delete")).toBe(false);
  });

  it("blocks another Seller from deleting a document", async () => {
    database.responses.push(seller, { data: null, error: null });
    await expect(deleteDraftDocument("property-1", "doc-1", "seller-2")).rejects.toMatchObject({ code: "PROPERTY_NOT_FOUND" });
    expect(provider.remove).not.toHaveBeenCalled();
  });

  it("returns no deleted document from subsequent draft detail", async () => {
    database.responses.push(seller, property, { data: stored, error: null }, seller, property, { data: null, error: null }, seller, property, { data: [], error: null }, seller, property, { data: [], error: null });
    await deleteDraftDocument("property-1", "doc-1", "seller-1");
    const draft = await getDraft("property-1", "seller-1");
    expect(draft.documents).toEqual([]);
  });
});
