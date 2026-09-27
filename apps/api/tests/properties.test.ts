import assert from "node:assert/strict";
import { test } from "node:test";
import { propertiesFixture } from "./properties.fixture.js";

test("completed purchases migration and read-only API",async t=>{
  const f=await propertiesFixture(t);
  await t.test("migration starts empty and protects tables and RPCs from browser roles",async()=>{
    assert.equal(f.initialPurchaseCount,0,"migration must not invent historical purchases");
    const fk=(await f.db.query<{confdeltype:string}>("select confdeltype from pg_constraint where conrelid='public.customer_completed_purchases'::regclass and confrelid='public.customer_listings'::regclass")).rows[0]!;
    assert.equal(fk.confdeltype,"n","source listing deletion must SET NULL");
    for(const role of ["anon","authenticated"]){await f.db.exec(`set role ${role}`);try{
      await assert.rejects(f.db.query("select * from public.customer_completed_purchases"));
      await assert.rejects(f.db.query("insert into public.customer_completed_purchases(customer_id,property_code,title,state,property_type,property_subtype,price_minor,closed_at) values($1,'RES-NOPE','Nope','Lagos','Residential','Bungalow',1,clock_timestamp())",[f.owner]));
      await assert.rejects(f.db.query("select public.list_customer_completed_purchases($1,'',1,10)",[f.owner]));
    }finally{await f.db.exec("reset role");}}
    await f.db.exec("set role service_role");try{await f.db.query("insert into public.customer_completed_purchases(customer_id,property_code,title,state,property_type,property_subtype,price_minor,closed_at) values($1,'RES-INTERNAL','Internal record','Lagos','Residential','Bungalow',100,clock_timestamp())",[f.owner]);}finally{await f.db.exec("reset role");}
  });

  await t.test("sessions are required and the API exposes only safe exact snapshot fields",async()=>{
    for(const cookie of ["","beryl_account=forged","beryl_recovery=properties-test-session"])assert.equal((await f.request("","GET",undefined,cookie)).response.status,401);
    await f.insertPurchase({code:"RES-SAFE01",title:"Ocean View Home",price:7654321098,closedAt:"2026-09-20T14:30:00Z"});
    const result=await f.request();assert.equal(result.response.status,200);assert.equal(result.response.headers.get("cache-control"),"no-store");
    const item=result.payload.data.items.find((value:{propertyCode:string})=>value.propertyCode==="RES-SAFE01");
    assert.deepEqual(item,{propertyCode:"RES-SAFE01",title:"Ocean View Home",state:"Lagos",propertyType:"Residential",propertySubtype:"Bungalow",priceMinor:7654321098,closedAt:"2026-09-20T14:30:00+00:00"});
    const serialized=JSON.stringify(result.payload);for(const secret of [f.owner,f.other,f.sourceListing,"customer_id","source_listing_id","public_id","property_cost_minor"])assert(!serialized.includes(secret),secret);
  });

  await t.test("owner-scoped title, code and state search is trimmed, literal and cannot leak",async()=>{
    await f.insertPurchase({code:"RES-TITLE1",title:"Maple Court",state:"Lagos",source:null});
    await f.insertPurchase({code:"COM-CODE22",title:"Office Tower",state:"Rivers",type:"Commercial",subtype:null,source:null});
    await f.insertPurchase({customer:f.other,code:"RES-SECRET",title:"Foreign Maple",state:"Kaduna",source:null});
    for(const query of ["maple","com-code22","RIVERS"]){const result=await f.request(`?q=%20${encodeURIComponent(query)}%20`);assert.equal(result.payload.data.total,1,query);}
    assert.equal((await f.request("?q=Foreign")).payload.data.total,0);
    await f.insertPurchase({code:"RES-%_LIT",title:"Literal symbols",source:null});
    assert.equal((await f.request(`?q=${encodeURIComponent("%_")}`)).payload.data.total,1);
  });

  await t.test("pagination is server bounded and ordering is closed_at DESC then id DESC",async()=>{
    for(let i=0;i<12;i++)await f.insertPurchase({id:`00000000-0000-4000-8000-${String(i+1).padStart(12,"0")}`,code:`RES-PAGE${String(i+1).padStart(2,"0")}`,title:`Page record ${i+1}`,source:null,closedAt:i<2?"2026-09-30T10:00:00Z":`2026-09-${String(29-i).padStart(2,"0")}T10:00:00Z`});
    const first=await f.request("?q=Page%20record&page=1"),second=await f.request("?q=Page%20record&page=2");
    assert.deepEqual({page:first.payload.data.page,pageSize:first.payload.data.pageSize,total:first.payload.data.total,totalPages:first.payload.data.totalPages,items:first.payload.data.items.length},{page:1,pageSize:10,total:12,totalPages:2,items:10});
    assert.equal(second.payload.data.items.length,2);assert.deepEqual(first.payload.data.items.slice(0,2).map((item:{propertyCode:string})=>item.propertyCode),["RES-PAGE02","RES-PAGE01"]);
  });

  await t.test("snapshot survives UNLISTED state, source edits and source deletion",async()=>{
    await f.insertPurchase({code:"RES-HISTORY",title:"Historical Title",state:"Lagos",price:5550000000,closedAt:"2026-08-01T09:00:00Z"});
    await f.db.query("update public.customer_listings set listing_status='UNLISTED',title='Changed later',state='Ogun',property_cost_minor=200000000 where id=$1",[f.sourceListing]);
    let item=(await f.request("?q=Historical")).payload.data.items[0];assert.deepEqual([item.title,item.state,item.priceMinor],["Historical Title","Lagos",5550000000]);
    await f.db.query("delete from public.customer_listings where id=$1",[f.sourceListing]);
    item=(await f.request("?q=RES-HISTORY")).payload.data.items[0];assert.equal(item.propertyCode,"RES-HISTORY");
    const stored=(await f.db.query<{source_listing_id:string|null}>("select source_listing_id from public.customer_completed_purchases where property_code='RES-HISTORY'")).rows[0]!;assert.equal(stored.source_listing_id,null);
  });

  await t.test("GET/search has no business side effects and no customer write endpoint exists",async()=>{
    await f.insertPurchase({code:"RES-READONLY",source:null});
    const before={purchases:(await f.db.query<{count:number}>("select count(*)::integer count from public.customer_completed_purchases")).rows[0]!.count,referrals:(await f.db.query<{count:number}>("select count(*)::integer count from public.customer_referral_links")).rows[0]!.count,listings:(await f.db.query<{value:string}>("select listing_status value from public.customer_listings limit 1")).rows[0]?.value};
    assert.equal((await f.request("?q=READONLY")).response.status,200);
    for(const method of ["POST","PATCH","DELETE"])assert.equal((await f.request("",method,{propertyCode:"RES-READONLY"})).response.status,404);
    const after={purchases:(await f.db.query<{count:number}>("select count(*)::integer count from public.customer_completed_purchases")).rows[0]!.count,referrals:(await f.db.query<{count:number}>("select count(*)::integer count from public.customer_referral_links")).rows[0]!.count,listings:(await f.db.query<{value:string}>("select listing_status value from public.customer_listings limit 1")).rows[0]?.value};assert.deepEqual(after,before);
  });

  await t.test("malformed, duplicate and owner-selector queries are rejected",async()=>{
    for(const suffix of ["?page=0","?page=1.5","?page=1&page=2","?q=a&q=b",`?q=${"x".repeat(101)}`,"?customer_id=other","?userId=other"])assert.equal((await f.request(suffix)).response.status,400,suffix);
  });
});
