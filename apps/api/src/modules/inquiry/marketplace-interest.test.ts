import { beforeEach,describe,expect,it,vi } from "vitest";
import { marketplaceInterestSchema } from "../marketplace/marketplace.validators";

type Result={data:any;error:any};
const database=vi.hoisted(()=>({calls:[] as Array<{table:string;method:string;args:unknown[]}>,queues:{} as Record<string,Result[]>}));

vi.mock("../../config/supabase",()=>({supabaseAdmin:{auth:{getUser:vi.fn()},from:(table:string)=>{const query:Record<string,any>={};for(const method of ["select","eq","insert"]){query[method]=(...args:unknown[])=>{database.calls.push({table,method,args});return query}}const take=()=>Promise.resolve(database.queues[table]?.shift()??{data:null,error:null});query.maybeSingle=take;query.single=take;return query}}}));

import { createMarketplaceInterest } from "./inquiry.service";

const propertyId="550e8400-e29b-41d4-a716-446655440000";
const customerId="customer-a";
const property={id:propertyId,property_code:"BRL-LIVE",title:"Four bedroom duplex",price:250000000,property_type:"DUPLEX",category:"RESIDENTIAL",marketplace_status:"LIVE",full_address:"Private",owner_id:"seller-private"};
const profile={full_name:"Buyer Customer",first_name:"Buyer",last_name:"Customer",email:"buyer@example.com",phone_number:"+2348012345678",is_whatsapp_number:false,whatsapp_number:"+2348098765432"};
const inquiry={id:"inquiry-1",property_id:propertyId,inquiry_type:"MARKETPLACE_INTEREST_WHATSAPP",status:"new",created_at:"2026-08-18T18:00:00.000Z",email:"private",phone_number:"private",message:"private"};

const prepare=(profileOverride:Record<string,unknown>={},inquiryOverride:Record<string,unknown>={})=>{database.queues={properties:[{data:property,error:null}],profiles:[{data:{...profile,...profileOverride},error:null}],inquiries:[{data:{...inquiry,...inquiryOverride},error:null}]}};

