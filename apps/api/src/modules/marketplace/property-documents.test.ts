import { beforeEach, describe, expect, it, vi } from "vitest";
import { documentMetadataSchema } from "./marketplace.validators";

type Result = { data?: unknown; error?: unknown };
const database = vi.hoisted(() => ({ responses: [] as Result[], calls: [] as Array<{ table: string; method: string; args: unknown[] }> }));

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
    },
  },
}));
vi.mock("../../utils/cloudinary", () => ({ uploadImageWithPublicId: vi.fn(), deleteImageFromCloudinary: vi.fn() }));

import { createDocumentMetadata, deleteDocumentMetadata, findDocumentMetadata, getDraft, listDocumentMetadata } from "./marketplace.service";

const seller = { data: { persona_type: "SELLER_DEVELOPER", onboarding_status: "COMPLETED" }, error: null };
const property = { data: { id: "property-1", owner_id: "seller-1", marketplace_status: "DRAFT", marketplace_current_step: "PHOTOS_DOCUMENTS", full_address: "12 Private Street" }, error: null };
const storedDocument = { id: "doc-1", document_type: "DEED", display_name: "Deed.pdf", mime_type: "application/pdf", size_bytes: 1200, created_at: "2026-08-17T00:00:00Z", cloudinary_public_id: "private/id", cloudinary_resource_type: "raw", secure_url: "https://provider.invalid/file" };
const safeDocument = { id: "doc-1", documentType: "DEED", displayName: "Deed.pdf", mimeType: "application/pdf", sizeBytes: 1200, uploadedAt: "2026-08-17T00:00:00Z" };

describe("Seller property document metadata", () => {
  beforeEach(() => {
    database.responses.length = 0;
    database.calls.length = 0;
  });

  it("maps provider records to the exact Seller-safe DTO", async () => {
    database.responses.push(seller, property, { data: [storedDocument], error: null });
    const [result] = await listDocumentMetadata("property-1", "seller-1");
    expect(result).toEqual(safeDocument);
    expect(JSON.stringify(result)).not.toMatch(/cloudinary|public_id|resource_type|secure_url|provider/i);
  });

  it.each(["OWNERSHIP_PAPERS", "SURVEY_PLAN", "DEED", "CERTIFICATE_OF_OCCUPANCY", "OTHER"])("accepts %s", (documentType) => {
    expect(documentMetadataSchema.parse({ documentType, displayName: "  Document.pdf  " }).displayName).toBe("Document.pdf");
  });

  it("rejects unknown and blank document metadata", () => {
    expect(documentMetadataSchema.safeParse({ documentType: "PASSPORT", displayName: "file.pdf" }).success).toBe(false);
    expect(documentMetadataSchema.safeParse({ documentType: "DEED", displayName: "   " }).success).toBe(false);
  });

  it("returns an empty document list for an owned draft", async () => {
    database.responses.push(seller, property, { data: [], error: null });
    await expect(listDocumentMetadata("property-1", "seller-1")).resolves.toEqual([]);
  });

  it("returns safe documents in deterministic created-at order", async () => {
    database.responses.push(seller, property, { data: [storedDocument], error: null });
    await expect(listDocumentMetadata("property-1", "seller-1")).resolves.toEqual([safeDocument]);
    expect(database.calls).toContainEqual({ table: "property_documents", method: "order", args: ["created_at", { ascending: true }] });
  });

  it("keeps images and Seller-private fullAddress intact in draft detail", async () => {
    database.responses.push(seller, property, { data: [{ id: "image-1", image_url: "https://image.invalid/1", sort_order: 0, is_cover: true }], error: null }, seller, property, { data: [storedDocument], error: null });
    const result = await getDraft("property-1", "seller-1");
    expect(result.fullAddress).toBe("12 Private Street");
    expect(result.images).toEqual([{ id: "image-1", url: "https://image.invalid/1", order: 0, isCover: true }]);
    expect(result.documents).toEqual([safeDocument]);
  });

  it("blocks metadata access when the draft is not owned by the Seller", async () => {
    database.responses.push(seller, { data: null, error: null });
    await expect(listDocumentMetadata("property-1", "seller-2")).rejects.toMatchObject({ statusCode: 404, code: "PROPERTY_NOT_FOUND" });
    expect(database.calls.some((call) => call.table === "property_documents")).toBe(false);
  });

  it("creates metadata internally and returns only the safe DTO", async () => {
    database.responses.push(seller, property, { data: storedDocument, error: null });
    const row = { document_type: "DEED", display_name: "Deed.pdf", cloudinary_public_id: "private/id", cloudinary_resource_type: "raw", mime_type: "application/pdf", size_bytes: 1200 };
    await expect(createDocumentMetadata("property-1", "seller-1", row)).resolves.toEqual(safeDocument);
    expect(database.calls).toContainEqual({ table: "property_documents", method: "insert", args: [{ property_id: "property-1", ...row }] });
  });

  it("finds metadata by property and document ID", async () => {
    database.responses.push(seller, property, { data: [storedDocument], error: null });
    await expect(findDocumentMetadata("property-1", "doc-1", "seller-1")).resolves.toEqual(safeDocument);
  });

  it("deletes metadata only after Seller ownership is verified", async () => {
    database.responses.push(seller, property, { data: null, error: null });
    await expect(deleteDocumentMetadata("property-1", "doc-1", "seller-1")).resolves.toBeUndefined();
    expect(database.calls).toContainEqual({ table: "property_documents", method: "eq", args: ["id", "doc-1"] });
    expect(database.calls).toContainEqual({ table: "property_documents", method: "eq", args: ["property_id", "property-1"] });
  });
});
