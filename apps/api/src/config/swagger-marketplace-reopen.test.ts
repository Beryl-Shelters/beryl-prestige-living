import { describe,expect,it } from "vitest";
import { swaggerSpec } from "./swagger";
describe("Marketplace rejected correction Swagger",()=>{
  const specification=swaggerSpec as any;
  const reopen=specification.paths["/marketplace/seller/properties/{propertyId}/reopen"].post;
  const submit=specification.paths["/marketplace/seller/properties/{propertyId}/submit"].post;
  it("documents the Seller-only REJECTED to DRAFT reopen",()=>{expect(reopen.security).toEqual([{bearerAuth:[]}]);expect(reopen.description).toMatch(/REJECTED to DRAFT.*reason.*timestamps.*photos.*documents.*mandate.*history.*preserved/i);expect(reopen.responses["409"].content["application/json"].examples).toHaveProperty("alreadyReopened");expect(reopen.responses["503"].content["application/json"].example.code).toBe("LISTING_REOPEN_FAILED")});
  it("documents corrected DRAFT resubmission and preservation",()=>{expect(submit.description).toMatch(/reopened for correction.*new server timestamp.*rejection reason.*history remain intact/i);expect(submit.description).not.toMatch(/24 hours|48 hours|working days/i)});
  it("documents the deterministic reopen response",()=>{const schema=specification.components.schemas.MarketplaceReopenResult;expect(schema.properties.status.enum).toEqual(["DRAFT"]);expect(schema.properties.nextAction.enum).toEqual(["EDIT_REJECTED_LISTING"]);expect(Object.keys(specification.paths)).toHaveLength(129)});
});
