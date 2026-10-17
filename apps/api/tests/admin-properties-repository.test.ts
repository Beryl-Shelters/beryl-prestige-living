import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { test } from "node:test";

import { SupabaseAdminPropertiesRepository } from "../src/admin/properties-repository.js";
import { authConfigSchema } from "../src/auth/config.js";

const auth=authConfigSchema.parse({webOrigin:"http://localhost:3000",apiOrigin:"http://localhost:4000",supabaseUrl:"https://example.supabase.co",anonKey:"anon",serviceKey:"service",encryptionKey:randomBytes(32).toString("base64"),cookieSecure:false,production:false,rateLimit:100});
const reviewerId="11111111-1111-4111-8111-111111111111";

test("Admin property detail resolves mandate reviewers without direct admin_profiles access",async()=>{
  const requests:string[]=[];
  const transport:typeof fetch=async(input,init)=>{
    const url=String(input);requests.push(`${init?.method??"GET"} ${url}`);
    if(url.endsWith("/rest/v1/rpc/read_admin_property"))return Response.json({
      id:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",code:"RES-TEST01",physicalMandate:null,
    });
    if(url.includes("/rest/v1/listing_mandate_versions?")){
      assert.match(decodeURIComponent(url),/reviewed_by/);
      assert.doesNotMatch(decodeURIComponent(url),/admin_profiles/);
      return Response.json([{
        id:"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",version:1,agreement_version:"2026-10-v1",generated_at:"2026-10-14T12:00:00.000Z",
        submissions:[{id:"cccccccc-cccc-4ccc-8ccc-cccccccccccc",submission_number:1,status:"APPROVED",uploaded_at:"2026-10-15T12:00:00.000Z",reviewed_by:reviewerId,reviewed_at:"2026-10-16T12:00:00.000Z",rejection_reason:null,documents:[]}],
      }]);
    }
    if(url.endsWith("/rest/v1/rpc/read_admin_profile"))return Response.json({userId:reviewerId,fullName:"Review Admin",active:true});
    return Response.json({message:"Unexpected request"},{status:500});
  };
  const detail=await new SupabaseAdminPropertiesRepository(auth,transport).detail("RES-TEST01");
  assert.equal(detail.physicalMandate?.submissions[0]?.reviewerName,"Review Admin");
  assert.equal(requests.filter(request=>request.includes("/rpc/read_admin_profile")).length,1);
});
