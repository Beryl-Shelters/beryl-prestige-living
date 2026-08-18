import { beforeEach,describe,expect,it,vi } from "vitest";

type Result={data:any;error:any};
const database=vi.hoisted(()=>({calls:[] as Array<{table:string;method:string;args:unknown[]}>,queues:{} as Record<string,Result[]>}));

vi.mock("../../config/supabase",()=>({supabaseAdmin:{from:(table:string)=>{const query:Record<string,any>={};for(const method of ["select","eq"]){query[method]=(...args:unknown[])=>{database.calls.push({table,method,args});return query}}query.maybeSingle=()=>{database.calls.push({table,method:"maybeSingle",args:[]});return Promise.resolve(database.queues[table]?.shift()??{data:null,error:null})};return query}}}));
vi.mock("../../utils/cloudinary",()=>({uploadImageWithPublicId:vi.fn(),deleteImageFromCloudinary:vi.fn(),uploadPropertyDocument:vi.fn(),deletePropertyDocument:vi.fn()}));

import { getPublicMarketplaceProperty } from "./marketplace.service";

const liveProperty={id:"550e8400-e29b-41d4-a716-446655440000",property_code:"BRL-LIVE",title:"Four bedroom duplex",description:"A safe public description",category:"RESIDENTIAL",property_type:"DUPLEX",public_location:"Lekki, Lagos",price:250000000,negotiable:true,initial_deposit_type:"PERCENTAGE",initial_deposit_value:20,property_condition:"NEWLY_BUILT",furnishing:"SEMI_FURNISHED",bedrooms:4,bathrooms:4,toilets:5,parking_spaces:3,number_of_floors:2,parking_capacity:3,amenities:["Pool","  Security  ","pool",""],marketplace_status:"LIVE",marketplace_published_at:"2026-08-18T14:00:00.000Z",full_address:"12 Private Street",owner_id:"private-seller",rejection_reason:"private review",marketplace_reviewed_by_admin_id:"private-admin",property_documents:[{cloudinary_public_id:"private-document"}],mandates:[{full_name:"Private Seller",commission_amount:1}],property_images:[{id:"image-2",image_url:"https://example.com/second.jpg",cloudinary_public_id:"private-image",sort_order:1,is_cover:false},{id:"image-1",image_url:"https://example.com/cover.jpg",cloudinary_public_id:"private-cover",sort_order:0,is_cover:true},{id:"image-2",image_url:"https://example.com/duplicate.jpg",sort_order:4,is_cover:false}]};

describe("public Marketplace property detail",()=>{
  beforeEach(()=>{database.calls.length=0;database.queues={properties:[{data:liveProperty,error:null}],saved_properties:[]}});

  it("returns an anonymous LIVE Buyer-safe detail with saved=false",async()=>{
    const result=await getPublicMarketplaceProperty(liveProperty.id);
    expect(result).toEqual({id:liveProperty.id,referenceId:"BRL-LIVE",title:"Four bedroom duplex",description:"A safe public description",askingPrice:250000000,negotiable:true,propertyType:"DUPLEX",propertyCategory:"RESIDENTIAL",publicLocation:"Lekki, Lagos",bedrooms:4,bathrooms:4,toilets:5,parkingSpaces:3,numberOfFloors:2,parkingCapacity:3,condition:"NEWLY_BUILT",furnishing:"SEMI_FURNISHED",initialDeposit:{type:"PERCENTAGE",value:20},amenities:["Pool","Security"],images:[{id:"image-1",url:"https://example.com/cover.jpg",order:0,isCover:true},{id:"image-2",url:"https://example.com/second.jpg",order:1,isCover:false}],photoCount:2,verified:true,publishedAt:"2026-08-18T14:00:00.000Z",saved:false});
    expect(database.calls.some(call=>call.table==="saved_properties")).toBe(false);
    expect(JSON.stringify(result)).not.toMatch(/full_address|Private Street|owner|seller|email|phone|document|mandate|commission|review|rejection|admin|cloudinary|public_id/i);
  });

  it("enforces authoritative LIVE status at database level",async()=>{
    await getPublicMarketplaceProperty(liveProperty.id);
    expect(database.calls).toEqual(expect.arrayContaining([{table:"properties",method:"eq",args:["id",liveProperty.id]},{table:"properties",method:"eq",args:["marketplace_status","LIVE"]}]));
    expect(database.calls.filter(call=>call.method==="eq").map(call=>call.args[0])).not.toEqual(expect.arrayContaining(["status","is_published","approved_at"]));
  });

  it.each(["DRAFT","IN_REVIEW","REJECTED","LEGACY_APPROVED"])("makes %s unavailable without revealing lifecycle",async()=>{
    database.queues.properties=[{data:null,error:null}];
    await expect(getPublicMarketplaceProperty(liveProperty.id)).rejects.toMatchObject({statusCode:404,code:"MARKETPLACE_PROPERTY_NOT_FOUND",message:"Marketplace property not found"});
  });

  it("returns an empty gallery and null deposit safely",async()=>{
    database.queues.properties=[{data:{...liveProperty,property_images:[],initial_deposit_type:null,initial_deposit_value:null,amenities:null},error:null}];
    await expect(getPublicMarketplaceProperty(liveProperty.id)).resolves.toMatchObject({images:[],photoCount:0,initialDeposit:null,amenities:[]});
  });

  it("returns saved=false for an authenticated customer without a matching row",async()=>{
    database.queues.saved_properties=[{data:null,error:null}];
    const result=await getPublicMarketplaceProperty(liveProperty.id,"customer-a");
    expect(result.saved).toBe(false);
    expect(database.calls).toEqual(expect.arrayContaining([{table:"saved_properties",method:"eq",args:["property_id",liveProperty.id]},{table:"saved_properties",method:"eq",args:["user_id","customer-a"]}]));
  });

  it("returns saved=true only for the requesting customer's canonical save",async()=>{
    database.queues.saved_properties=[{data:{id:"save-a"},error:null}];
    await expect(getPublicMarketplaceProperty(liveProperty.id,"customer-a")).resolves.toMatchObject({saved:true});
    expect(database.calls.find(call=>call.table==="saved_properties"&&call.args[0]==="user_id")?.args[1]).toBe("customer-a");
  });

  it("returns stable safe persistence errors",async()=>{
    database.queues.properties=[{data:null,error:{message:"private database detail"}}];
    await expect(getPublicMarketplaceProperty(liveProperty.id)).rejects.toMatchObject({statusCode:503,code:"MARKETPLACE_UNAVAILABLE",message:"Marketplace is temporarily unavailable"});
    database.queues.properties=[{data:liveProperty,error:null}];database.queues.saved_properties=[{data:null,error:{message:"private saved error"}}];
    await expect(getPublicMarketplaceProperty(liveProperty.id,"customer-a")).rejects.toMatchObject({statusCode:503,code:"SAVED_PROPERTY_UNAVAILABLE",message:"Saved property state is temporarily unavailable"});
  });
});
