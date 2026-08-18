import { describe,expect,it } from "vitest";
import { swaggerSpec } from "./swagger";

describe("public Marketplace detail and saved-property Swagger",()=>{
  const specification=swaggerSpec as any;
  const detail=specification.paths["/marketplace/properties/{propertyId}"].get;

  it("documents optional customer authentication and LIVE-only public detail",()=>{
    expect(detail.security).toEqual([{}, {bearerAuth:[]}]);
    expect(detail.description).toMatch(/marketplace_status=LIVE.*optional valid customer.*saved.*fullAddress.*excluded/i);
    expect(detail.responses["404"].content["application/json"].example.code).toBe("MARKETPLACE_PROPERTY_NOT_FOUND");
    expect(Object.keys(specification.paths)).toHaveLength(130);
  });

  it("documents an explicit Buyer-safe detail with ordered gallery and saved state",()=>{
    const schema=specification.components.schemas.MarketplacePublicPropertyDetail;
    expect(schema.required).toEqual(expect.arrayContaining(["description","publicLocation","initialDeposit","amenities","images","photoCount","verified","saved"]));
    expect(Object.keys(schema.properties).join(",")).not.toMatch(/fullAddress|seller|owner|email|phone|document|mandate|commission|admin|review|rejection|cloudinary|publicId/i);
    expect(specification.components.schemas.MarketplacePublicDetailImage.required).toEqual(["id","url","order","isCover"]);
  });

  it("documents existing canonical save routes with LIVE and privacy compatibility",()=>{
    const save=specification.paths["/properties/{id}/save"].post;
    const list=specification.paths["/properties/saved/me"].get;
    expect(save.description).toMatch(/canonical LIVE Marketplace.*saved_properties.*idempotent/i);
    expect(save.responses["404"].content["application/json"].example.code).toBe("PROPERTY_NOT_AVAILABLE");
    expect(list.description).toMatch(/Buyer-safe.*LIVE.*omitted.*private/i);
    expect(list.responses["200"].content["application/json"].schema.properties.data.$ref).toContain("MarketplaceSavedPropertyList");
  });
});
