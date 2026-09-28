import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test, type TestContext } from "node:test";
import { PGlite } from "@electric-sql/pglite";

import { createApp } from "../src/app.js";
import { adminConfigSchema } from "../src/admin/config.js";
import type { AdminInvitationEmail } from "../src/admin/email.js";
import type { AdminIdentity } from "../src/admin/identity.js";
import type { AdminPropertyDetail, AdminPropertyDirectoryPage, AdminPropertyQuery } from "../src/admin/properties-model.js";
import type { AdminPropertiesRepository } from "../src/admin/properties-repository.js";
import type { AdminProfile, AdminRepository, InvitationClaim, InvitationPreview, InvitationRecord, StoredAdminSession } from "../src/admin/repository.js";
import { authConfigSchema } from "../src/auth/config.js";
import { unavailable } from "../src/auth/errors.js";
import type { ProviderTokens } from "../src/auth/gateway.js";
import type { MediaStorage } from "../src/listings/media.js";
import type { MediaAsset } from "../src/listings/model.js";

const auth = authConfigSchema.parse({ webOrigin:"http://localhost:3000", apiOrigin:"http://localhost:4000", supabaseUrl:"https://example.supabase.co", anonKey:"anon", serviceKey:"service", encryptionKey:randomBytes(32).toString("base64"), cookieSecure:false, production:false, rateLimit:100 });
const adminConfig = adminConfigSchema.parse({ appOrigin:"http://localhost:3001", resendApiKey:"test", inviteFrom:"Beryl <admin@example.test>", inviteSeconds:172800, production:false });
const adminId="11111111-1111-4111-8111-111111111111", inactiveId="22222222-2222-4222-8222-222222222222", propertyId="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

class Sessions implements AdminRepository {
  profiles=new Map<string,AdminProfile>([
    [adminId,{userId:adminId,fullName:"Review Admin",email:"admin@example.test",phone:"+2348011111111",department:"MANAGEMENT",role:"ADMIN",active:true}],
    [inactiveId,{userId:inactiveId,fullName:"Inactive Admin",email:"inactive@example.test",phone:"+2348022222222",department:"TECH",role:"ADMIN",active:false}],
  ]);
  sessions=new Map<string,StoredAdminSession>();
  profile(id:string){return Promise.resolve(this.profiles.get(id)??null);}
  reserve():Promise<InvitationRecord>{throw unavailable();} provisionIdentity():Promise<string>{throw unavailable();}
  attach():Promise<void>{throw unavailable();} preview():Promise<InvitationPreview>{throw unavailable();}
  claim():Promise<InvitationClaim>{throw unavailable();} release():Promise<void>{throw unavailable();}
  accept():Promise<AdminProfile>{throw unavailable();}
  async createSession(hash:string,userId:string,tokens:string,seconds:number){this.sessions.set(hash,{token_hash:hash,user_id:userId,encrypted_tokens:tokens,expires_at:new Date(Date.now()+seconds*1000).toISOString(),refresh_lock:null});}
  readSession(hash:string){return Promise.resolve(this.sessions.get(hash)??null);}
  async claimRefresh(hash:string,lock:string){const row=this.sessions.get(hash);if(row)row.refresh_lock=lock;return row??null;}
  async finishRefresh(hash:string,lock:string,tokens:string){const row=this.sessions.get(hash);if(!row||row.refresh_lock!==lock)return false;row.encrypted_tokens=tokens;row.refresh_lock=null;return true;}
  async deleteSession(hash:string){this.sessions.delete(hash);}
  async deleteUserSessions(id:string){for(const [key,row] of this.sessions)if(row.user_id===id)this.sessions.delete(key);}
}
class Identity implements AdminIdentity {
  loginUser=adminId;
  createPending():Promise<string>{throw unavailable();} deletePending():Promise<void>{throw unavailable();} activate():Promise<void>{throw unavailable();}
  login(){return Promise.resolve(this.tokens(this.loginUser));} validate(){return Promise.resolve();}
  refresh(tokens:ProviderTokens){return Promise.resolve(tokens);} signOut(){return Promise.resolve();}
  tokens(userId:string):ProviderTokens{return{userId,accessToken:"access",refreshToken:"refresh",expiresAt:Date.now()/1000+3600};}
}

