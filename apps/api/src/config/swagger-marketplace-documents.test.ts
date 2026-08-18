import { describe, expect, it } from "vitest";
import { swaggerSpec } from "./swagger";

describe("Marketplace private document Swagger", () => {
  const spec = swaggerSpec as any;
  const paths = spec.paths as Record<string, any>;
  const upload = paths["/marketplace/seller/properties/{propertyId}/documents"].post;
  const remove = paths["/marketplace/seller/properties/{propertyId}/documents/{documentId}"].delete;

  it("documents both Seller-only operations without public document access", () => {
    expect(upload.security).toEqual([{ bearerAuth: [] }]);
    expect(remove.security).toEqual([{ bearerAuth: [] }]);
    expect(upload.description).toMatch(/Seller-only.*owned editable DRAFT.*authenticated Cloudinary raw.*never provider URLs or IDs/i);
    expect(remove.description).toMatch(/Seller-only.*owned editable DRAFT.*document must belong/i);
    expect(Object.keys(paths).filter((path) => path.includes("documents"))).toEqual([
      "/marketplace/seller/properties/{propertyId}/documents",
      "/marketplace/seller/properties/{propertyId}/documents/{documentId}"
    ]);
  });

  it("matches the runtime multipart field, size, MIME, and document type contract", () => {
    const multipart = upload.requestBody.content["multipart/form-data"];
    expect(multipart.schema.required).toEqual(["document", "documentType"]);
    expect(multipart.schema.properties.document).toMatchObject({ type: "string", format: "binary" });
    expect(multipart.schema.properties.documentType.enum).toEqual(["OWNERSHIP_PAPERS", "SURVEY_PLAN", "DEED", "CERTIFICATE_OF_OCCUPANCY", "OTHER"]);
    expect(multipart.encoding.document.contentType).toBe("application/pdf");
    expect(upload.requestBody.description).toMatch(/application\/pdf.*10MB/i);
  });

  it("documents the exact safe DTO and draft-detail documents collection", () => {
    const schemas = spec.components.schemas;
    expect(Object.keys(schemas.MarketplacePropertyDocument.properties)).toEqual(["id", "documentType", "displayName", "mimeType", "sizeBytes", "uploadedAt"]);
    expect(JSON.stringify(schemas.MarketplacePropertyDocument)).not.toMatch(/cloudinary|provider|secure_url/i);
    expect(schemas.MarketplaceSellerDraftResult.properties.property.allOf[1].properties.documents.items.$ref).toBe("#/components/schemas/MarketplacePropertyDocument");
    expect(upload.responses["201"].content["application/json"].schema.properties.data.$ref).toBe("#/components/schemas/MarketplaceDocumentUploadResult");
  });
});
