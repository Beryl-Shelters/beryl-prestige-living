import {PGlite} from "@electric-sql/pglite";
import {readFile} from "node:fs/promises";
import {randomBytes,randomUUID} from "node:crypto";
import type {TestContext} from "node:test";
import {createApp} from "../src/app.js";
import {authConfigSchema} from "../src/auth/config.js";
import {AuthCipher,hashToken} from "../src/auth/crypto.js";
import type {AuthGateway,Customer,StoredSession} from "../src/auth/gateway.js";
import {AuthError} from "../src/auth/errors.js";
import type {Listing,ListingQuery,MediaAsset} from "../src/listings/model.js";
import type {CleanupAsset,ListingsRepository,Mutation} from "../src/listings/repository.js";
import type {MediaStorage} from "../src/listings/media.js";
import type {UploadFile} from "../src/listings/uploads.js";
import {ListingsDashboardRepository} from "../src/listings/dashboard-repository.js";
export const imageBytes=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aN1cAAAAASUVORK5CYII=","base64");
export const validContent={title:"3 Bedroom Duplex",description:"A property in Ikoyi.",occupancy_type:"Residential",ownership_type:"Family",property_type:"Residential",property_subtype:"Semi-Detached House",has_lien:false,bedrooms:3,bathrooms:4,parking_spaces:2,units:null,land_area:null,year_built:null,facilities:[],property_cost:"50000000.01",minimum_down_payment:"35000000.01",location:"Odo street",state:"Lagos",city:"Ikoyi",longitude:null,latitude:null};
export class LocalRepository implements ListingsRepository {
  constructor(readonly db:PGlite){}
  async get(owner:string,id:string){const {rows}=await this.db.query<{value:Listing}>(`select to_jsonb(l)||jsonb_build_object('images',coalesce((select jsonb_agg(i order by sort_order) from public.customer_listing_images i where listing_id=l.id),'[]'::jsonb),'documents',coalesce((select jsonb_agg(d order by batch_id,sort_order) from public.customer_listing_documents d where listing_id=l.id),'[]'::jsonb)) as value from public.customer_listings l where user_id=$1 and id=$2`,[owner,id]);return rows[0]?.value??null;}
  async list(owner:string,q:ListingQuery){const params=[owner,`%${q.q}%`,q.status??null];const where="user_id=$1 and (title ilike $2 or listing_code ilike $2) and ($3::text is null or listing_status=$3)";const result=await this.db.query<{id:string}>(`select id from public.customer_listings where ${where} order by created_at desc,id desc limit $4 offset $5`,[...params,q.page_size,(q.page-1)*q.page_size]);const count=await this.db.query<{total:number}>(`select count(*)::int as total from public.customer_listings where ${where}`,params);return {items:await Promise.all(result.rows.map(async row=>(await this.get(owner,row.id))!)),total:count.rows[0]!.total};}
  async mutate(owner:string,v:Mutation){try{const {rows}=await this.db.query<{id:string}>("select public.mutate_customer_listing($1,$2,$3,$4,$5,$6,$7) as id",[owner,v.id,v.action,v.version,JSON.stringify(v.content??{}),JSON.stringify(v.images??[]),JSON.stringify(v.documents??[])]);return rows[0]!.id;}catch(error){const code=(error as {code:string}).code;throw new AuthError(code==="P0002"?404:409,"TEST_SQL_CONSTRAINT","Listing could not be updated.");}}
  async recent(owner:string){return (await this.db.query<{id:string;title:string}>("select id,title from public.customer_listings where user_id=$1 order by created_at desc,id desc limit 5",[owner])).rows;}
  async journal(owner:string,a:CleanupAsset){await this.db.query("insert into public.customer_listing_media_cleanup(public_id,user_id,resource_type,delivery_type) values($1,$2,$3,$4)",[a.public_id,owner,a.resource_type,a.delivery_type]);}
  async cleanupCandidates(owner:string){return (await this.db.query<CleanupAsset>("select public_id,resource_type,delivery_type from public.customer_listing_media_cleanup where user_id=$1 and created_at<clock_timestamp()-interval '1 hour'",[owner])).rows;}
  async referenced(_owner:string,a:CleanupAsset){return (await this.db.query("select id from public.customer_listing_images where public_id=$1 and resource_type=$2 and delivery_type=$3 union all select id from public.customer_listing_documents where public_id=$1 and resource_type=$2 and delivery_type=$3",[a.public_id,a.resource_type,a.delivery_type])).rows.length>0;}
  async forgetCleanup(owner:string,a:CleanupAsset){await this.db.query("delete from public.customer_listing_media_cleanup where user_id=$1 and public_id=$2 and resource_type=$3 and delivery_type=$4",[owner,a.public_id,a.resource_type,a.delivery_type]);}
  async claimCleanup(owner:string,a:CleanupAsset){return (await this.db.query<{claimed:boolean}>("select public.claim_customer_listing_cleanup($1,$2,$3,$4) as claimed",[owner,a.public_id,a.resource_type,a.delivery_type])).rows[0]!.claimed;}
}
export async function listingFixture(t:TestContext,shortCodes=true){
  const db=new PGlite();await db.exec("create schema auth; create table auth.users(id uuid primary key); create role anon; create role authenticated; create role service_role;");
  await db.exec(await readFile(new URL("../supabase/migrations/202609080001_customer_listings.sql",import.meta.url),"utf8"));
  await db.exec(await readFile(new URL("../supabase/migrations/202609180002_listing_taxonomy.sql",import.meta.url),"utf8"));
  if(shortCodes) await db.exec(await readFile(new URL("../supabase/migrations/202609100001_short_display_codes.sql",import.meta.url),"utf8"));
  await db.exec(await readFile(new URL("../supabase/migrations/202609100002_single_document_upload.sql",import.meta.url),"utf8"));
  const owner=randomUUID(),other=randomUUID();await db.query("insert into auth.users values($1),($2)",[owner,other]);
  const config=authConfigSchema.parse({webOrigin:"http://localhost:3000",apiOrigin:"http://localhost:4000",supabaseUrl:"https://example.supabase.co",anonKey:"test",serviceKey:"test",encryptionKey:randomBytes(32).toString("base64"),cookieSecure:false,production:false});
  const profile:Customer={id:owner,first_name:"Ada",last_name:"Okafor",email:"ada@example.test",phone_number:null,phone_number_normalized:null,country_code:null,account_type:"INVESTOR",profile_type:"PERSONAL",email_verified_at:new Date().toISOString()};
  const raw="test-listing-session";const row:StoredSession={token_hash:hashToken(raw),user_id:owner,purpose:"ACCOUNT",refresh_lock:null,expires_at:new Date(Date.now()+3600000).toISOString(),encrypted_tokens:new AuthCipher(config.encryptionKey).seal({userId:owner,accessToken:"test",refreshToken:"test",expiresAt:Date.now()/1000+3600},"provider-tokens")};
  const gateway={readSession:async(hash:string,purpose:string)=>hash===row.token_hash&&purpose==="ACCOUNT"?row:null,validate:async()=>{},findCustomer:async()=>profile} as unknown as AuthGateway;
  const repository=new LocalRepository(db);const uploaded:MediaAsset[]=[];const removed:string[]=[];const failures={remove:false,upload:false};
  const storage:MediaStorage={async upload(file:UploadFile,asset:CleanupAsset){if(failures.upload)throw new AuthError(503,"MEDIA_UNAVAILABLE","File storage is temporarily unavailable.");const result={...asset,url:asset.resource_type==="image"?`https://images.example.test/${randomUUID()}.png`:"",mime_type:file.mime,size_bytes:file.bytes.length};uploaded.push(result);return result;},async remove(asset){if(failures.remove)throw new Error("private provider diagnostic");removed.push(asset.public_id);},async download(){return Buffer.from("%PDF-1.4 test");}};
  const server=createApp({webAppUrl:config.webOrigin,auth:config,gateway,listingsRepository:repository,mediaStorage:storage,dashboardRepository:new ListingsDashboardRepository(repository)}).listen(0,"127.0.0.1");await new Promise<void>(resolve=>server.once("listening",resolve));
  t.after(async()=>{await new Promise<void>(resolve=>{server.close(()=>resolve());server.closeAllConnections();});await db.close();});const address=server.address();if(!address||typeof address==="string")throw new Error("No local server");
  async function request(path="",method="GET",body?:FormData|object,headers:Record<string,string>={}){const response=await fetch(`http://127.0.0.1:${address.port}${path.startsWith("/api/")?path:`/api/v1/listings${path}`}`,{method,headers:{Cookie:`beryl_account=${raw}`,Origin:config.webOrigin,...(body&&!(body instanceof FormData)?{"Content-Type":"application/json"}:{}),...headers},...(body?{body:body instanceof FormData?body:JSON.stringify(body)}:{})});return {response,payload:response.headers.get("content-type")?.includes("application/json")?await response.json():await response.text()};}
  return {db,owner,other,repository,storage,uploaded,removed,failures,request};
}
export function listingForm(content:unknown=validContent,files:{bytes:Uint8Array;mime:string}[]=[{bytes:imageBytes,mime:"image/png"}],extra={}){const body=new FormData();body.set("data",JSON.stringify({content,...extra}));files.forEach(file=>body.append("images",new Blob([new Uint8Array(file.bytes)],{type:file.mime}),"untrusted-filename.png"));return body;}
