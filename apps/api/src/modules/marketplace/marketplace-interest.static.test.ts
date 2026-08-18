import { readFileSync } from "node:fs";
import path from "node:path";
import { describe,expect,it } from "vitest";

const routes=readFileSync(path.resolve(__dirname,"marketplace.routes.ts"),"utf8");
const controller=readFileSync(path.resolve(__dirname,"marketplace.controller.ts"),"utf8");
const inquiryService=readFileSync(path.resolve(__dirname,"../inquiry/inquiry.service.ts"),"utf8");
const limiter=readFileSync(path.resolve(__dirname,"../../middlewares/auth-rate-limiters.ts"),"utf8");

describe("Marketplace interest route boundaries",()=>{
  it("requires current customer-session authentication and verified customer entitlement",()=>{
    expect(routes).toContain('router.post("/properties/:propertyId/interest",customerSessionMiddleware,requireVerifiedCustomer,marketplaceInterestRateLimiter,c.expressInterest)');
    expect(routes).not.toMatch(/interest",authMiddleware/);
  });

  it("uses route/auth identity and the existing inquiries domain",()=>{
    expect(controller).toContain('createMarketplaceInterest(propertyId.data,getAuthUserId(req),input.data)');
    expect(controller).not.toMatch(/req\.body\.(customer|user|property|email|phone)/);
    expect(inquiryService).toContain('.from("inquiries").insert(');
    expect(inquiryService).not.toMatch(/marketplace_interests|buyer_leads|property_interest_requests/);
  });

  it("guards immediate retries per customer and property without banning later explicit inquiries",()=>{
    const block=limiter.match(/export const marketplaceInterestRateLimiter[\s\S]+?\n\}\);/)?.[0]??"";
    expect(block).toMatch(/windowMs:\s*60 \* 1000/);
    expect(block).toMatch(/max:\s*1/);
    expect(block).toMatch(/req\.user\?\.id[\s\S]*req\.params\.propertyId/);
  });
});
