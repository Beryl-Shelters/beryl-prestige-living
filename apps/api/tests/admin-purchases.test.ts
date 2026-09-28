import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test,type TestContext } from "node:test";
import { PGlite } from "@electric-sql/pglite";

import { createApp } from "../src/app.js";
import { adminConfigSchema } from "../src/admin/config.js";
import type { AdminInvitationEmail } from "../src/admin/email.js";
import type { AdminIdentity } from "../src/admin/identity.js";
import type { AdminCompletedPurchaseInput,AdminCompletedPurchaseResult,AdminReferralValidation } from "../src/admin/purchases-model.js";
import type { AdminPurchasesRepository } from "../src/admin/purchases-repository.js";
import type { AdminProfile,AdminRepository,InvitationClaim,InvitationPreview,InvitationRecord,StoredAdminSession } from "../src/admin/repository.js";
import { authConfigSchema } from "../src/auth/config.js";
import { unavailable } from "../src/auth/errors.js";
import type { ProviderTokens } from "../src/auth/gateway.js";

const auth=authConfigSchema.parse({webOrigin:"http://localhost:3000",apiOrigin:"http://localhost:4000",supabaseUrl:"https://example.supabase.co",anonKey:"anon",serviceKey:"service",encryptionKey:randomBytes(32).toString("base64"),cookieSecure:false,production:false,rateLimit:100});
const adminConfig=adminConfigSchema.parse({appOrigin:"http://localhost:3001",resendApiKey:"test",inviteFrom:"Beryl <admin@example.test>",inviteSeconds:172800,production:false});
const adminId="11111111-1111-4111-8111-111111111111",inactiveId="22222222-2222-4222-8222-222222222222",buyerId="33333333-3333-4333-8333-333333333333";

class Sessions implements AdminRepository {
  profiles=new Map<string,AdminProfile>([[adminId,{userId:adminId,fullName:"Purchase Admin",email:"admin@example.test",phone:"+2348011111111",department:"MANAGEMENT",role:"ADMIN",active:true}],[inactiveId,{userId:inactiveId,fullName:"Inactive Admin",email:"inactive@example.test",phone:"+2348022222222",department:"TECH",role:"ADMIN",active:false}]]);
  sessions=new Map<string,StoredAdminSession>();
  profile(id:string){return Promise.resolve(this.profiles.get(id)??null);} reserve():Promise<InvitationRecord>{throw unavailable();} provisionIdentity():Promise<string>{throw unavailable();}
  attach():Promise<void>{throw unavailable();} preview():Promise<InvitationPreview>{throw unavailable();} claim():Promise<InvitationClaim>{throw unavailable();} release():Promise<void>{throw unavailable();} accept():Promise<AdminProfile>{throw unavailable();}
  async createSession(hash:string,userId:string,tokens:string,seconds:number){this.sessions.set(hash,{token_hash:hash,user_id:userId,encrypted_tokens:tokens,expires_at:new Date(Date.now()+seconds*1000).toISOString(),refresh_lock:null});}
  readSession(hash:string){return Promise.resolve(this.sessions.get(hash)??null);} async claimRefresh(hash:string,lock:string){const row=this.sessions.get(hash);if(row)row.refresh_lock=lock;return row??null;}
  async finishRefresh(hash:string,lock:string,tokens:string){const row=this.sessions.get(hash);if(!row||row.refresh_lock!==lock)return false;row.encrypted_tokens=tokens;row.refresh_lock=null;return true;}
  async deleteSession(hash:string){this.sessions.delete(hash);} async deleteUserSessions(id:string){for(const [key,row] of this.sessions)if(row.user_id===id)this.sessions.delete(key);}
}
class Identity implements AdminIdentity {
  loginUser=adminId;createPending():Promise<string>{throw unavailable();}deletePending():Promise<void>{throw unavailable();}activate():Promise<void>{throw unavailable();}
  login(){return Promise.resolve(this.tokens(this.loginUser));}validate(){return Promise.resolve();}refresh(tokens:ProviderTokens){return Promise.resolve(tokens);}signOut(){return Promise.resolve();}
  tokens(userId:string):ProviderTokens{return{userId,accessToken:"access",refreshToken:"refresh",expiresAt:Date.now()/1000+3600};}
}
class Purchases implements AdminPurchasesRepository {
  validations:{adminId:string;referralCode:string;customerId:string;propertyCode:string;closedAt:string}[]=[];
  records:{adminId:string;input:AdminCompletedPurchaseInput}[]=[];
  validate(admin:string,referralCode:string,customerId:string,propertyCode:string,closedAt:string):Promise<AdminReferralValidation>{this.validations.push({adminId:admin,referralCode,customerId,propertyCode,closedAt});return Promise.resolve({referralCode,referralType:"PROPERTY",referrerName:"Controlled Referrer",propertyCode});}
  record(admin:string,input:AdminCompletedPurchaseInput):Promise<AdminCompletedPurchaseResult>{this.records.push({adminId:admin,input});return Promise.resolve({purchase:{id:input.requestId,propertyCode:input.propertyCode,priceMinor:input.priceMinor,closedAt:input.closedAt},attribution:null,commission:null});}
}
const email:AdminInvitationEmail={send(){throw unavailable();}};

