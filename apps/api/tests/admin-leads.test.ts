import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test, type TestContext } from "node:test";
import { PGlite } from "@electric-sql/pglite";

import { createApp } from "../src/app.js";
import { adminConfigSchema } from "../src/admin/config.js";
import type { AdminInvitationEmail } from "../src/admin/email.js";
import type { AdminIdentity } from "../src/admin/identity.js";
import type { AdminLeadDetail, AdminLeadDirectoryPage, AdminLeadQuery } from "../src/admin/leads-model.js";
import type { AdminLeadsRepository } from "../src/admin/leads-repository.js";
import type { AdminProfile, AdminRepository, InvitationClaim, InvitationPreview, InvitationRecord, StoredAdminSession } from "../src/admin/repository.js";
import { authConfigSchema } from "../src/auth/config.js";
import { unavailable } from "../src/auth/errors.js";
import type { ProviderTokens } from "../src/auth/gateway.js";
import type { MediaStorage } from "../src/listings/media.js";
import type { MediaAsset } from "../src/listings/model.js";

const auth=authConfigSchema.parse({webOrigin:"http://localhost:3000",apiOrigin:"http://localhost:4000",supabaseUrl:"https://example.supabase.co",anonKey:"anon",serviceKey:"service",encryptionKey:randomBytes(32).toString("base64"),cookieSecure:false,production:false,rateLimit:100});
const adminConfig=adminConfigSchema.parse({appOrigin:"http://localhost:3001",resendApiKey:"test",inviteFrom:"Beryl <admin@example.test>",inviteSeconds:172800,production:false});
const adminId="11111111-1111-4111-8111-111111111111",inactiveId="22222222-2222-4222-8222-222222222222";

class Sessions implements AdminRepository {
  profiles=new Map<string,AdminProfile>([[adminId,{userId:adminId,fullName:"Lead Admin",email:"admin@example.test",phone:"+2348011111111",department:"MANAGEMENT",role:"ADMIN",active:true}],[inactiveId,{userId:inactiveId,fullName:"Inactive Admin",email:"inactive@example.test",phone:"+2348022222222",department:"TECH",role:"ADMIN",active:false}]]);
  sessions=new Map<string,StoredAdminSession>();
  profile(id:string){return Promise.resolve(this.profiles.get(id)??null);} reserve():Promise<InvitationRecord>{throw unavailable();} provisionIdentity():Promise<string>{throw unavailable();}
  attach():Promise<void>{throw unavailable();} preview():Promise<InvitationPreview>{throw unavailable();} claim():Promise<InvitationClaim>{throw unavailable();} release():Promise<void>{throw unavailable();} accept():Promise<AdminProfile>{throw unavailable();}
  async createSession(hash:string,userId:string,tokens:string,seconds:number){this.sessions.set(hash,{token_hash:hash,user_id:userId,encrypted_tokens:tokens,expires_at:new Date(Date.now()+seconds*1000).toISOString(),refresh_lock:null});}
  readSession(hash:string){return Promise.resolve(this.sessions.get(hash)??null);} async claimRefresh(hash:string,lock:string){const row=this.sessions.get(hash);if(row)row.refresh_lock=lock;return row??null;}
  async finishRefresh(hash:string,lock:string,tokens:string){const row=this.sessions.get(hash);if(!row||row.refresh_lock!==lock)return false;row.encrypted_tokens=tokens;row.refresh_lock=null;return true;}
  async deleteSession(hash:string){this.sessions.delete(hash);} async deleteUserSessions(id:string){for(const [key,row] of this.sessions)if(row.user_id===id)this.sessions.delete(key);}
}
class Identity implements AdminIdentity {
  loginUser=adminId; createPending():Promise<string>{throw unavailable();} deletePending():Promise<void>{throw unavailable();} activate():Promise<void>{throw unavailable();}
  login(){return Promise.resolve(this.tokens(this.loginUser));} validate(){return Promise.resolve();} refresh(tokens:ProviderTokens){return Promise.resolve(tokens);} signOut(){return Promise.resolve();}
  tokens(userId:string):ProviderTokens{return{userId,accessToken:"access",refreshToken:"refresh",expiresAt:Date.now()/1000+3600};}
}
const directory:AdminLeadDirectoryPage={counts:{new:1,contacted:1,won:0,lost:0},items:[{publicId:"ENQ-ABC234",stage:"NEW",version:1,sourceType:"REAL_ESTATE_INQUIRY",requesterName:"Ada Buyer",propertyInterest:null,receivedAt:"2026-09-28T09:00:00Z"}],page:1,pageSize:40,total:1,allTotal:2,totalPages:1};
const detail:AdminLeadDetail={publicId:"ENQ-ABC234",stage:"NEW",version:1,sourceType:"REAL_ESTATE_INQUIRY",receivedAt:"2026-09-28T09:00:00Z",requester:{name:"Ada Buyer",email:"ada@example.test",phone:"+2348033333333",preferredContact:null,accountLinked:false,customerId:null,accountType:null,profileType:null,kycStatus:null},message:"I want to buy a home.",request:{inquiryType:"Buying a Property",sourcePage:"buy"},property:null,referral:null,history:[]};
class Leads implements AdminLeadsRepository {
  queries:AdminLeadQuery[]=[];moves:{publicId:string;adminId:string;stage:string;version:number}[]=[];
  directory(query:AdminLeadQuery){this.queries.push(query);return Promise.resolve(directory);} detail(){return Promise.resolve(detail);}
  async move(publicId:string,adminId:string,stage:"CONTACTED"|"WON"|"LOST",version:number){this.moves.push({publicId,adminId,stage,version});}
}
class Storage implements MediaStorage {upload():Promise<MediaAsset>{throw unavailable();} remove(){return Promise.resolve();} download():Promise<Uint8Array>{throw unavailable();}}
const email:AdminInvitationEmail={send(){throw unavailable();}};

