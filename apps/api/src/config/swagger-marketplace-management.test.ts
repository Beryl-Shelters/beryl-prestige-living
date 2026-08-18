import { describe,expect,it } from "vitest";
import { swaggerSpec } from "./swagger";

describe("Marketplace Seller management Swagger",()=>{
  const specification=swaggerSpec as any;
  const list=specification.paths["/marketplace/seller/properties"].get;
  const management=specification.paths["/marketplace/seller/properties/{propertyId}/management"].get;

  it("documents status-filtered My Listings and owner-only management detail",()=>{
    expect(list.security).toEqual([{bearerAuth:[]}]);
    expect(management.security).toEqual([{bearerAuth:[]}]);
    const status=list.parameters.find((parameter:any)=>parameter.name==="status");
    expect(status.schema).toMatchObject({enum:["ALL","DRAFT","IN_REVIEW","LIVE","REJECTED"],default:"ALL"});
    expect(list.responses["400"].content["application/json"].example.code).toBe("INVALID_LISTING_STATUS_FILTER");
    expect(management.responses["503"].content["application/json"].example.code).toBe("PROPERTY_MANAGEMENT_UNAVAILABLE");
  });

  it("documents counts, pagination, status metadata, and deterministic actions",()=>{
    const listResult=specification.components.schemas.MarketplaceSellerPropertyList.properties;
    expect(listResult.counts.$ref).toContain("MarketplaceSellerStatusCounts");
    expect(listResult.pagination.$ref).toContain("Pagination");
    expect(specification.components.schemas.MarketplaceSellerStatusCounts.required).toEqual(["all","draft","inReview","live","rejected"]);
    expect(specification.components.schemas.MarketplaceSellerPropertySummary.properties.nextAction.enum).toEqual(["CONTINUE_PROPERTY_INFORMATION","CONTINUE_PHOTOS_DOCUMENTS","CONTINUE_SALES_MANDATE","CONTINUE_REVIEW","EDIT_REJECTED_LISTING","VIEW_REVIEW_STATUS","VIEW_LIVE_LISTING","VIEW_REJECTION"]);
  });

  it("does not document fabricated timestamps, SLAs, or provider data",()=>{
    const summary=specification.components.schemas.MarketplaceSellerPropertySummary.properties;
    expect(summary.publishedAt).toMatchObject({nullable:true});
    expect(summary.rejectedAt).toMatchObject({nullable:true});
    expect(specification.components.schemas.MarketplaceSellerManagement.properties.reviewHistory.items.$ref).toContain("MarketplaceSellerReviewHistory");
    expect(specification.components.schemas.MarketplaceSellerReviewHistory.properties).not.toHaveProperty("reviewedByAdminId");
    expect(JSON.stringify({list,management,schemas:specification.components.schemas.MarketplaceSellerManagement})).not.toMatch(/expectedReviewDate|working days|24 hours|48 hours|cloudinary|publicId|document_url/i);
  });
});