async function apiFixture(t:TestContext){const repository=new Sessions(),identity=new Identity(),purchases=new Purchases();const server=createApp({webAppUrl:auth.webOrigin,auth,admin:adminConfig,adminRepository:repository,adminPurchasesRepository:purchases,adminIdentity:identity,adminEmail:email}).listen(0,"127.0.0.1");await new Promise<void>(resolve=>server.once("listening",resolve));t.after(()=>new Promise<void>(resolve=>{server.close(()=>resolve());server.closeAllConnections();}));const address=server.address();assert(address&&typeof address!=="string");const jar=new Map<string,string>();async function request(path:string,body?:unknown,origin=adminConfig.appOrigin){const response=await fetch(`http://127.0.0.1:${address.port}/api/v1/admin${path}`,{method:body===undefined?"GET":"POST",headers:{Origin:origin,"Content-Type":"application/json",Cookie:[...jar].map(([key,value])=>`${key}=${value}`).join("; ")},...(body===undefined?{}:{body:JSON.stringify(body)})});for(const cookie of response.headers.getSetCookie()){const [pair]=cookie.split(";"),index=pair!.indexOf("="),key=pair!.slice(0,index),value=pair!.slice(index+1);if(value)jar.set(key,value);else jar.delete(key);}return response;}async function login(id:string){identity.loginUser=id;return request("/auth/login",{email:"admin@example.test",password:"Controlled!9"});}return{purchases,request,login};}

test("completed-purchase endpoints require an active Admin and derive Admin identity from the session",async t=>{const f=await apiFixture(t),closedAt="2026-09-20T12:00:00.000Z";assert.equal((await f.request(`/referral-links/REF-ABC234/validation?customerId=${buyerId}&propertyCode=RES-ABC234&closedAt=${encodeURIComponent(closedAt)}`)).status,401);assert.equal((await f.login(inactiveId)).status,401);assert.equal(f.purchases.validations.length,0);await f.login(adminId);assert.equal((await f.request(`/referral-links/REF-ABC234/validation?customerId=${buyerId}&propertyCode=RES-ABC234&closedAt=${encodeURIComponent(closedAt)}`)).status,200);assert.deepEqual(f.purchases.validations,[{adminId,referralCode:"REF-ABC234",customerId:buyerId,propertyCode:"RES-ABC234",closedAt}]);});

test("completed-purchase input cannot supply a referrer, rate, commission amount, or acting Admin",async t=>{const f=await apiFixture(t);await f.login(adminId);const input={requestId:"44444444-4444-4444-8444-444444444444",customerId:buyerId,propertyCode:"RES-ABC234",priceMinor:50000001,closedAt:"2026-09-20T12:00:00.000Z",referralCode:"REF-ABC234"};for(const extra of [{referrerId:"55555555-5555-4555-8555-555555555555"},{commissionRateBps:9000},{commissionAmountMinor:1},{adminId:inactiveId}])assert.equal((await f.request("/completed-purchases",{...input,...extra})).status,400);assert.equal(f.purchases.records.length,0);assert.equal((await f.request("/completed-purchases",input,"https://evil.example")).status,403);const response=await f.request("/completed-purchases",input);assert.equal(response.status,201);assert.deepEqual(f.purchases.records,[{adminId,input}]);});