const directory:AdminPropertyDirectoryPage={counts:{all:1,unlisted:0,pending:1,approved:0,rejected:0},items:[{id:propertyId,code:"RES-TEST01",title:"Controlled Property",propertyType:"Residential",propertySubtype:"Bungalow",city:"Ikeja",state:"Lagos",status:"PENDING",createdAt:"2026-09-01T00:00:00Z",updatedAt:"2026-09-02T00:00:00Z",submittedAt:"2026-09-02T00:00:00Z",listedAt:null,sellerId:"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",sellerName:"Controlled Seller",thumbnailUrl:null,hasMandate:true}],page:1,pageSize:6,total:1,totalPages:1};
const detail:AdminPropertyDetail={id:propertyId,code:"RES-TEST01",version:2,title:"Controlled Property",description:"Controlled description",occupancyType:"Residential",ownershipType:"Personal",propertyType:"Residential",propertySubtype:"Bungalow",hasLien:false,bedrooms:3,bathrooms:2,toilets:null,parkingSpaces:1,units:null,landArea:null,yearBuilt:null,facilities:[],priceMinor:50000000,minimumDownPaymentMinor:5000000,location:"Controlled address",state:"Lagos",city:"Ikeja",registeredTitleDocument:null,additionalInformation:null,status:"PENDING",createdAt:"2026-09-01T00:00:00Z",updatedAt:"2026-09-02T00:00:00Z",submittedAt:"2026-09-02T00:00:00Z",listedAt:null,rejectionReason:null,rejectedAt:null,seller:{id:"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",name:"Controlled Seller",email:"seller@example.test",phone:"+2348033333333"},images:[],documents:[{id:"cccccccc-cccc-4ccc-8ccc-cccccccccccc",title:"Ownership.pdf",sortOrder:0,mimeType:"application/pdf",sizeBytes:4}],mandate:null,reviews:[]};

class Properties implements AdminPropertiesRepository {
  queries:AdminPropertyQuery[]=[]; reviews:{code:string;reviewer:string;action:string;version:number;reason?:string}[]=[];
  directory(query:AdminPropertyQuery){this.queries.push(query);return Promise.resolve(directory);}
  detail(){return Promise.resolve(detail);}
  async review(code:string,reviewer:string,action:"APPROVE"|"REJECT",version:number,reason?:string){this.reviews.push({code,reviewer,action,version,...(reason?{reason}:{})});}
  document(){return Promise.resolve({public_id:"private/document.pdf",resource_type:"raw",delivery_type:"authenticated",url:"",mime_type:"application/pdf",size_bytes:4} as MediaAsset);}
  signature(){return Promise.resolve(null);}
}
class Storage implements MediaStorage {
  downloads=0; upload():Promise<MediaAsset>{throw unavailable();} remove(){return Promise.resolve();}
  async download(){this.downloads++;return new Uint8Array([37,80,68,70]);}
}
const email:AdminInvitationEmail={send(){throw unavailable();}};

async function fixture(t:TestContext){
  const repository=new Sessions(),identity=new Identity(),properties=new Properties(),storage=new Storage();
  const server=createApp({webAppUrl:auth.webOrigin,auth,admin:adminConfig,adminRepository:repository,adminPropertiesRepository:properties,adminIdentity:identity,adminEmail:email,mediaStorage:storage}).listen(0,"127.0.0.1");
  await new Promise<void>(resolve=>server.once("listening",resolve));
  t.after(()=>new Promise<void>(resolve=>{server.close(()=>resolve());server.closeAllConnections();}));
  const address=server.address();assert(address&&typeof address!=="string");const jar=new Map<string,string>();
  async function request(path:string,body?:unknown){const response=await fetch(`http://127.0.0.1:${address.port}/api/v1/admin${path}`,{method:body===undefined?"GET":"POST",headers:{Origin:adminConfig.appOrigin,"Content-Type":"application/json",Cookie:[...jar].map(([key,value])=>`${key}=${value}`).join("; ")},...(body===undefined?{}:{body:JSON.stringify(body)})});for(const cookie of response.headers.getSetCookie()){const [pair]=cookie.split(";");const index=pair!.indexOf("=");const key=pair!.slice(0,index),value=pair!.slice(index+1);if(value)jar.set(key,value);else jar.delete(key);}return response;}
  async function login(id:string){identity.loginUser=id;return request("/auth/login",{email:"admin@example.test",password:"Controlled!9"});}
  return{properties,storage,request,login};
}

test("Admin property endpoints reject unauthenticated and inactive Admin access",async t=>{const f=await fixture(t);assert.equal((await f.request("/properties")).status,401);assert.equal((await f.login(inactiveId)).status,401);assert.equal(f.properties.queries.length,0);});
test("directory validates server search, status, sort and pagination",async t=>{const f=await fixture(t);await f.login(adminId);assert.equal((await f.request("/properties?search=Ikeja&status=PENDING&sort=TITLE_DESC&page=2&pageSize=6")).status,200);assert.deepEqual(f.properties.queries[0],{search:"Ikeja",status:"PENDING",sort:"TITLE_DESC",page:2,pageSize:6});for(const path of ["/properties?status=APPROVED","/properties?sort=PRICE","/properties?page=0"])assert.equal((await f.request(path)).status,400);});
test("approval and rejection derive reviewer identity from the Admin session",async t=>{const f=await fixture(t);await f.login(adminId);assert.equal((await f.request("/properties/RES-TEST01/approve",{version:2})).status,200);assert.equal((await f.request("/properties/RES-TEST01/reject",{version:2,reason:"Provide a clearer ownership document."})).status,200);assert.deepEqual(f.properties.reviews,[{code:"RES-TEST01",reviewer:adminId,action:"APPROVE",version:2},{code:"RES-TEST01",reviewer:adminId,action:"REJECT",version:2,reason:"Provide a clearer ownership document."}]);assert.equal((await f.request("/properties/RES-TEST01/reject",{version:2,reason:"   "})).status,400);});
test("private documents require Admin auth and stream through private storage",async t=>{const f=await fixture(t),path="/properties/RES-TEST01/documents/cccccccc-cccc-4ccc-8ccc-cccccccccccc";assert.equal((await f.request(path)).status,401);await f.login(adminId);const response=await f.request(path);assert.equal(response.status,200);assert.equal(response.headers.get("content-type"),"application/pdf");assert.equal(f.storage.downloads,1);});

