import { PGlite } from "@electric-sql/pglite";
import { randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { TestContext } from "node:test";
import { createApp } from "../src/app.js";
import { authConfigSchema } from "../src/auth/config.js";
import { AuthCipher, hashToken } from "../src/auth/crypto.js";
import { AuthError } from "../src/auth/errors.js";
import type { AuthGateway, Customer, StoredSession } from "../src/auth/gateway.js";
import type { PurchasedProperty } from "../src/properties/model.js";
import type { PurchasedPropertiesRepository } from "../src/properties/repository.js";

export async function propertiesFixture(t:TestContext){
  const db=new PGlite();t.after(()=>db.close());
  await db.exec("create schema auth; create table auth.users(id uuid primary key); create role anon; create role authenticated; create role service_role bypassrls;");
  for(const migration of ["202609080001_customer_listings.sql","202609130001_customer_referrals.sql","202609270002_customer_completed_purchases.sql"])
    await db.exec(await readFile(new URL(`../supabase/migrations/${migration}`,import.meta.url),"utf8"));
  const owner=randomUUID(),other=randomUUID(),seller=randomUUID();
  await db.query("insert into auth.users values($1),($2),($3)",[owner,other,seller]);
  const sourceListing=randomUUID();
  await db.query(`insert into public.customer_listings(id,user_id,listing_code,title,description,occupancy_type,ownership_type,property_type,property_subtype,has_lien,bedrooms,bathrooms,parking_spaces,facilities,property_cost_minor,minimum_down_payment_minor,location,state,city,listing_status,listed_at)
    values($1,$2,'RES-SOURCE','Mutable listing','Description','Residential','Personal','Residential','Bungalow',false,3,2,1,'{}',9000000000,100000000,'Test road','Lagos','Ikeja','LISTED',clock_timestamp())`,[sourceListing,seller]);
  const initialPurchaseCount=(await db.query<{count:number}>("select count(*)::integer count from public.customer_completed_purchases")).rows[0]!.count;
  async function insertPurchase(input:{customer?:string;source?:string|null;id?:string;code?:string;title?:string;state?:string;type?:"Residential"|"Commercial";subtype?:string|null;price?:number;closedAt?:string}={}){
    const id=input.id??randomUUID(),type=input.type??"Residential",subtype=input.subtype===undefined?(type==="Residential"?"Bungalow":null):input.subtype;
    await db.query(`insert into public.customer_completed_purchases(id,customer_id,source_listing_id,property_code,title,state,property_type,property_subtype,price_minor,closed_at)
      values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,[id,input.customer??owner,input.source===undefined?sourceListing:input.source,input.code??"RES-CLOSED",input.title??"Purchased Home",input.state??"Lagos",type,subtype,input.price??7654321098,input.closedAt??"2026-09-20T14:30:00Z"]);
    return id;
  }
  async function rpc<T>(name:string,args:unknown[]):Promise<T>{
    try{return(await db.query<{value:T}>(`select public.${name}(${args.map((_,i)=>`$${i+1}`).join(",")}) value`,args)).rows[0]!.value;}
    catch(error){const code=(error as {code?:string}).code;if(["23514","23502","22P02"].includes(code??""))throw new AuthError(400,"INVALID_PROPERTIES_QUERY","Check the purchased-properties query.");throw error;}
  }
  const repository:PurchasedPropertiesRepository={list:(customer,search,page,pageSize)=>rpc<{items:PurchasedProperty[];total:number}>("list_customer_completed_purchases",[customer,search,page,pageSize])};
  const config=authConfigSchema.parse({webOrigin:"http://localhost:3000",apiOrigin:"http://localhost:4000",supabaseUrl:"https://example.supabase.co",anonKey:"test",serviceKey:"test",encryptionKey:randomBytes(32).toString("base64"),cookieSecure:false,production:false});
  const profile:Customer={id:owner,first_name:"Ada",last_name:"Okafor",email:"ada@example.test",phone_number:null,phone_number_normalized:null,country_code:null,account_type:"INVESTOR",profile_type:"PERSONAL",email_verified_at:new Date().toISOString()};
  const raw="properties-test-session",row:StoredSession={token_hash:hashToken(raw),user_id:owner,purpose:"ACCOUNT",refresh_lock:null,expires_at:new Date(Date.now()+3600000).toISOString(),encrypted_tokens:new AuthCipher(config.encryptionKey).seal({userId:owner,accessToken:"test",refreshToken:"test",expiresAt:Date.now()/1000+3600},"provider-tokens")};
  const state={activeUser:owner,verified:true};
  const gateway={readSession:async(hash:string,purpose:string)=>hash===row.token_hash&&purpose===row.purpose&&Date.parse(row.expires_at)>Date.now()?{...row,user_id:state.activeUser}:null,validate:async()=>{},findCustomer:async()=>state.verified?{...profile,id:state.activeUser}:null} as unknown as AuthGateway;
  const server=createApp({webAppUrl:config.webOrigin,auth:config,gateway,purchasedPropertiesRepository:repository}).listen(0,"127.0.0.1");
  await new Promise<void>(resolve=>server.once("listening",resolve));t.after(()=>new Promise<void>(resolve=>{server.close(()=>resolve());server.closeAllConnections();}));
  const address=server.address();if(!address||typeof address==="string")throw new Error("Missing server");
  async function request(suffix="",method="GET",body?:object,cookie=`beryl_account=${raw}`){
    const response=await fetch(`http://127.0.0.1:${address.port}/api/v1/dashboard/properties${suffix}`,{method,headers:{Cookie:cookie,Origin:config.webOrigin,...(body?{"Content-Type":"application/json"}:{})},...(body?{body:JSON.stringify(body)}:{})});
    const payload=response.headers.get("content-type")?.includes("application/json")?await response.json():await response.text();return{response,payload};
  }
  return{db,owner,other,seller,sourceListing,initialPurchaseCount,insertPurchase,repository,request,state,row};
}