describe("Marketplace Buyer interest through canonical inquiries",()=>{
  beforeEach(()=>{database.calls.length=0;prepare()});

  it.each(["WHATSAPP","CALL","EMAIL"] as const)("accepts %s using authenticated profile contacts",async(contactMethod)=>{
    const result=await createMarketplaceInterest(propertyId,customerId,{contactMethod,message:"Please share more details"});
    expect(result).toEqual({inquiryId:"inquiry-1",propertyId,referenceId:"BRL-LIVE",title:"Four bedroom duplex",askingPrice:250000000,preferredContactMethod:contactMethod,submittedAt:"2026-08-18T18:00:00.000Z",nextAction:"KEEP_BROWSING"});
    const inserted=database.calls.find(call=>call.table==="inquiries"&&call.method==="insert")?.args[0] as any;
    expect(inserted).toMatchObject({user_id:customerId,property_id:propertyId,inquiry_type:`MARKETPLACE_INTEREST_${contactMethod}`,status:"new",full_name:"Buyer Customer",email:"buyer@example.com",message:"Please share more details"});
    expect(inserted.phone_number).toBe(contactMethod==="WHATSAPP"?"+2348098765432":"+2348012345678");
    expect(JSON.stringify(result)).not.toMatch(/buyer@example|\+234|seller|full_address|document|mandate|review|message/i);
  });

  it("enforces authoritative LIVE status without legacy publication flags",async()=>{
    await createMarketplaceInterest(propertyId,customerId,{contactMethod:"EMAIL"});
    expect(database.calls).toEqual(expect.arrayContaining([{table:"properties",method:"eq",args:["id",propertyId]},{table:"properties",method:"eq",args:["marketplace_status","LIVE"]}]));
    expect(database.calls.filter(call=>call.table==="properties"&&call.method==="eq").map(call=>call.args[0])).not.toEqual(expect.arrayContaining(["status","is_published","approved_at"]));
  });

  it.each(["DRAFT","IN_REVIEW","REJECTED","LEGACY_APPROVED"])("makes %s unavailable safely",async()=>{
    database.queues.properties=[{data:null,error:null}];
    await expect(createMarketplaceInterest(propertyId,customerId,{contactMethod:"EMAIL"})).rejects.toMatchObject({statusCode:404,code:"PROPERTY_NOT_AVAILABLE",message:"Property is not available"});
    expect(database.calls.some(call=>call.table==="inquiries"&&call.method==="insert")).toBe(false);
  });

  it.each([
    ["WHATSAPP",{whatsapp_number:null,is_whatsapp_number:false}],
    ["CALL",{phone_number:null}],
    ["EMAIL",{email:null}]
  ] as const)("returns a safe error when %s is unavailable",async(contactMethod,profileOverride)=>{
    prepare(profileOverride);
    await expect(createMarketplaceInterest(propertyId,customerId,{contactMethod})).rejects.toMatchObject({statusCode:409,code:"CONTACT_METHOD_UNAVAILABLE",message:"Preferred contact method is unavailable"});
  });

  it("accepts an omitted message and stores an internal non-SLA fallback",async()=>{
    await createMarketplaceInterest(propertyId,customerId,{contactMethod:"CALL"});
    const inserted=database.calls.find(call=>call.table==="inquiries"&&call.method==="insert")?.args[0] as any;
    expect(inserted.message).toBe("Marketplace interest submitted");
  });

  it("validates contact method, trims messages, normalizes blanks, limits size, and rejects client identity fields",()=>{
    expect(marketplaceInterestSchema.parse({contactMethod:"EMAIL",message:"  Details please  "})).toEqual({contactMethod:"EMAIL",message:"Details please"});
    expect(marketplaceInterestSchema.parse({contactMethod:"CALL",message:"   "})).toEqual({contactMethod:"CALL",message:undefined});
    expect(marketplaceInterestSchema.safeParse({contactMethod:"SMS"}).success).toBe(false);
    expect(marketplaceInterestSchema.safeParse({contactMethod:"EMAIL",message:"x".repeat(1001)}).success).toBe(false);
    expect(marketplaceInterestSchema.safeParse({contactMethod:"EMAIL",customerId:"attacker",email:"attacker@example.com"}).success).toBe(false);
  });

  it("allows explicit later inquiry submissions as separate existing-domain rows",async()=>{
    database.queues={properties:[{data:property,error:null},{data:property,error:null}],profiles:[{data:profile,error:null},{data:profile,error:null}],inquiries:[{data:inquiry,error:null},{data:{...inquiry,id:"inquiry-2"},error:null}]};
    const first=await createMarketplaceInterest(propertyId,customerId,{contactMethod:"EMAIL"});
    const second=await createMarketplaceInterest(propertyId,customerId,{contactMethod:"EMAIL"});
    expect([first.inquiryId,second.inquiryId]).toEqual(["inquiry-1","inquiry-2"]);
    expect(database.calls.filter(call=>call.table==="inquiries"&&call.method==="insert")).toHaveLength(2);
  });

  it("returns stable safe persistence errors",async()=>{
    database.queues.properties=[{data:null,error:{message:"private database error"}}];
    await expect(createMarketplaceInterest(propertyId,customerId,{contactMethod:"EMAIL"})).rejects.toMatchObject({statusCode:503,code:"INTEREST_SUBMISSION_FAILED"});
    prepare();database.queues.inquiries=[{data:null,error:{message:"private insert error"}}];
    await expect(createMarketplaceInterest(propertyId,customerId,{contactMethod:"EMAIL"})).rejects.toMatchObject({statusCode:503,code:"INTEREST_SUBMISSION_FAILED",message:"Interest submission is temporarily unavailable"});
  });
});