async function fixture(t:TestContext){const repository=new Sessions(),identity=new Identity(),leads=new Leads();const server=createApp({webAppUrl:auth.webOrigin,auth,admin:adminConfig,adminRepository:repository,adminLeadsRepository:leads,adminIdentity:identity,adminEmail:email,mediaStorage:new Storage()}).listen(0,"127.0.0.1");await new Promise<void>(resolve=>server.once("listening",resolve));t.after(()=>new Promise<void>(resolve=>{server.close(()=>resolve());server.closeAllConnections();}));const address=server.address();assert(address&&typeof address!=="string");const jar=new Map<string,string>();async function request(path:string,body?:unknown){const response=await fetch(`http://127.0.0.1:${address.port}/api/v1/admin${path}`,{method:body===undefined?"GET":"POST",headers:{Origin:adminConfig.appOrigin,"Content-Type":"application/json",Cookie:[...jar].map(([key,value])=>`${key}=${value}`).join("; ")},...(body===undefined?{}:{body:JSON.stringify(body)})});for(const cookie of response.headers.getSetCookie()){const [pair]=cookie.split(";");const index=pair!.indexOf("=");const key=pair!.slice(0,index),value=pair!.slice(index+1);if(value)jar.set(key,value);else jar.delete(key);}return response;}async function login(id:string){identity.loginUser=id;return request("/auth/login",{email:"admin@example.test",password:"Controlled!9"});}return{leads,request,login};}

test("Lead endpoints reject unauthenticated and inactive Admin access",async t=>{const f=await fixture(t);assert.equal((await f.request("/leads")).status,401);assert.equal((await f.login(inactiveId)).status,401);assert.equal(f.leads.queries.length,0);});
test("Lead directory validates server search and pagination",async t=>{const f=await fixture(t);await f.login(adminId);assert.equal((await f.request("/leads?search=Ada&page=2&pageSize=20")).status,200);assert.deepEqual(f.leads.queries[0],{search:"Ada",page:2,pageSize:20});for(const path of ["/leads?page=0","/leads?pageSize=101","/leads?unexpected=true"])assert.equal((await f.request(path)).status,400);});
test("Lead detail and transitions derive acting Admin from the session",async t=>{const f=await fixture(t);await f.login(adminId);assert.equal((await f.request("/leads/ENQ-ABC234")).status,200);assert.equal((await f.request("/leads/ENQ-ABC234/stage",{stage:"CONTACTED",version:1})).status,200);assert.deepEqual(f.leads.moves,[{publicId:"ENQ-ABC234",adminId,stage:"CONTACTED",version:1}]);assert.equal((await f.request("/leads/ENQ-ABC234/stage",{stage:"NEW",version:1})).status,400);});

