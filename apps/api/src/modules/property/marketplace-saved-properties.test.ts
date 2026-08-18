import { beforeEach,describe,expect,it,vi } from "vitest";

type Result={data:any;error:any;count?:number};
const database=vi.hoisted(()=>({calls:[] as Array<{table:string;method:string;args:unknown[]}>,queues:{} as Record<string,Result[]>}));

vi.mock("../../config/supabase",()=>({supabaseAdmin:{from:(table:string)=>{const query:Record<string,any>={};for(const method of ["select","eq","order","insert","update","delete"]){query[method]=(...args:unknown[])=>{database.calls.push({table,method,args});return query}}const take=()=>Promise.resolve(database.queues[table]?.shift()??{data:null,error:null});query.maybeSingle=take;query.single=take;query.range=(...args:unknown[])=>{database.calls.push({table,method:"range",args});return take()};query.then=(resolve:(value:Result)=>unknown,reject:(reason:unknown)=>unknown)=>Promise.resolve({data:null,error:null}).then(resolve,reject);return query}}}));
vi.mock("../../utils/cloudinary",()=>({uploadImageWithPublicId:vi.fn(),deleteImageFromCloudinary:vi.fn()}));

import { getMySavedProperties,saveProperty,unsaveProperty } from "./property.service";

const propertyId="550e8400-e29b-41d4-a716-446655440000";
const live={id:propertyId,saves_count:2,marketplace_status:"LIVE"};
const saved={id:"save-1",property_id:propertyId,user_id:"customer-a",created_at:"2026-08-18T16:00:00.000Z"};

describe("Marketplace compatibility of canonical saved_properties",()=>{
  beforeEach(()=>{database.calls.length=0;database.queues={}});

  it("saves a LIVE canonical property and keeps duplicate saves idempotent",async()=>{
    database.queues={properties:[{data:live,error:null}],saved_properties:[{data:null,error:null},{data:saved,error:null}]};
    await expect(saveProperty(propertyId,"customer-a")).resolves.toEqual(saved);
    expect(database.calls).toContainEqual({table:"saved_properties",method:"insert",args:[{property_id:propertyId,user_id:"customer-a"}]});

    database.calls.length=0;database.queues={properties:[{data:live,error:null}],saved_properties:[{data:saved,error:null}]};
    await expect(saveProperty(propertyId,"customer-a")).resolves.toEqual(saved);
    expect(database.calls.some(call=>call.table==="saved_properties"&&call.method==="insert")).toBe(false);
  });

  it.each(["DRAFT","IN_REVIEW","REJECTED"])("does not newly save a %s Marketplace property",async(status)=>{
    database.queues={properties:[{data:{...live,marketplace_status:status},error:null}]};
    await expect(saveProperty(propertyId,"customer-a")).rejects.toMatchObject({statusCode:404,code:"PROPERTY_NOT_AVAILABLE"});
    expect(database.calls.some(call=>call.table==="saved_properties")).toBe(false);
  });

  it("allows a historical saved row to be removed even after the property is non-LIVE",async()=>{
    database.queues={properties:[{data:{id:propertyId,saves_count:2},error:null}],saved_properties:[{data:{id:"save-1"},error:null}]};
    await expect(unsaveProperty(propertyId,"customer-a")).resolves.toBe(true);
    expect(database.calls).toEqual(expect.arrayContaining([{table:"saved_properties",method:"eq",args:["property_id",propertyId]},{table:"saved_properties",method:"eq",args:["user_id","customer-a"]},{table:"saved_properties",method:"delete",args:[]}]));
  });

  it("returns only explicit Buyer-safe LIVE cards from the saved list",async()=>{
    const rawProperty={id:propertyId,property_code:"BRL-LIVE",title:"Safe title",category:"RESIDENTIAL",property_type:"DUPLEX",public_location:"Lekki",price:100,negotiable:false,bedrooms:4,bathrooms:4,toilets:5,parking_spaces:2,marketplace_status:"LIVE",marketplace_published_at:"2026-08-18T14:00:00.000Z",full_address:"Private",owner_id:"seller",property_documents:[{id:"private"}],property_images:[{id:"image-2",image_url:"second",cloudinary_public_id:"private",sort_order:1,is_cover:false},{id:"image-1",image_url:"cover",cloudinary_public_id:"private",sort_order:0,is_cover:true}]};
    database.queues={saved_properties:[{data:[{id:"save-1",created_at:saved.created_at,property:rawProperty}],error:null,count:1}]};
    const result=await getMySavedProperties("customer-a",{});
    expect(result.saved_properties).toEqual([{id:"save-1",propertyId,savedAt:saved.created_at,property:{id:propertyId,referenceId:"BRL-LIVE",title:"Safe title",askingPrice:100,negotiable:false,propertyType:"DUPLEX",propertyCategory:"RESIDENTIAL",publicLocation:"Lekki",bedrooms:4,bathrooms:4,toilets:5,parkingSpaces:2,coverImage:{id:"image-1",url:"cover"},photoCount:2,verified:true,publishedAt:"2026-08-18T14:00:00.000Z",saved:true}}]);
    expect(JSON.stringify(result)).not.toMatch(/full_address|Private|owner|seller|document|cloudinary|public_id/i);
    expect(database.calls).toContainEqual({table:"saved_properties",method:"eq",args:["property.marketplace_status","LIVE"]});
    const selection=String(database.calls.find(call=>call.table==="saved_properties"&&call.method==="select")?.args[0]);
    expect(selection).not.toMatch(/\*|full_address|owner|profile|document|mandate|review|rejection|cloudinary/i);
  });

  it("omits inconsistent non-LIVE joined records without deleting history",async()=>{
    database.queues={saved_properties:[{data:[{id:"save-1",created_at:saved.created_at,property:{id:propertyId,marketplace_status:"REJECTED"}}],error:null,count:0}]};
    const result=await getMySavedProperties("customer-a",{});
    expect(result.saved_properties).toEqual([]);
    expect(database.calls.some(call=>call.method==="delete")).toBe(false);
  });
});
