import { beforeEach, describe, expect, it, vi } from "vitest";
import { draftListSchema } from "./marketplace.validators";

type Result={data?:any;error?:unknown;count?:number};
const database=vi.hoisted(()=>({responses:[] as Result[],calls:[] as Array<{table:string;method:string;args:unknown[]}>}));

vi.mock("../../config/supabase",()=>({supabaseAdmin:{from:(table:string)=>{const result=database.responses.shift()??{data:null,error:null};const query:Record<string,any>={};for(const method of ["select","eq","in","not","order","range"]){query[method]=(...args:unknown[])=>{database.calls.push({table,method,args});return query}}query.maybeSingle=()=>Promise.resolve(result);query.then=(resolve:(value:Result)=>unknown)=>Promise.resolve(result).then(resolve);return query}}}));
vi.mock("../../utils/cloudinary",()=>({uploadImageWithPublicId:vi.fn(),deleteImageFromCloudinary:vi.fn(),uploadPropertyDocument:vi.fn(),deletePropertyDocument:vi.fn()}));

import { getSellerPropertyManagement, listDrafts, sellerNextAction } from "./marketplace.service";

const seller={data:{persona_type:"SELLER_DEVELOPER",onboarding_status:"COMPLETED"},error:null};
const image={id:"image-1",image_url:"https://example.com/cover.jpg",sort_order:0,is_cover:true};
const base={id:"property-1",owner_id:"seller-1",property_code:"BRL-ONE",title:"Home",price:100000000,marketplace_status:"DRAFT",marketplace_current_step:"PHOTOS_DOCUMENTS",marketplace_submitted_at:null,updated_at:"2026-08-18T12:00:00.000Z",full_address:"12 Private Street",property_images:[image]};
const counts=[{count:4,error:null},{count:1,error:null},{count:1,error:null},{count:1,error:null},{count:1,error:null}];
const seedList=(items:any[],total=items.length)=>database.responses.push(seller,{data:items,error:null,count:total},...counts);

