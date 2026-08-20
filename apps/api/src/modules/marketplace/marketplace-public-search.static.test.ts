import { readFileSync } from "node:fs";
import path from "node:path";
import { describe,expect,it } from "vitest";
const routes=readFileSync(path.resolve(__dirname,"marketplace.routes.ts"),"utf8");
const service=readFileSync(path.resolve(__dirname,"marketplace.service.ts"),"utf8");
describe("public Marketplace route boundary",()=>{
  it("mounts public search with optional customer state before Seller authentication",()=>{const route='router.get("/properties",optionalCustomerSessionMiddleware,c.listPublic)';expect(routes.indexOf(route)).toBeGreaterThan(-1);expect(routes.indexOf(route)).toBeLessThan(routes.indexOf('router.use("/seller",customerSessionMiddleware,requireVerifiedCustomer)'))});
  it("selects only explicit public columns with one joined image query",()=>{const select=service.match(/select\("id,property_code,title,description,[^\n]+property_images\(id,image_url,sort_order,is_cover\)"/)?.[0]??"";expect(select).toBeTruthy();expect(select).not.toMatch(/\*|full_address|owner_id|profile|document|mandate|rejection|cloudinary/i)});
});
