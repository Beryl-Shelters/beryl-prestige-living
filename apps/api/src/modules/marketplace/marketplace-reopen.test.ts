import { beforeEach, describe, expect, it, vi } from "vitest";

type Result={data?:any;error?:unknown};
const database=vi.hoisted(()=>({responses:[] as Result[],rpcResponses:[] as Result[],calls:[] as Array<{table:string;method:string;args:unknown[]}>}));
vi.mock("../../config/supabase",()=>({supabaseAdmin:{from:(table:string)=>{const result=database.responses.shift()??{data:null,error:null};const query:Record<string,any>={};for(const method of ["select","eq"]){query[method]=(...args:unknown[])=>{database.calls.push({table,method,args});return query}}query.maybeSingle=()=>Promise.resolve(result);return query},rpc:(name:string,args:unknown)=>{database.calls.push({table:name,method:"rpc",args:[args]});return Promise.resolve(database.rpcResponses.shift()??{data:null,error:null})}}}));
vi.mock("../../utils/cloudinary",()=>({uploadImageWithPublicId:vi.fn(),deleteImageFromCloudinary:vi.fn(),uploadPropertyDocument:vi.fn(),deletePropertyDocument:vi.fn()}));
import { reopenRejectedProperty } from "./marketplace.service";

const seller={data:{persona_type:"SELLER_DEVELOPER",onboarding_status:"COMPLETED"},error:null};
const reopened={outcome:"REOPENED",property_id:"property-1",reference_id:"BRL-ONE",marketplace_status:"DRAFT",current_step:"REVIEW",rejection_reason:"Provide a clearer survey plan",rejected_at:"2026-08-18T14:00:00.000Z",reviewed_at:"2026-08-18T14:00:00.000Z"};

describe("Marketplace rejected listing reopen",()=>{
  beforeEach(()=>{database.responses.length=0;database.rpcResponses.length=0;database.calls.length=0});
  it("reopens the owning Seller's REJECTED listing through one atomic RPC",async()=>{database.responses.push(seller);database.rpcResponses.push({data:[reopened],error:null});await expect(reopenRejectedProperty("property-1","seller-1")).resolves.toEqual({propertyId:"property-1",referenceId:"BRL-ONE",status:"DRAFT",currentStep:"REVIEW",rejectionReason:reopened.rejection_reason,rejectedAt:reopened.rejected_at,reviewedAt:reopened.reviewed_at,nextAction:"EDIT_REJECTED_LISTING"});expect(database.calls.filter(call=>call.method==="rpc")).toEqual([{table:"reopen_rejected_marketplace_property",method:"rpc",args:[{p_property_id:"property-1",p_owner_id:"seller-1"}]}])});
  it("rejects a Buyer-only customer before calling the RPC",async()=>{database.responses.push({data:null,error:null});await expect(reopenRejectedProperty("property-1","buyer-1")).rejects.toMatchObject({code:"SELLER_PERSONA_REQUIRED"});expect(database.calls.some(call=>call.method==="rpc")).toBe(false)});
  it("maps another Seller or missing property safely",async()=>{database.responses.push(seller);database.rpcResponses.push({data:[{outcome:"NOT_FOUND"}],error:null});await expect(reopenRejectedProperty("property-1","seller-2")).rejects.toMatchObject({statusCode:404,code:"PROPERTY_NOT_FOUND"})});
  it.each([["NOT_REJECTED","LISTING_NOT_REJECTED"],["ALREADY_REOPENED","LISTING_ALREADY_REOPENED"]])("maps %s to a stable conflict",async(outcome,code)=>{database.responses.push(seller);database.rpcResponses.push({data:[{...reopened,outcome}],error:null});await expect(reopenRejectedProperty("property-1","seller-1")).rejects.toMatchObject({statusCode:409,code});expect(database.calls.filter(call=>call.method==="rpc")).toHaveLength(1)});
  it("does not expose database errors",async()=>{database.responses.push(seller);database.rpcResponses.push({data:null,error:{message:"private database detail"}});await expect(reopenRejectedProperty("property-1","seller-1")).rejects.toMatchObject({statusCode:503,code:"LISTING_REOPEN_FAILED",message:"Listing reopen failed"})});
});
