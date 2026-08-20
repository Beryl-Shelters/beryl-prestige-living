import { describe, expect, it } from "vitest";
import { swaggerSpec } from "./swagger";

describe("marketplace draft Swagger", () => {
  it("documents draft and media routes with the actual contracts", () => {
    const spec = swaggerSpec as any;
    const paths = spec.paths as Record<string, any>;
    for (const key of [
      "/marketplace/seller/properties",
      "/marketplace/seller/properties/{propertyId}",
      "/marketplace/seller/properties/{propertyId}/images",
      "/marketplace/seller/properties/{propertyId}/images/order",
      "/marketplace/seller/properties/{propertyId}/images/{imageId}/cover"
    ]) expect(paths[key]).toBeTruthy();

    const upload = paths["/marketplace/seller/properties/{propertyId}/images"].post;
    expect(upload.security).toEqual([{ bearerAuth: [] }]);
    expect(upload.requestBody.content["multipart/form-data"].schema.properties.images).toBeTruthy();
    expect(upload.description).toMatch(/5MB.*10 property photos.*first image becomes cover/i);
    expect(paths["/marketplace/seller/properties/{propertyId}/images/order"].patch.requestBody).toBeTruthy();

    const draft = spec.components.schemas.MarketplaceDraftRequest;
    expect(draft.properties.propertyType.enum).toContain("DUPLEX");
    expect(draft.properties.propertyCategory.enum).toEqual(["RESIDENTIAL", "COMMERCIAL"]);
    expect(draft.additionalProperties).toBe(false);

    for (const operation of [paths["/marketplace/seller/properties"].post, paths["/marketplace/seller/properties/{propertyId}"].patch]) {
      expect(operation.responses["200"] ?? operation.responses["201"]).toBeTruthy();
      expect(operation.responses["400"].content["application/json"].example.code).toBe("INVALID_DRAFT_PAYLOAD");
      expect(operation.responses["503"].content["application/json"].example.code).toBe("DRAFT_PERSISTENCE_UNAVAILABLE");
    }

    expect(Object.keys(paths)).toHaveLength(130);
  });
});