test("referral commission migration makes explicit purchase attribution atomic, exact, immutable, and isolated",async t=>{
  const db=new PGlite();t.after(()=>db.close());
  const buyer="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",referrer="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",seller="cccccccc-cccc-4ccc-8ccc-cccccccccccc",admin="dddddddd-dddd-4ddd-8ddd-dddddddddddd",other="eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
  const listing="10000000-0000-4000-8000-000000000001",otherListing="10000000-0000-4000-8000-000000000002",historical="20000000-0000-4000-8000-000000000001";
  await db.exec("create schema auth; create function auth.uid() returns uuid language sql stable as 'select null::uuid'; create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_app_meta_data jsonb default '{}',raw_user_meta_data jsonb default '{}'); create role anon; create role authenticated; create role service_role bypassrls;");
  await db.query("insert into auth.users(id,email,email_confirmed_at) values($1,'buyer@example.test',now()),($2,'referrer@example.test',now()),($3,'seller@example.test',now()),($4,'admin@example.test',now()),($5,'other@example.test',now())",[buyer,referrer,seller,admin,other]);
  const migrations=["202609060001_customer_auth_foundation.sql","202609080001_customer_listings.sql","202609100001_short_display_codes.sql","202609130001_customer_referrals.sql","202609180001_public_property_referrals.sql","202609250002_customer_saved_properties.sql","202609260001_public_real_estate_inquiries.sql","202609260003_public_buy_assistance_requests.sql","202609260004_public_property_viewings.sql","202609270002_customer_completed_purchases.sql","202609270003_admin_invitations.sql"];
  for(const migration of migrations)await db.exec(await readFile(new URL(`../supabase/migrations/${migration}`,import.meta.url),"utf8"));
  const profileSql="insert into customer_profiles(id,first_name,last_name,email,country_code,phone_number,phone_number_normalized,account_type,profile_type,email_verified_at) values($1,$2,'Test',$3,'+234',$4,$5,'INVESTOR','PERSONAL',now())";
  await db.query(profileSql,[buyer,"Buyer","buyer@example.test","8011111111","+2348011111111"]);await db.query(profileSql,[referrer,"Referrer","referrer@example.test","8022222222","+2348022222222"]);await db.query(profileSql,[seller,"Seller","seller@example.test","8033333333","+2348033333333"]);await db.query(profileSql,[other,"Other","other@example.test","8044444444","+2348044444444"]);
  await db.query("insert into admin_profiles(user_id,full_name,email,phone_normalized,department,admin_role,active,accepted_at) values($1,'Purchase Admin','admin@example.test','+2348055555555','MANAGEMENT','ADMIN',true,now())",[admin]);
  const listingSql="insert into customer_listings(id,user_id,listing_code,title,description,occupancy_type,ownership_type,property_type,property_subtype,has_lien,bedrooms,bathrooms,parking_spaces,facilities,property_cost_minor,minimum_down_payment_minor,location,state,city,listing_status) values($1,$2,$3,$4,'Controlled','Residential','Personal','Residential','Bungalow',false,3,2,1,'{}',50000000,5000000,'Controlled address','Lagos','Ikeja','LISTED')";
  await db.query(listingSql,[listing,seller,"RES-ABC234","Primary Property"]);await db.query(listingSql,[otherListing,seller,"RES-DEF234","Other Property"]);
  await db.query("insert into customer_referral_links(user_id,referral_code,referral_type,listing_id,property_code,created_at) values($1,'REF-ABC234','PROPERTY',$2,'RES-ABC234','2026-09-01')",[referrer,listing]);
  await db.query("insert into customer_referral_links(user_id,referral_code,referral_type,created_at) values($1,'REF-SEL234','SELLER','2026-09-01'),($2,'REF-SELF23','SELLER','2026-09-01')",[referrer,seller]);
  await db.query("insert into customer_completed_purchases(id,customer_id,source_listing_id,property_code,title,state,property_type,property_subtype,price_minor,closed_at) values($1,$2,$3,'RES-ABC234','Historical Purchase','Lagos','Residential','Bungalow',40000001,'2026-09-02')",[historical,buyer,listing]);
  await db.query("insert into customer_saved_properties(user_id,listing_id,created_at) values($1,$2,'2026-09-03')",[buyer,listing]);
  await db.query("insert into public_real_estate_inquiries(inquiry_type,full_name,phone,email,message,source_page,created_at) values('Buying a Property','Controlled Buyer','+2348011111111','buyer@example.test','I want this property.','buy','2026-09-04')");
  await db.query("insert into public_buy_assistance_requests(id,status,contact_name,preferred_contact_method,contact_email,property_type,property_subtype,state,budget_minor,accepted_at,created_at) values('30000000-0000-4000-8000-000000000001','ACCEPTED','Controlled Buyer','Email','buyer@example.test','Residential','Bungalow','Lagos',50000000,'2026-09-05','2026-09-05')");
  await db.query("insert into public_property_viewings(listing_id,first_name,last_name,email,phone,flexible_dates,created_at) values($1,'Controlled','Buyer','buyer@example.test','+2348011111111',true,'2026-09-06')",[listing]);
  await db.exec(await readFile(new URL("../supabase/migrations/202609280002_admin_lead_crm.sql",import.meta.url),"utf8"));
  await db.exec(await readFile(new URL("../supabase/migrations/202609280003_referral_commission_foundation.sql",import.meta.url),"utf8"));
  const count=async()=>Number((await db.query<{count:number}>("select count(*)::integer count from referral_commission_entitlements")).rows[0]!.count);
  assert.equal(await count(),0,"historical links, purchases, saves, enquiries, assistance and viewings must not backfill commission");
  for(const status of ["PENDING","LISTED","REJECTED","UNLISTED","LISTED"]){await db.query("update customer_listings set listing_status=$1 where id=$2",[status,listing]);assert.equal(await count(),0);}
  const leads=(await db.query<{public_id:string}>("select public_id from admin_leads order by public_id")).rows;
  for(const lead of leads){await db.query("select move_admin_lead($1,$2,'CONTACTED',1)",[lead.public_id,admin]);await db.query("select move_admin_lead($1,$2,$3,2)",[lead.public_id,admin,lead===leads.at(-1)?"LOST":"WON"]);assert.equal(await count(),0);}
  const noReferral="20000000-0000-4000-8000-000000000002";
  const noReferralResult=(await db.query<{value:{commission:null} }>("select record_admin_completed_purchase($1,$2,$3,'RES-ABC234',50000001,'2026-09-20',null) value",[noReferral,admin,buyer])).rows[0]!.value;
  assert.equal(noReferralResult.commission,null);assert.equal(await count(),0);
  await assert.rejects(db.query("select record_admin_completed_purchase(gen_random_uuid(),$1,$2,'RES-DEF234',50000001,'2026-09-20','REF-ABC234')",[admin,buyer]),/does not match/);
  await assert.rejects(db.query("select record_admin_completed_purchase(gen_random_uuid(),$1,$2,'RES-ABC234',50000001,'2026-09-20','REF-ZZZZZZ')",[admin,buyer]),/Referral link not found/);
  await assert.rejects(db.query("select record_admin_completed_purchase(gen_random_uuid(),$1,$2,'RES-ABC234',50000001,'2026-08-20','REF-ABC234')",[admin,buyer]),/created after/);
  const selfCode="REF-BUY234";await db.query("insert into customer_referral_links(user_id,referral_code,referral_type,listing_id,property_code,created_at) values($1,$2,'PROPERTY',$3,'RES-ABC234','2026-09-01')",[buyer,selfCode,listing]);
  await assert.rejects(db.query("select record_admin_completed_purchase(gen_random_uuid(),$1,$2,'RES-ABC234',50000001,'2026-09-20',$3)",[admin,buyer,selfCode]),/Self-referral/);
  const attributed="20000000-0000-4000-8000-000000000003",args=[attributed,admin,buyer,"RES-ABC234",50000001,"2026-09-20T12:00:00Z","REF-ABC234"];
  const recordSql="select record_admin_completed_purchase($1,$2,$3,$4,$5,$6,$7) value";
  type RecordResult={purchase:{id:string;propertyCode:string;priceMinor:number;closedAt:string};attribution:null|{referralCode:string;referralType:string;referrerName:string};commission:null|{reference:string;basisMinor:number;rateBps:number;amountMinor:number;earnedAt:string}};
  const first=(await db.query<{value:RecordResult}>(recordSql,args)).rows[0]!.value;
  assert(first.commission);assert.equal(first.commission.basisMinor,50000001);assert.equal(first.commission.rateBps,200);assert.equal(first.commission.amountMinor,1000000);
  const retry=(await db.query<{value:RecordResult}>(recordSql,args)).rows[0]!.value;assert.deepEqual(retry,first);
  await Promise.all([db.query(recordSql,args),db.query(recordSql,args)]);assert.equal(await count(),1);
  await assert.rejects(db.query(recordSql,[attributed,admin,buyer,"RES-ABC234",50000002,"2026-09-20T12:00:00Z","REF-ABC234"]),/already used/);
  await assert.rejects(db.query(recordSql,[attributed,admin,buyer,"RES-ABC234",50000001,"2026-09-20T12:00:00Z","REF-SEL234"]),/attribution differs/);
  const stored=(await db.query<{commission_basis_minor:number;commission_rate_bps:number;commission_amount_minor:number;referrer_id:string;recorded_by:string}>("select c.commission_basis_minor,c.commission_rate_bps,c.commission_amount_minor,c.referrer_id,p.recorded_by from referral_commission_entitlements c join customer_completed_purchases p on p.id=c.completed_purchase_id")).rows[0]!;
  assert.deepEqual(stored,{commission_basis_minor:50000001,commission_rate_bps:200,commission_amount_minor:1000000,referrer_id:referrer,recorded_by:admin});
  await db.query("update customer_listings set property_cost_minor=90000000 where id=$1",[listing]);assert.equal((await db.query<{amount:number}>("select commission_amount_minor amount from referral_commission_entitlements")).rows[0]!.amount,1000000);
  await assert.rejects(db.query("update referral_commission_entitlements set commission_amount_minor=1"),/immutable/);await assert.rejects(db.query("delete from completed_purchase_referral_attributions"),/immutable/);
  const sellerPurchase="20000000-0000-4000-8000-000000000004";await db.query(recordSql,[sellerPurchase,admin,buyer,"RES-ABC234",10000,"2026-09-21T12:00:00Z","REF-SEL234"]);
  const sellerAttribution=(await db.query<{referred_customer_id:string;referrer_id:string;referral_type:string}>("select referred_customer_id,referrer_id,referral_type from completed_purchase_referral_attributions where completed_purchase_id=$1",[sellerPurchase])).rows[0]!;assert.deepEqual(sellerAttribution,{referred_customer_id:seller,referrer_id:referrer,referral_type:"SELLER"});
  await assert.rejects(db.query(recordSql,["20000000-0000-4000-8000-000000000005",admin,buyer,"RES-ABC234",10000,"2026-09-21T12:00:00Z","REF-SELF23"]),/Self-referral/);
  const ownerHistory=(await db.query<{value:{summary:{totalEarnings:number;availableBalance:number;referrals:number};items:{status:string}[]} }>("select list_customer_referrals($1,1,10) value",[referrer])).rows[0]!.value;assert.equal(ownerHistory.summary.referrals,2);assert.equal(ownerHistory.summary.totalEarnings,1000200);assert.equal(ownerHistory.summary.availableBalance,1000200);assert(ownerHistory.items.every(item=>item.status==="COMPLETED"));
  const otherHistory=(await db.query<{value:{total:number} }>("select list_customer_referrals($1,1,10) value",[other])).rows[0]!.value;assert.equal(otherHistory.total,0);
  await db.exec("set role authenticated");await assert.rejects(db.query("insert into referral_commission_entitlements(id) values(gen_random_uuid())"));await assert.rejects(db.query("select * from referral_commission_entitlements"));await assert.rejects(db.query("select record_admin_completed_purchase(gen_random_uuid(),$1,$2,'RES-ABC234',1,now(),null)",[admin,buyer]));await db.exec("reset role");
  await db.exec("set role service_role");await assert.rejects(db.query("insert into customer_completed_purchases(customer_id,property_code,title,state,property_type,property_subtype,price_minor,closed_at) values($1,'RES-DIRECT','Direct','Lagos','Residential','Bungalow',1,now())",[buyer]));await assert.rejects(db.query("insert into completed_purchase_referral_attributions(id) values(gen_random_uuid())"));await assert.rejects(db.query("insert into referral_commission_entitlements(id) values(gen_random_uuid())"));await db.exec("reset role");
  assert.equal((await db.query<{listing_status:string}>("select listing_status from customer_listings where id=$1",[listing])).rows[0]!.listing_status,"LISTED");
});
