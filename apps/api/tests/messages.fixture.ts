import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { randomBytes, randomUUID } from "node:crypto";
import type { TestContext } from "node:test";
import { createApp } from "../src/app.js";
import { authConfigSchema } from "../src/auth/config.js";
import { AuthCipher, hashToken } from "../src/auth/crypto.js";
import type { AuthGateway, Customer, StoredSession } from "../src/auth/gateway.js";
import { checkTicketError, type TicketsRepository, type TicketAsset } from "../src/messages/repository.js";
import type { TicketDetail, TicketSummary } from "../src/messages/model.js";
import type {MediaStorage} from "../src/listings/media.js";
import {MessagesDashboardRepository} from "../src/messages/dashboard-repository.js";

export async function messagesFixture(t:TestContext) {
  const db=new PGlite();
  t.after(()=>db.close());
  await db.exec("create schema auth; create table auth.users(id uuid primary key); create role anon; create role authenticated; create role service_role;");
  await db.exec(await readFile(new URL("../supabase/migrations/202609110001_customer_tickets.sql",import.meta.url),"utf8"));
  await db.exec(await readFile(new URL("../supabase/migrations/202609120001_ticket_attachments_overview.sql",import.meta.url),"utf8"));
  const owner=randomUUID(),other=randomUUID();await db.query("insert into auth.users values($1),($2)",[owner,other]);
  async function rpc<T>(name:string,args:unknown[]):Promise<T> {
    try {return (await db.query<{value:T}>(`select public.${name}(${args.map((_,i)=>`$${i+1}`).join(",")}) as value`,args)).rows[0]!.value;}
    catch(error) {checkTicketError(error as {code:string});throw error;}
  }
  const repository:TicketsRepository={
    list:(o,q)=>rpc<{items:TicketSummary[]}>("list_customer_tickets",[o,q]),
    detail:(o,id)=>rpc<TicketDetail>("read_customer_ticket",[o,id]),
    create:(o,s,m)=>rpc<TicketDetail>("create_customer_ticket",[o,s,m]),
    reply:(o,id,m)=>rpc<TicketDetail>("reply_customer_ticket",[o,id,m]),
    acknowledge:async(o,id,through)=>{await rpc("acknowledge_customer_ticket",[o,id,through]);},
    overview:o=>rpc("customer_ticket_overview",[o]),
    reserveUpload:async(o,id)=>{await rpc("reserve_customer_ticket_upload",[o,id]);},
    saveAttachment:(o,id,subject,message,asset)=>rpc("save_customer_ticket_attachment",[o,id,subject,message,JSON.stringify(asset)]),
    attachment:(o,id,a)=>rpc<TicketAsset>("get_customer_ticket_attachment",[o,id,a]),
    claimCleanup:async o=>(await db.query<{value:string}>("select public.claim_customer_ticket_upload_cleanup($1) as value",[o])).rows.map(row=>row.value),
    forgetUpload:async(o,id)=>{await rpc("forget_customer_ticket_upload",[o,id]);},
  };
  const config=authConfigSchema.parse({webOrigin:"http://localhost:3000",apiOrigin:"http://localhost:4000",supabaseUrl:"https://example.supabase.co",anonKey:"test",serviceKey:"test",encryptionKey:randomBytes(32).toString("base64"),cookieSecure:false,production:false});
  const profile:Customer={id:owner,first_name:"Ada",last_name:"Okafor",email:"ada@example.test",phone_number:null,phone_number_normalized:null,country_code:null,account_type:"INVESTOR",profile_type:"PERSONAL",email_verified_at:new Date().toISOString()};
  const raw="messages-test-session";
  const row:StoredSession={token_hash:hashToken(raw),user_id:owner,purpose:"ACCOUNT",refresh_lock:null,expires_at:new Date(Date.now()+3600000).toISOString(),encrypted_tokens:new AuthCipher(config.encryptionKey).seal({userId:owner,accessToken:"test",refreshToken:"test",expiresAt:Date.now()/1000+3600},"provider-tokens")};
  const gateway={readSession:async(hash:string,purpose:string)=>hash===row.token_hash&&purpose===row.purpose&&Date.parse(row.expires_at)>Date.now()?row:null,validate:async()=>{},findCustomer:async()=>profile} as unknown as AuthGateway;
  const stored=new Map<string,Buffer>(),removed:string[]=[];const storageFailures={upload:false,remove:false};
  const storage:MediaStorage={
    async upload(file,asset){stored.set(asset.public_id,file.bytes);if(storageFailures.upload)throw new Error("Simulated ambiguous provider failure");return {...asset,url:"",mime_type:file.mime,size_bytes:file.bytes.length};},
    async remove(asset){if(storageFailures.remove)throw new Error("Simulated cleanup failure");removed.push(asset.public_id);stored.delete(asset.public_id);},
    async download(asset){const bytes=stored.get(asset.public_id);if(!bytes)throw new Error("Missing test asset");return bytes;},
  };
  const server=createApp({webAppUrl:config.webOrigin,auth:config,gateway,ticketsRepository:repository,mediaStorage:storage,dashboardRepository:new MessagesDashboardRepository(repository,async()=>[])}).listen(0,"127.0.0.1");await new Promise<void>(resolve=>server.once("listening",resolve));
  t.after(()=>new Promise<void>(resolve=>{server.close(()=>resolve());server.closeAllConnections();}));
  const address=server.address();if(!address||typeof address==="string")throw new Error("Missing server");
  async function request(path="",method="GET",body?:object,headers:Record<string,string>={}) {
    const response=await fetch(`http://127.0.0.1:${address.port}${path.startsWith("/api/")?path:`/api/v1/messages/tickets${path}`}`,{method,headers:{Cookie:`beryl_account=${raw}`,Origin:config.webOrigin,...(body&&!(body instanceof FormData)?{"Content-Type":"application/json"}:{}),...headers},...(body?{body:body instanceof FormData?body:JSON.stringify(body)}:{})});
    return {response,payload:response.headers.get("content-type")?.includes("application/json")?await response.json():Buffer.from(await response.arrayBuffer())};
  }
  return {db,owner,other,repository,request,row,profile,storage,stored,removed,storageFailures};
}
