import { readFileSync } from "node:fs";
import path from "node:path";
import { describe,expect,it } from "vitest";

const marketplaceRoutes=readFileSync(path.resolve(__dirname,"marketplace.routes.ts"),"utf8");
const marketplaceService=readFileSync(path.resolve(__dirname,"marketplace.service.ts"),"utf8");
const propertyRoutes=readFileSync(path.resolve(__dirname,"../property/property.routes.ts"),"utf8");
const propertyController=readFileSync(path.resolve(__dirname,"../property/property.controller.ts"),"utf8");

describe("public Marketplace detail boundaries",()=>{
  it("mounts anonymous/optional detail before Seller-only authentication",()=>{
    const route='router.get("/properties/:propertyId",optionalCustomerSessionMiddleware,c.getPublicDetail)';
    expect(marketplaceRoutes).toContain(route);
    expect(marketplaceRoutes.indexOf(route)).toBeLessThan(marketplaceRoutes.indexOf('router.use("/seller",customerSessionMiddleware,requireVerifiedCustomer)'));
  });

  it("selects an explicit public detail projection without private relations",()=>{
    const selection=marketplaceService.match(/select\("id,property_code,title,description,category,property_type,public_location,price,negotiable,initial_deposit_type,[^\n]+property_images\(id,image_url,sort_order,is_cover\)"\)/)?.[0]??"";
    expect(selection).toBeTruthy();
    expect(selection).not.toMatch(/\*|full_address|owner_id|profile|document|mandate|commission|admin|review|rejection|cloudinary/i);
  });

  it("protects existing saved-property routes with current verified customer sessions",()=>{
    for(const route of ['router.get(\n  "/saved/me"','router.post(\n  "/:id/save"','router.delete(\n  "/:id/save"']){
      const start=propertyRoutes.indexOf(route);
      expect(start).toBeGreaterThan(-1);
      expect(propertyRoutes.slice(start,start+150)).toMatch(/customerSessionMiddleware[\s\S]*requireVerifiedCustomer/);
    }
    expect(propertyController).toContain('import { getAuthUserId } from "../../utils/getAuthUserId"');
    expect(propertyController).not.toMatch(/return getAuthUserId\(req\)/);
  });
});
