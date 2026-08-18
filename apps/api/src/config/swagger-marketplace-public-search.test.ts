import { describe,expect,it } from "vitest";
import { swaggerSpec } from "./swagger";
describe("public Marketplace search Swagger",()=>{
  const specification=swaggerSpec as any;
  const operation=specification.paths["/marketplace/properties"].get;
  it("documents anonymous LIVE-only browsing",()=>{expect(operation.security).toEqual([]);expect(operation.description).toMatch(/public anonymous.*marketplace_status=LIVE.*DRAFT.*IN_REVIEW.*REJECTED.*excluded/i);expect(Object.keys(specification.paths)).toHaveLength(129)});
  it("documents every supported filter, sort, and pagination input",()=>{const names=operation.parameters.map((parameter:any)=>parameter.name);expect(names).toEqual(["page","limit","q","location","minPrice","maxPrice","propertyType","category","bedrooms","sort"]);expect(operation.parameters.find((parameter:any)=>parameter.name==="sort").schema.enum).toEqual(["DEFAULT","PRICE_HIGH_TO_LOW","PRICE_LOW_TO_HIGH","BEDS","MOST_RECENT"])});
  it("documents an explicit safe card rather than a raw property",()=>{const card=specification.components.schemas.MarketplacePublicPropertyCard;expect(card.required).toEqual(["id","referenceId","title","askingPrice","negotiable","propertyType","propertyCategory","publicLocation","bedrooms","bathrooms","toilets","parkingSpaces","coverImage","photoCount","verified","publishedAt"]);expect(JSON.stringify(card)).not.toMatch(/fullAddress|seller|owner|email|phone|document|mandate|rejection|cloudinary|publicId/i)});
  it("documents stable validation and availability errors",()=>{expect(operation.responses["400"].content["application/json"].examples).toEqual(expect.objectContaining({range:expect.anything(),sort:expect.anything(),page:expect.anything(),limit:expect.anything()}));expect(operation.responses["503"].content["application/json"].example.code).toBe("MARKETPLACE_UNAVAILABLE")});
});
