import { describe, expect, it } from "vitest";
import { swaggerSpec } from "./swagger";

describe("Marketplace sales mandate Swagger", () => {
  const specification = swaggerSpec as any;
  const path = specification.paths["/marketplace/seller/properties/{propertyId}/mandate"];

  it("documents only the mounted Seller mandate save and resume operations", () => {
    expect(path.put).toBeTruthy();
    expect(path.get).toBeTruthy();
    expect(path.put.security).toEqual([{ bearerAuth: [] }]);
    expect(path.get.security).toEqual([{ bearerAuth: [] }]);
    expect(specification.paths["/marketplace/seller/properties/{propertyId}/review"].get).toBeTruthy();
    expect(specification.paths["/marketplace/seller/properties/{propertyId}/submit"].post).toBeTruthy();
    expect(Object.keys(specification.paths)).toHaveLength(127);
  });

  it("documents the exact request and Seller-safe response", () => {
    expect(path.put.requestBody.content["application/json"].schema.$ref).toBe("#/components/schemas/MarketplaceSalesMandateRequest");
    expect(specification.components.schemas.MarketplaceSalesMandateRequest.properties.mandateType.enum).toEqual(["EXCLUSIVE", "OPEN"]);
    expect(specification.components.schemas.MarketplaceSalesMandateRequest.required).toEqual(["mandateType", "sellerFullName", "ownershipConfirmed", "mandateAccepted"]);
    expect(Object.keys(specification.components.schemas.MarketplaceSalesMandate.properties)).toEqual(["mandateType", "sellerFullName", "ownershipConfirmed", "mandateAccepted", "acceptedAt", "agreementVersion", "commissionPercentage", "commissionAmount"]);
  });

  it("marks acceptance timestamps and commercial/legal configuration as server-controlled", () => {
    const response = specification.components.schemas.MarketplaceSalesMandate.properties;
    expect(response.acceptedAt).toMatchObject({ readOnly: true, nullable: true });
    expect(response.agreementVersion).toMatchObject({ readOnly: true, nullable: true });
    expect(response.commissionPercentage).toMatchObject({ readOnly: true, nullable: true });
    expect(response.commissionAmount).toMatchObject({ readOnly: true, nullable: true });
    expect(path.put.description).toMatch(/acceptedAt is generated server-side.*server-controlled.*null until Product\/legal configuration/i);
    expect(path.put.description).toMatch(/does not submit.*review/i);
  });

  it("documents stable ownership, not-found, and unavailable errors", () => {
    expect(path.put.responses["400"].content["application/json"].examples.ownership.value.code).toBe("MANDATE_OWNERSHIP_CONFIRMATION_REQUIRED");
    expect(path.get.responses["404"].content["application/json"].example.code).toBe("MANDATE_NOT_FOUND");
    expect(path.get.responses["503"].content["application/json"].example.code).toBe("MANDATE_UNAVAILABLE");
  });
});