test("Lead migration normalizes buyer sources and keeps WON isolated from purchases, referrals and listings",async t=>{
  const db=new PGlite();t.after(()=>db.close());
  const owner="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",reviewer="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",listing="cccccccc-cccc-4ccc-8ccc-cccccccccccc",pendingBuy="dddddddd-dddd-4ddd-8ddd-dddddddddddd";
  await db.exec("create schema auth; create function auth.uid() returns uuid language sql stable as 'select null::uuid'; create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_app_meta_data jsonb default '{}',raw_user_meta_data jsonb default '{}'); create role anon; create role authenticated; create role service_role bypassrls;");
  await db.query("insert into auth.users(id,email,email_confirmed_at) values($1,'buyer@example.test',now()),($2,'admin@example.test',now())",[owner,reviewer]);
  const migrations=["202609060001_customer_auth_foundation.sql","202609080001_customer_listings.sql","202609100001_short_display_codes.sql","202609130001_customer_referrals.sql","202609160001_public_analytics.sql","202609180002_listing_taxonomy.sql","202609250002_customer_saved_properties.sql","202609260001_public_real_estate_inquiries.sql","202609260003_public_buy_assistance_requests.sql","202609260004_public_property_viewings.sql","202609270002_customer_completed_purchases.sql","202609270003_admin_invitations.sql"];
  for(const migration of migrations)await db.exec(await readFile(new URL(`../supabase/migrations/${migration}`,import.meta.url),"utf8"));
  await db.query("insert into customer_profiles(id,first_name,last_name,email,country_code,phone_number,phone_number_normalized,account_type,profile_type,email_verified_at) values($1,'Ada','Buyer','buyer@example.test','+234','8011111111','+2348011111111','INVESTOR','PERSONAL',now())",[owner]);
  await db.query("insert into admin_profiles(user_id,full_name,email,phone_normalized,department,admin_role,active,accepted_at) values($1,'Lead Admin','admin@example.test','+2348022222222','MANAGEMENT','ADMIN',true,now())",[reviewer]);
  await db.query("insert into customer_listings(id,user_id,listing_code,title,description,occupancy_type,ownership_type,property_type,property_subtype,has_lien,bedrooms,bathrooms,parking_spaces,facilities,property_cost_minor,minimum_down_payment_minor,location,state,city,listing_status) values($1,$2,'RES-LEAD01','Ikoyi Home','Controlled','Residential','Personal','Residential','Bungalow',false,3,2,1,'{}',50000000,5000000,'Ikoyi address','Lagos','Ikoyi','LISTED')",[listing,owner]);
  await db.query("insert into public_real_estate_inquiries(inquiry_type,full_name,phone,email,message,source_page,created_at) values('Buying a Property','Legacy Buyer','+2348033333333','legacy@example.test','I want a property.','buy','2026-09-20'),('General Inquiry','Excluded Person','+2348044444444','excluded@example.test','General question.','home','2026-09-21'),('Selling/Listing a Property','Excluded Seller','+2348055555555','seller@example.test','I want to sell.','sell','2026-09-22')");
  await db.query("insert into public_buy_assistance_requests(id,status,contact_name,preferred_contact_method,contact_email,property_type,property_subtype,state,budget_minor,accepted_at) values($1,'PENDING','Pending Buyer','Email','pending@example.test','Residential','Bungalow','Lagos',100000000,null)",[pendingBuy]);
  await db.exec(await readFile(new URL("../supabase/migrations/202609280002_admin_lead_crm.sql",import.meta.url),"utf8"));
  assert.equal((await db.query<{count:number}>("select count(*)::integer count from admin_leads")).rows[0]!.count,1);
  await db.query("update public_buy_assistance_requests set status='ACCEPTED',accepted_at=now() where id=$1",[pendingBuy]);
  await db.query("insert into public_property_viewings(listing_id,first_name,last_name,email,phone,flexible_dates) values($1,'Ayo','Viewer','viewer@example.test','+2348066666666',true)",[listing]);
  await db.query("insert into public_real_estate_inquiries(inquiry_type,full_name,phone,email,message,source_page) values('Property Inquiry','New Buyer','+2348077777777','buyer@example.test','Please contact me.','buy')");
  const list=(await db.query<{value:AdminLeadDirectoryPage}>("select list_admin_leads('Buyer',1,40) value")).rows[0]!.value;
  assert.equal(list.allTotal,4);assert.equal(list.counts.new,3);assert.equal(list.items.length,3);
  const viewing=(await db.query<{public_id:string}>("select public_id from admin_leads where source_type='PROPERTY_VIEWING'")).rows[0]!.public_id;
  const viewingDetail=(await db.query<{value:AdminLeadDetail}>("select read_admin_lead($1) value",[viewing])).rows[0]!.value;
  assert.equal(viewingDetail.requester.accountLinked,false);assert.equal(viewingDetail.property?.code,"RES-LEAD01");assert.equal(viewingDetail.referral,null);
  const generic=(await db.query<{public_id:string}>("select public_id from admin_leads where source_type='REAL_ESTATE_INQUIRY' order by created_at limit 1")).rows[0]!.public_id;
  await db.query("select move_admin_lead($1,$2,'CONTACTED',1)",[generic,reviewer]);
  await assert.rejects(db.query("select move_admin_lead($1,$2,'LOST',1)",[generic,reviewer]),/Lead changed/);
  await db.query("select move_admin_lead($1,$2,'WON',2)",[generic,reviewer]);
  await assert.rejects(db.query("select move_admin_lead($1,$2,'LOST',3)",[generic,reviewer]),/not permitted/);
  const buy=(await db.query<{public_id:string}>("select public_id from admin_leads where source_type='BUY_ASSISTANCE'")).rows[0]!.public_id;
  await db.query("select move_admin_lead($1,$2,'CONTACTED',1)",[buy,reviewer]);await db.query("select move_admin_lead($1,$2,'LOST',2)",[buy,reviewer]);
  assert.equal((await db.query<{count:number}>("select count(*)::integer count from admin_lead_stage_history")).rows[0]!.count,4);
  assert.equal((await db.query<{count:number}>("select count(*)::integer count from customer_completed_purchases")).rows[0]!.count,0);
  assert.equal((await db.query<{count:number}>("select count(*)::integer count from customer_referral_links")).rows[0]!.count,0);
  assert.equal((await db.query<{listing_status:string}>("select listing_status from customer_listings where id=$1",[listing])).rows[0]!.listing_status,"LISTED");
  await db.exec("set role anon");await assert.rejects(db.query("select list_admin_leads('',1,40)"));await assert.rejects(db.query("select * from admin_leads"));await db.exec("reset role");
});
