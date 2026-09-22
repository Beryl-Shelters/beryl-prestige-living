import { PGlite } from "@electric-sql/pglite";
import { randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { TestContext } from "node:test";
import { createApp } from "../src/app.js";
import { authConfigSchema } from "../src/auth/config.js";
import { AuthCipher, hashToken } from "../src/auth/crypto.js";
import { AuthError } from "../src/auth/errors.js";
import type { AuthGateway, Customer, StoredSession } from "../src/auth/gateway.js";
import type { CreatedReferral, ReferralPage } from "../src/referrals/model.js";
import type { ReferralsRepository } from "../src/referrals/repository.js";

export async function referralsFixture(t:TestContext){
  const db=new PGlite();t.after(()=>db.close());
  await db.exec("create schema auth; create table auth.users(id uuid primary key); create role anon; create role authenticated; create role service_role;");
  for(const migration of ["202609080001_customer_listings.sql","202609100001_short_display_codes.sql","202609130001_customer_referrals.sql","202609180001_public_property_referrals.sql"])
    await db.exec(await readFile(new URL(`../supabase/migrations/${migration}`,import.meta.url),"utf8"));
  const owner=randomUUID(),other=randomUUID();await db.query("insert into auth.users values($1),($2)",[owner,other]);
  const listing=randomUUID(),foreignListing=randomUUID();
  const insert=`insert into public.customer_listings(id,user_id,title,description,occupancy_type,ownership_type,property_type,property_subtype,has_lien,bedrooms,bathrooms,parking_spaces,property_cost_minor,minimum_down_payment_minor,location,state,city) values($1,$2,'Test property','Safe description','Residential','Personal','Residential','Bungalow',false,3,3,1,10000000,1000000,'Test road','Lagos','Ikeja')`;
  await db.query(insert,[listing,owner]);await db.query(insert,[foreignListing,other]);
  async function rpc<T>(name:string,args:unknown[]):Promise<T>{try{return (await db.query<{value:T}>(`select public.${name}(${args.map((_,index)=>`$${index+1}`).join(",")}) as value`,args)).rows[0]!.value;}catch(error){const code=(error as {code?:string}).code;if(code==="P0002")throw new AuthError(404,"LISTING_NOT_FOUND","Listing not found.");if(["23514","23502","22P02"].includes(code??""))throw new AuthError(400,"INVALID_REFERRAL","Check the referral details.");throw error;}}
  const repository:ReferralsRepository={list:(id,page,size)=>rpc<Omit<ReferralPage,"program">>("list_customer_referrals",[id,page,size]),create:(id,type,listingId)=>rpc<Omit<CreatedReferral,"referralUrl">>("create_customer_referral_link",[id,type,listingId]),createPublicProperty:(id,code)=>rpc<Omit<CreatedReferral,"referralUrl">>("create_listed_property_referral_link",[id,code])};
  const config=authConfigSchema.parse({webOrigin:"http://localhost:3000",apiOrigin:"http://localhost:4000",supabaseUrl:"https://example.supabase.co",anonKey:"test",serviceKey:"test",encryptionKey:randomBytes(32).toString("base64"),cookieSecure:false,production:false});
  const profile:Customer={id:owner,first_name:"Ada",last_name:"Okafor",email:"ada@example.test",phone_number:null,phone_number_normalized:null,country_code:null,account_type:"INVESTOR",profile_type:"PERSONAL",email_verified_at:new Date().toISOString()};
  const raw="referrals-test-session",row:StoredSession={token_hash:hashToken(raw),user_id:owner,purpose:"ACCOUNT",refresh_lock:null,expires_at:new Date(Date.now()+3600000).toISOString(),encrypted_tokens:new AuthCipher(config.encryptionKey).seal({userId:owner,accessToken:"test",refreshToken:"test",expiresAt:Date.now()/1000+3600},"provider-tokens")};
  const state={invalid:false,activeUser:owner};const gateway={readSession:async(hash:string,purpose:string)=>hash===row.token_hash&&purpose===row.purpose&&Date.parse(row.expires_at)>Date.now()?{...row,user_id:state.activeUser}:null,validate:async()=>{if(state.invalid)throw new Error("invalid provider session");},findCustomer:async()=>({...profile,id:state.activeUser})} as unknown as AuthGateway;
  const server=createApp({webAppUrl:config.webOrigin,auth:config,gateway,referralsRepository:repository}).listen(0,"127.0.0.1");await new Promise<void>(resolve=>server.once("listening",resolve));
  t.after(()=>new Promise<void>(resolve=>{server.close(()=>resolve());server.closeAllConnections();}));const address=server.address();if(!address||typeof address==="string")throw new Error("Missing server");
  async function request(path="",method="GET",body?:object,cookie=`beryl_account=${raw}`,headers:Record<string,string>={}){const response=await fetch(`http://127.0.0.1:${address.port}/api/v1/dashboard/referrals${path}`,{method,headers:{Cookie:cookie,Origin:config.webOrigin,...(body?{"Content-Type":"application/json"}:{}),...headers},...(body?{body:JSON.stringify(body)}:{})});return {response,payload:await response.json()};}
  return {db,owner,other,listing,foreignListing,repository,request,row,profile,state,raw};
}