test("moderation migration maps statuses, persists review history and controls visibility",async t=>{
  const db=new PGlite();t.after(()=>db.close());
  const owner="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",reviewer="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",pending="cccccccc-cccc-4ccc-8ccc-cccccccccccc",rejected="dddddddd-dddd-4ddd-8ddd-dddddddddddd";
  await db.exec("create schema auth; create function auth.uid() returns uuid language sql stable as 'select null::uuid'; create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_app_meta_data jsonb default '{}',raw_user_meta_data jsonb default '{}'); create role anon; create role authenticated; create role service_role bypassrls;");
  await db.query("insert into auth.users(id,email,email_confirmed_at) values($1,'seller@example.test',now()),($2,'admin@example.test',now())",[owner,reviewer]);
  const migrations=["202609060001_customer_auth_foundation.sql","202609080001_customer_listings.sql","202609100001_short_display_codes.sql","202609160001_public_analytics.sql","202609180002_listing_taxonomy.sql","202609250001_sales_mandates.sql","202609260005_listing_dashboard_review.sql","202609270003_admin_invitations.sql","202609280001_admin_property_moderation.sql"];
  for(const migration of migrations)await db.exec(await readFile(new URL(`../supabase/migrations/${migration}`,import.meta.url),"utf8"));
  await db.query("insert into customer_profiles(id,first_name,last_name,email,country_code,phone_number,phone_number_normalized,account_type,profile_type,email_verified_at) values($1,'Ada','Seller','seller@example.test','+234','8011111111','+2348011111111','INVESTOR','PERSONAL',now())",[owner]);
  await db.query("insert into admin_profiles(user_id,full_name,email,phone_normalized,department,admin_role,active,accepted_at) values($1,'Review Admin','admin@example.test','+2348022222222','MANAGEMENT','ADMIN',true,now())",[reviewer]);
  const sql="insert into customer_listings(id,user_id,listing_code,title,description,occupancy_type,ownership_type,property_type,property_subtype,has_lien,bedrooms,bathrooms,parking_spaces,facilities,property_cost_minor,minimum_down_payment_minor,location,state,city,listing_status,requested_at) values($1,$2,$3,$4,'Controlled','Residential','Personal','Residential','Bungalow',false,3,2,1,'{}',50000000,5000000,'Ikeja address','Lagos','Ikeja','PENDING','2026-09-20')";
  await db.query(sql,[pending,owner,"RES-PEND01","Pending Property"]);await db.query(sql,[rejected,owner,"RES-REJ001","Second Property"]);
  const list=await db.query<{value:AdminPropertyDirectoryPage}>("select list_admin_properties('Ada','PENDING','NEWEST',1,6) value");
  assert.equal(list.rows[0]!.value.counts.pending,2);assert.equal(list.rows[0]!.value.items[0]?.sellerName,"Ada Seller");
  await db.query("select review_admin_property('RES-PEND01',$1,'APPROVE',1,null)",[reviewer]);
  assert.equal((await db.query<{listing_status:string}>("select listing_status from customer_listings where id=$1",[pending])).rows[0]!.listing_status,"LISTED");
  await assert.rejects(db.query("select review_admin_property('RES-PEND01',$1,'APPROVE',2,null)",[reviewer]),/Only pending/);
  await assert.rejects(db.query("select review_admin_property('RES-REJ001',$1,'REJECT',1,'   ')",[reviewer]),/Invalid property review/);
  await db.query("select review_admin_property('RES-REJ001',$1,'REJECT',1,'Upload a readable ownership document.')",[reviewer]);
  assert.deepEqual((await db.query<{listing_status:string;rejection_reason:string}>("select listing_status,rejection_reason from customer_listings where id=$1",[rejected])).rows[0],{listing_status:"REJECTED",rejection_reason:"Upload a readable ownership document."});
  await db.query("update customer_listings set listing_status='PENDING',requested_at=now() where id=$1",[rejected]);
  assert.equal((await db.query<{count:number}>("select count(*)::integer count from admin_listing_reviews where listing_id=$1 and action='REJECTED'",[rejected])).rows[0]!.count,1);
  await db.exec("set role anon");await assert.rejects(db.query("select list_admin_properties('','ALL','NEWEST',1,6)"));await assert.rejects(db.query("select * from admin_listing_reviews"));await db.exec("reset role");
});