describe("Marketplace Seller property management",()=>{
  beforeEach(()=>{database.responses.length=0;database.calls.length=0});

  it("defaults to ALL and rejects invalid status filters",()=>{
    expect(draftListSchema.parse({})).toEqual({page:1,limit:10,status:"ALL"});
    expect(draftListSchema.safeParse({status:"PENDING"}).success).toBe(false);
    expect(draftListSchema.safeParse({limit:51}).success).toBe(false);
  });

  it("lists only the authenticated Seller with counts, pagination, cover, and deterministic sorting",async()=>{
    seedList([base],11);
    const result=await listDrafts("seller-1",{page:2,limit:5,status:"ALL"});
    expect(result.counts).toEqual({all:4,draft:1,inReview:1,live:1,rejected:1});
    expect(result.pagination).toEqual({page:2,limit:5,total:11,total_pages:3});
    expect(result.items[0]).toMatchObject({id:"property-1",coverImage:{id:"image-1",url:"https://example.com/cover.jpg"},photoCount:1,currentStep:"PHOTOS_DOCUMENTS",nextAction:"CONTINUE_PHOTOS_DOCUMENTS"});
    expect(database.calls).toContainEqual({table:"properties",method:"eq",args:["owner_id","seller-1"]});
    expect(database.calls).toContainEqual({table:"properties",method:"in",args:["marketplace_status",["DRAFT","IN_REVIEW","LIVE","REJECTED"]]});
    expect(database.calls.filter((call)=>call.method==="order").slice(0,2).map((call)=>call.args[0])).toEqual(["updated_at","id"]);
  });

  it.each(["DRAFT","IN_REVIEW","LIVE","REJECTED"] as const)("applies status=%s at database level",async(status)=>{
    seedList([{...base,marketplace_status:status,marketplace_submitted_at:status==="IN_REVIEW"?"2026-08-18T11:00:00.000Z":null}]);
    const result=await listDrafts("seller-1",{page:1,limit:10,status});
    expect(result.items[0].status).toBe(status);
    expect(database.calls).toContainEqual({table:"properties",method:"eq",args:["marketplace_status",status]});
  });

  it("returns null cover for a property with no images",async()=>{
    seedList([{...base,property_images:[]}]);
    await expect(listDrafts("seller-1",{page:1,limit:10,status:"DRAFT"})).resolves.toMatchObject({items:[{coverImage:null,photoCount:0}]});
  });

  it("maps every DRAFT continuation step without inferring progress",()=>{
    expect(sellerNextAction("DRAFT","PROPERTY_INFORMATION")).toBe("CONTINUE_PROPERTY_INFORMATION");
    expect(sellerNextAction("DRAFT","PHOTOS_DOCUMENTS")).toBe("CONTINUE_PHOTOS_DOCUMENTS");
    expect(sellerNextAction("DRAFT","SALES_MANDATE")).toBe("CONTINUE_SALES_MANDATE");
    expect(sellerNextAction("DRAFT","REVIEW")).toBe("CONTINUE_REVIEW");
    expect(sellerNextAction("DRAFT","REVIEW","2026-08-18T14:00:00.000Z")).toBe("EDIT_REJECTED_LISTING");
  });

  it("returns authoritative IN_REVIEW state without an SLA",async()=>{
    seedList([{...base,marketplace_status:"IN_REVIEW",marketplace_submitted_at:"2026-08-18T11:00:00.000Z"}]);
    const item=(await listDrafts("seller-1",{page:1,limit:10,status:"IN_REVIEW"})).items[0];
    expect(item).toMatchObject({submittedAt:"2026-08-18T11:00:00.000Z",reviewProgress:{submitted:true,reviewing:true,live:false},nextAction:"VIEW_REVIEW_STATUS"});
    expect(JSON.stringify(item)).not.toMatch(/expectedReview|SLA|working days/i);
  });

  it("maps authoritative LIVE and REJECTED timestamps and limits feedback to REJECTED",async()=>{
    seedList([{...base,marketplace_status:"LIVE",marketplace_published_at:"2026-08-18T14:00:00.000Z",rejection_reason:"legacy text"},{...base,id:"property-2",marketplace_status:"REJECTED",marketplace_rejected_at:"2026-08-18T15:00:00.000Z",rejection_reason:"Update the title documents"}],2);
    const items=(await listDrafts("seller-1",{page:1,limit:10,status:"ALL"})).items;
    expect(items[0]).toMatchObject({publishedAt:"2026-08-18T14:00:00.000Z",rejectedAt:null,rejectionFeedback:null,nextAction:"VIEW_LIVE_LISTING"});
    expect(items[1]).toMatchObject({publishedAt:null,rejectedAt:"2026-08-18T15:00:00.000Z",rejectionFeedback:"Update the title documents",nextAction:"VIEW_REJECTION"});
  });

  it("returns owner-only management details with safe documents and mandate",async()=>{
    const document={id:"document-1",document_type:"DEED",display_name:"Deed.pdf",mime_type:"application/pdf",size_bytes:1200,created_at:"2026-08-18T10:00:00.000Z"};
    const mandate={marketplace_mandate_type:"OPEN",full_name:"Test Seller",ownership_confirmed:true,mandate_accepted:true,accepted_at:"2026-08-18T09:00:00.000Z",cloudinary_public_id:"must-not-leak"};
    database.responses.push(seller,{data:base,error:null},{data:[document],error:null},{data:mandate,error:null},{data:[],error:null});
    const management=await getSellerPropertyManagement("property-1","seller-1");
    expect(management.property.fullAddress).toBe("12 Private Street");
    expect(management.documents).toEqual([{id:"document-1",documentType:"DEED",displayName:"Deed.pdf",mimeType:"application/pdf",sizeBytes:1200,uploadedAt:"2026-08-18T10:00:00.000Z"}]);
    expect(JSON.stringify(management)).not.toMatch(/cloudinary_public_id|document_url/i);
    expect(database.calls).toContainEqual({table:"properties",method:"eq",args:["owner_id","seller-1"]});
  });

  it("returns preserved Seller-safe rejection context and history without Admin identity",async()=>{
    const rejected={...base,marketplace_status:"REJECTED",marketplace_reviewed_at:"2026-08-18T14:00:00.000Z",marketplace_rejected_at:"2026-08-18T14:00:00.000Z",rejection_reason:"Provide a clearer survey plan"};
    const history={id:"history-1",previous_status:"IN_REVIEW",new_status:"REJECTED",action:"REJECTED",reason:"Provide a clearer survey plan",reviewed_by_admin_id:"must-not-leak",created_at:"2026-08-18T14:00:00.000Z"};
    database.responses.push(seller,{data:rejected,error:null},{data:[],error:null},{data:null,error:null},{data:[history],error:null});
    const management=await getSellerPropertyManagement("property-1","seller-1");
    expect(management.summary).toMatchObject({status:"REJECTED",reviewedAt:rejected.marketplace_reviewed_at,rejectedAt:rejected.marketplace_rejected_at,rejectionReason:rejected.rejection_reason,nextAction:"VIEW_REJECTION"});
    expect(management.property).toMatchObject({rejectionReason:rejected.rejection_reason,rejectedAt:rejected.marketplace_rejected_at,reviewedAt:rejected.marketplace_reviewed_at});
    expect(management.reviewHistory).toEqual([{id:"history-1",previousStatus:"IN_REVIEW",newStatus:"REJECTED",action:"REJECTED",reason:rejected.rejection_reason,createdAt:history.created_at}]);
    expect(JSON.stringify(management)).not.toMatch(/reviewed_by_admin_id|must-not-leak/);
  });

  it("rejects another Seller and Buyer-only customers",async()=>{
    database.responses.push(seller,{data:null,error:null});
    await expect(getSellerPropertyManagement("property-1","seller-2")).rejects.toMatchObject({code:"PROPERTY_NOT_FOUND"});
    database.responses.push({data:null,error:null});
    await expect(getSellerPropertyManagement("property-1","buyer-1")).rejects.toMatchObject({code:"SELLER_PERSONA_REQUIRED"});
  });
});
