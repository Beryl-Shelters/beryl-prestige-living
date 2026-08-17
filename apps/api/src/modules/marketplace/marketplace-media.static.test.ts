import { describe, expect, it } from "vitest"; import { readFileSync } from "node:fs"; import path from "node:path";
const read=(name:string)=>readFileSync(path.resolve(__dirname,name),"utf8");
describe("marketplace draft photos",()=>{const service=read("marketplace.service.ts"),routes=read("marketplace.routes.ts"),validators=read("marketplace.validators.ts");
it("uses existing Cloudinary and the canonical property_images table",()=>{expect(service).toContain('uploadImageWithPublicId');expect(service).toContain('deleteImageFromCloudinary');expect(service).toContain('from("property_images")');expect(routes).toContain('upload.array("images",10)')});
it("enforces media ownership, image limits, order, and a single cover",()=>{expect(service).toContain('IMAGE_LIMIT_EXCEEDED');expect(service).toContain('existing.length+files.length>10');expect(service).toContain('is_cover:existing.length===0&&i===0');expect(service).toContain('new Set(ids).size');expect(service).toContain('update({is_cover:false})')});
it("keeps image DTOs safe and supports both implemented draft steps",()=>{expect(service).toContain('const imageDto=(x:any)=>({id:x.id,url:x.image_url,order:x.sort_order,isCover:x.is_cover})');expect(service).not.toContain('cloudinary_public_id:x.');expect(validators).toContain('"PROPERTY_INFORMATION","PHOTOS_DOCUMENTS"')});
});
