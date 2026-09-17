import assert from "node:assert/strict";
import { test } from "node:test";
import { randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { createApp } from "../src/app.js";
import { authConfigSchema } from "../src/auth/config.js";
import type { PublicAnalytics, PublicAnalyticsRepository } from "../src/public-analytics/repository.js";

const config=authConfigSchema.parse({webOrigin:"http://localhost:3000",apiOrigin:"http://localhost:4000",supabaseUrl:"https://example.supabase.co",anonKey:"test",serviceKey:"test",encryptionKey:randomBytes(32).toString("base64"),cookieSecure:false,production:false});
const empty:PublicAnalytics={period:"monthly",priceSeries:Array.from({length:12},(_,month)=>({label:["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"][month]!,valueMinor:null})),propertyPercentage:{totalListedProperties:0,residentialListedProperties:0,residentialPercentage:0},searchesPerDay:[]};

test("public aggregate routes need no session, validate input, hide failures and rate-limit search insertion",async t=>{
  let inserts=0;const periods:string[]=[];let failed=false;
  const repository:PublicAnalyticsRepository={async read(period){periods.push(period);if(failed)throw new Error("private database detail");return {...empty,period};},async recordSearch(){inserts++;}};
  const server=createApp({webAppUrl:config.webOrigin,auth:config,publicAnalyticsRepository:repository}).listen(0,"127.0.0.1");
  await new Promise<void>(resolve=>server.once("listening",resolve));t.after(()=>new Promise<void>(resolve=>{server.close(()=>resolve());server.closeAllConnections();}));
  const address=server.address();assert(address&&typeof address!=="string");const base=`http://127.0.0.1:${address.port}/api/v1/public`;
  const request=(path:string,method="GET",origin=config.webOrigin,body?:string)=>fetch(base+path,{method,headers:{Origin:origin,...(body!==undefined?{"Content-Type":"application/json"}:{})},...(body!==undefined?{body}:{})});
  for(const path of ["/analytics","/analytics?period=monthly","/analytics?period=annually"]){const response=await request(path);assert.equal(response.status,200);assert.equal(response.headers.get("cache-control"),"no-store");assert.deepEqual(Object.keys((await response.json()).data).sort(),["period","priceSeries","propertyPercentage","searchesPerDay"].sort());}
  assert.deepEqual(periods,["monthly","monthly","annually"]);
  for(const path of ["/analytics?period=weekly","/analytics?period=monthly&period=annually","/analytics?owner=secret","/analytics?period[]=monthly"]){assert.equal((await request(path)).status,400,path);}
  failed=true;const unavailable=await request("/analytics");assert.equal(unavailable.status,503);assert(!JSON.stringify(await unavailable.json()).includes("private database"));
  assert.equal((await request("/property-searches","POST",config.webOrigin,"{}")).status,201);assert.equal(inserts,1);
  assert.equal((await request("/property-searches","POST","https://attacker.example","{}")).status,403);
  assert.equal((await request("/property-searches","POST",config.webOrigin,'{"email":"private"}')).status,400);
  assert.equal((await request("/property-searches?fake=1","POST",config.webOrigin,"{}")).status,400);
  assert.equal(inserts,1);
  let limited=false;for(let i=0;i<12;i++){const response=await request("/property-searches","POST",config.webOrigin,"{}");if(response.status===429){limited=true;break;}}assert(limited);assert(inserts<=10);
});

test("SQL aggregates only currently LISTED properties using exact minor units and UTC publication dates",async t=>{
  const db=new PGlite();t.after(()=>db.close());
  await db.exec("create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key); create table public.customer_listings(id uuid primary key, user_id uuid not null, listing_status text not null, property_type text not null, property_cost_minor bigint not null, listed_at timestamptz);");
  const owner=randomUUID(),other=randomUUID();
  const now=new Date();const year=now.getUTCFullYear();const month=now.getUTCMonth();
  const day=new Date(Date.UTC(year,month,1,12)).toISOString();const prior=new Date(Date.UTC(year-1,5,1,12)).toISOString();
  const add=async(status:string,type:string,minor:string,date:string,user=owner)=>db.query("insert into public.customer_listings values($1,$2,$3,$4,$5,$6)",[randomUUID(),user,status,type,minor,date]);
  const legacyNull=randomUUID();await db.query("insert into public.customer_listings values($1,$2,'LISTED','Residential',10000000000,null)",[legacyNull,owner]);
  await add("LISTED","Residential","70000000000",prior);
  await db.exec(await readFile(new URL("../supabase/migrations/202609160001_public_analytics.sql",import.meta.url),"utf8"));
  const read=async(period:string)=>{const result=await db.query<{data:PublicAnalytics}>("select public.read_public_property_analytics($1) as data",[period]);return result.rows[0]!.data;};
  let monthly=await read("monthly");assert.equal(monthly.propertyPercentage.totalListedProperties,2);assert.equal(monthly.propertyPercentage.residentialPercentage,100);assert.equal(monthly.priceSeries.length,12);assert(monthly.priceSeries.every(item=>item.valueMinor===null));assert.equal(monthly.searchesPerDay.length,7);assert(monthly.searchesPerDay.every(item=>item.count===0));
  assert.equal((await db.query<{listed_at:string|null}>("select listed_at from public.customer_listings where id=$1",[legacyNull])).rows[0]?.listed_at,null,"migration must not backfill unknown publication time");
  await add("LISTED","Residential","25000000001",day);await add("LISTED","Commercial","25000000002",day,other);
  for(const status of ["UNLISTED","PENDING","REJECTED"])await add(status,"Residential","999999999999",day);
  monthly=await read("monthly");assert.equal(monthly.propertyPercentage.totalListedProperties,4);assert.equal(monthly.propertyPercentage.residentialListedProperties,3);assert.equal(monthly.propertyPercentage.residentialPercentage,75);
  assert.equal(monthly.priceSeries[month]?.valueMinor,25000000002);assert.equal(monthly.priceSeries.filter(item=>item.valueMinor!==null).length,1);
  const annual=await read("annually");assert.deepEqual(annual.priceSeries,[{label:String(year-1),valueMinor:70000000000},{label:String(year),valueMinor:25000000002}]);
  assert(!JSON.stringify(monthly).includes(owner));assert(!JSON.stringify(monthly).includes(other));
  await assert.rejects(()=>read("weekly"));
  const columns=await db.query<{column_name:string}>("select column_name from information_schema.columns where table_name='public_property_search_events'");assert.deepEqual(columns.rows.map(row=>row.column_name).sort(),["id","occurred_at"]);
  const access=await db.query<{anonymous_table:boolean;authenticated_table:boolean;anonymous_function:boolean}>("select has_table_privilege('anon','public.public_property_search_events','SELECT') as anonymous_table,has_table_privilege('authenticated','public.public_property_search_events','INSERT') as authenticated_table,has_function_privilege('anon','public.read_public_property_analytics(text)','EXECUTE') as anonymous_function");assert.deepEqual(access.rows[0],{anonymous_table:false,authenticated_table:false,anonymous_function:false});
  const sequences=await db.query<{anon:boolean;authenticated:boolean;service:boolean}>("select has_sequence_privilege('anon','public.public_property_search_events_id_seq','USAGE') as anon,has_sequence_privilege('authenticated','public.public_property_search_events_id_seq','SELECT') as authenticated,has_sequence_privilege('service_role','public.public_property_search_events_id_seq','USAGE') as service");assert.deepEqual(sequences.rows[0],{anon:false,authenticated:false,service:false});
  await db.exec("set role service_role; insert into public.public_property_search_events default values; reset role");
  await db.exec("insert into public.public_property_search_events default values");
  const after=await read("monthly");assert.equal(after.searchesPerDay.at(-1)?.count,2);assert(after.searchesPerDay.slice(0,-1).every(item=>item.count===0));
});

test("publication trigger preserves history, stamps authorized publication and republishing, and never backfills legacy dates",async t=>{
  const db=new PGlite();t.after(()=>db.close());
  await db.exec("create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table public.customer_listings(id uuid primary key,user_id uuid not null,listing_status text not null,property_type text not null,property_cost_minor bigint not null,listed_at timestamptz);");
  const owner=randomUUID(),legacy=randomUUID(),pending=randomUUID();
  await db.query("insert into public.customer_listings values($1,$2,'LISTED','Residential',100,null),($3,$2,'PENDING','Residential',100,null)",[legacy,owner,pending]);
  await db.exec(await readFile(new URL("../supabase/migrations/202609160001_public_analytics.sql",import.meta.url),"utf8"));
  const timestamp=async(id:string)=>(await db.query<{listed_at:string|null}>("select listed_at from public.customer_listings where id=$1",[id])).rows[0]!.listed_at;
  assert.equal(await timestamp(legacy),null);
  await db.query("update public.customer_listings set listing_status='LISTED',listed_at='2001-01-01' where id=$1",[pending]);
  const first=await timestamp(pending);assert(first&&Date.parse(first)>Date.now()-60000);
  await db.query("update public.customer_listings set property_cost_minor=200 where id=$1",[pending]);assert.deepEqual(await timestamp(pending),first);
  await db.query("update public.customer_listings set listed_at='2002-01-01' where id=$1",[pending]);assert.deepEqual(await timestamp(pending),first);
  await db.query("update public.customer_listings set listing_status='UNLISTED',listed_at=null where id=$1",[pending]);assert.deepEqual(await timestamp(pending),first);
  await db.exec("select pg_sleep(0.01)");await db.query("update public.customer_listings set listing_status='LISTED' where id=$1",[pending]);
  const republished=await timestamp(pending);assert(republished&&Date.parse(republished)>=Date.parse(first));assert.notEqual(republished,first);
  await db.query("update public.customer_listings set listed_at='2000-01-01' where id=$1",[legacy]);assert.equal(await timestamp(legacy),null);
  const publishedOnInsert=randomUUID();await db.query("insert into public.customer_listings values($1,$2,'LISTED','Residential',100,'2000-01-01')",[publishedOnInsert,owner]);assert(Date.parse((await timestamp(publishedOnInsert))!)>Date.now()-60000);
});

test("empty inventory, maximum safe kobo averages, and UTC day boundaries remain exact",async t=>{
  const db=new PGlite();t.after(()=>db.close());
  await db.exec("create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table public.customer_listings(id uuid primary key,user_id uuid not null,listing_status text not null,property_type text not null,property_cost_minor bigint not null,listed_at timestamptz);");
  await db.exec(await readFile(new URL("../supabase/migrations/202609160001_public_analytics.sql",import.meta.url),"utf8"));
  const read=async()=>{const result=await db.query<{data:PublicAnalytics}>("select public.read_public_property_analytics('monthly') as data");return result.rows[0]!.data;};
  const zero=await read();assert.equal(zero.propertyPercentage.residentialPercentage,0);assert(zero.priceSeries.every(item=>item.valueMinor===null));assert(zero.searchesPerDay.every(item=>item.count===0));
  const owner=randomUUID();for(const amount of ["999999999999998","999999999999999"]){await db.query("insert into public.customer_listings values($1,$2,'LISTED','Residential',$3,null)",[randomUUID(),owner,amount]);}
  const prices=await read();const value=prices.priceSeries[new Date().getUTCMonth()]?.valueMinor;assert.equal(value,999999999999999);assert(Number.isSafeInteger(value));
  const midnight=new Date();midnight.setUTCHours(0,0,0,0);
  await db.query("insert into public.public_property_search_events(occurred_at) values($1),($2)",[new Date(midnight.getTime()-1000).toISOString(),midnight.toISOString()]);
  const days=(await read()).searchesPerDay;assert.equal(days.at(-2)?.count,1);assert.equal(days.at(-1)?.count,1);assert(days.slice(0,-2).every(day=>day.count===0));
});
