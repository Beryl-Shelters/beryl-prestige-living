import { describe,expect,it } from "vitest";
import { swaggerSpec } from "./swagger";
describe("public Marketplace search Swagger",()=>{
  const specification=swaggerSpec as any;
  const operation=specification.paths["/marketplace/properties"].get;
  it("documents anonymous browsing with optional saved-state authentication",()=>{expect(operation.security).toEqual([{}, {bearerAuth:[]}]);expect(operation.description).toMatch(/public Buyer-safe LIVE.*optional customer session.*saved_properties/i);expect(Object.keys(specification.paths)).toHaveLength(130)});
  it("documents every supported filter, sort, and pagination input",()=>{const names=operation.parameters.map((parameter:any)=>parameter.name);expect(names).toEqual(["page","limit","q","location","minPrice","maxPrice","propertyType","category","condition","furnishing","bedrooms","sort"]);expect(operation.parameters.find((parameter:any)=>parameter.name==="bedrooms").schema.enum).toContain("5+");expect(operation.parameters.find((parameter:any)=>parameter.name==="sort").schema.enum).toEqual(["DEFAULT","PRICE_HIGH_TO_LOW","PRICE_LOW_TO_HIGH","BEDS","MOST_RECENT"])});
  it("documents an explicit safe card rather than a raw property",()=>{const card=specification.components.schemas.MarketplacePublicPropertyCard;expect(card.required).toEqual(["id","referenceId","title","askingPrice","negotiable","propertyType","propertyCategory","publicLocation","bedrooms","bathrooms","toilets","parkingSpaces","coverImage","photoCount","verified","publishedAt","saved"]);expect(JSON.stringify(card)).not.toMatch(/fullAddress|seller|owner|email|phone|document|mandate|rejection|cloudinary|publicId/i)});
  it("documents stable validation and availability errors",()=>{expect(operation.responses["400"].content["application/json"].example.code).toBe("INVALID_MARKETPLACE_FILTER");expect(operation.responses["503"].content["application/json"].example.code).toBe("MARKETPLACE_UNAVAILABLE")});
});
