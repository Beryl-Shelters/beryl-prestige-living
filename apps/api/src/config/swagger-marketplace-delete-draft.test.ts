import { describe, expect, it } from "vitest";
import { swaggerSpec } from "./swagger";

describe("Marketplace Seller draft deletion OpenAPI", () => {
  const specification = swaggerSpec as any;
  const operation = specification.paths["/marketplace/seller/properties/{propertyId}"].delete;

  it("documents the authenticated owner-only DRAFT deletion and safe response", () => {
    expect(operation.security).toEqual([{ bearerAuth: [] }]);
    expect(operation.description).toMatch(/Seller-only owner operation/i);
    expect(operation.description).toMatch(/DRAFT/);
    expect(operation.description).toMatch(/best-effort/i);
    expect(operation.requestBody).toBeUndefined();
    expect(operation.responses["200"]).toBeTruthy();
    expect(specification.components.schemas.MarketplaceDraftDeletion.required).toEqual(["propertyId", "deleted"]);
  });

  it("documents stable lifecycle and persistence failures", () => {
    expect(JSON.stringify(operation.responses["409"])).toContain("PROPERTY_NOT_EDITABLE");
    expect(JSON.stringify(operation.responses["503"])).toContain("DRAFT_DELETE_FAILED");
    expect(JSON.stringify(operation.responses["404"])).toContain("PROPERTY_NOT_FOUND");
  });
});
