import { describe, expect, it } from "vitest";
import { swaggerSpec } from "./swagger";
describe("Admin Marketplace review Swagger", () => {
  const specification = swaggerSpec as any; const paths = specification.paths;
  it("documents all five isolated Admin review operations", () => { const operations = [paths["/admin/marketplace/properties"].get, paths["/admin/marketplace/properties/{propertyId}"].get, paths["/admin/marketplace/properties/{propertyId}/documents/{documentId}/access"].get, paths["/admin/marketplace/properties/{propertyId}/approve"].post, paths["/admin/marketplace/properties/{propertyId}/reject"].post]; for (const operation of operations) { expect(operation.security).toEqual([{ bearerAuth: [] }]); expect(operation.description).toBeTruthy(); } expect(Object.keys(paths)).toHaveLength(128); });
  it("documents feedback and short-lived document access", () => { const schemas = specification.components.schemas; expect(schemas.AdminMarketplaceRejectRequest.required).toEqual(["reason"]); expect(schemas.AdminMarketplaceRejectRequest.properties.reason).toMatchObject({ minLength: 3, maxLength: 1000 }); expect(schemas.AdminMarketplaceDocumentAccess.properties.url.description).toMatch(/five minutes/i); expect(JSON.stringify(schemas.AdminMarketplaceReviewDetail)).not.toMatch(/cloudinary_public_id|publicId/); });
});
