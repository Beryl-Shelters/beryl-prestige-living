import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { PDFDocument } from "pdf-lib";

import { adminConfigSchema } from "../src/admin/config.js";
import { AuthCipher } from "../src/auth/crypto.js";
import { SALES_MANDATE_AGREEMENT_VERSION, SALES_MANDATE_CLAUSES } from "../src/listings/mandate-agreement.js";
import { ResendMandateEmail } from "../src/listings/mandate-email.js";
import { generateSalesMandatePdf } from "../src/listings/mandate-pdf.js";
import { ListingsService } from "../src/listings/service.js";

test("the versioned PDF uses the complete approved ten-clause agreement and printable A4 pages", async () => {
  assert.equal(SALES_MANDATE_AGREEMENT_VERSION, "web-exclusive-sales-mandate-v1");
  assert.deepEqual(SALES_MANDATE_CLAUSES.map(clause => clause.number), [1,2,3,4,5,6,7,8,9,10]);
  assert.match(SALES_MANDATE_CLAUSES[0]!.paragraphs[0]!, /professional fee of 5% of the gross sale price/);
  assert.match(SALES_MANDATE_CLAUSES[1]!.bullets![1]!, /6 months renewable automatically for a further mandate of 6 months/);
  assert.match(SALES_MANDATE_CLAUSES[6]!.bullets![1]!, /minimum of 1% of the gross sale price/);
  assert.match(SALES_MANDATE_CLAUSES[7]!.paragraphs[0]!, /ACCESS TO PROPERTY|view the property/i);
  assert.match(SALES_MANDATE_CLAUSES[8]!.paragraphs[0]!, /signage/i);

  const bytes=await generateSalesMandatePdf({
    propertyReference:"RES-LONG01",propertyTitle:`A ${"Very Long Property Title ".repeat(10)}`,
    propertyAddress:`14 ${"Extraordinary-Long-Unbroken-Address-Section".repeat(10)}, Lekki, Lagos`,
    propertyType:"Residential",propertySubtype:"Terraced Duplexes",registeredTitleDocument:null,
    sellerName:`Ada ${"Long-Seller-Name".repeat(12)}`,sellerEmail:"ada@example.test",sellerTelephone:null,
    generatedAt:"2026-10-14T10:00:00.000Z",
  });
  const pdf=await PDFDocument.load(bytes);
  assert.equal(pdf.getTitle(),"Exclusive Sales Mandate - RES-LONG01");
  assert.equal(pdf.getSubject(),SALES_MANDATE_AGREEMENT_VERSION);
  assert.ok(pdf.getPageCount()>=2,"the complete agreement must paginate");
  for(const page of pdf.getPages()){
    const {width,height}=page.getSize();assert.ok(Math.abs(width-595.28)<0.1);assert.ok(Math.abs(height-841.89)<0.1);
  }
});

test("mandate email uses the authenticated recipient, exact workflow guidance and attached PDF", async () => {
  const config=adminConfigSchema.parse({appOrigin:"http://localhost:3001",resendApiKey:"test-key",inviteFrom:"Beryl Shelter <mandates@example.test>",inviteSeconds:172800,production:false});
  let request:{url:string;body:Record<string,unknown>}|null=null;
  const email=new ResendMandateEmail(config,"https://beryl.example",async(input,init)=>{request={url:String(input),body:JSON.parse(String(init?.body)) as Record<string,unknown>};return new Response(null,{status:202});});
  await email.send({recipient:"registered@example.test",customerName:"Ada <Seller>",propertyReference:"RES-EMAIL1",listingId:"listing-one",pdf:new Uint8Array([37,80,68,70])});
  assert.equal(request!.url,"https://api.resend.com/emails");
  assert.deepEqual(request!.body.to,["registered@example.test"]);
  assert.equal(request!.body.subject,"Beryl Shelter — Your Sales Mandate for RES-EMAIL1");
  const html=String(request!.body.html);assert.match(html,/print it, complete any remaining information and sign it by hand using a pen/);assert.match(html,/remain unpublished/);assert.match(html,/Ada &lt;Seller&gt;/);
  const attachments=request!.body.attachments as Array<{filename:string;content:string}>;assert.equal(attachments[0]!.filename,"Beryl-Shelter-Sales-Mandate-RES-EMAIL1.pdf");assert.equal(attachments[0]!.content,Buffer.from([37,80,68,70]).toString("base64"));
  const failing=new ResendMandateEmail(config,"https://beryl.example",async()=>new Response(null,{status:503}));
  await assert.rejects(failing.send({recipient:"registered@example.test",customerName:"Ada",propertyReference:"RES-EMAIL1",listingId:"listing-one",pdf:new Uint8Array([1])}));
});

test("submission rejects owner-bound handles whose upload journal entry is missing", async () => {
  const owner="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",otherOwner="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",listingId="cccccccc-cccc-4ccc-8ccc-cccccccccccc",versionId="dddddddd-dddd-4ddd-8ddd-dddddddddddd";
  const cipher=new AuthCipher(Buffer.alloc(32,7).toString("base64"));
  const handle=(handleOwner:string)=>cipher.seal({version:1,owner:handleOwner,listing_id:listingId,purpose:"signed-document",expires_at:Date.now()+60000,asset:{public_id:`beryl-v2/mandates/signed/${listingId}/signed.pdf`,resource_type:"raw",delivery_type:"authenticated",url:"",mime_type:"application/pdf",size_bytes:100}},"listing-mandate-upload");
  let validationCalls=0,submissionCalls=0;
  const repository={physicalMandate:async()=>({id:versionId}),validateMandateUploads:async()=>{validationCalls+=1;return false;},createMandateSubmission:async()=>{submissionCalls+=1;return "submission";}};
  const service=new ListingsService(repository as never,{} as never,cipher);
  await assert.rejects(service.submitPhysicalMandate(owner,listingId,{version_id:versionId,documents:[{upload_id:handle(otherOwner),title:"Stolen.pdf"}]}),error=>(error as {code?:string}).code==="INVALID_UPLOAD");
  assert.equal(validationCalls,0,"cross-owner handles must fail before repository access");
  await assert.rejects(service.submitPhysicalMandate(owner,listingId,{version_id:versionId,documents:[{upload_id:handle(owner),title:"Missing.pdf"}]}),error=>(error as {code?:string}).code==="INVALID_UPLOAD");
  assert.equal(validationCalls,1);assert.equal(submissionCalls,0);
});

test("physical mandate history gates publication, protects latest evidence and grandfathers listed property", async t => {
  const db=new PGlite();t.after(()=>db.close());
  const owner="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",reviewer="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",listing="cccccccc-cccc-4ccc-8ccc-cccccccccccc",listed="dddddddd-dddd-4ddd-8ddd-dddddddddddd",legacyPending="eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
  await db.exec("create schema auth; create function auth.uid() returns uuid language sql stable as 'select null::uuid'; create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_app_meta_data jsonb default '{}',raw_user_meta_data jsonb default '{}'); create role anon; create role authenticated; create role service_role bypassrls;");
  await db.query("insert into auth.users(id,email,email_confirmed_at) values($1,'seller@example.test',now()),($2,'admin@example.test',now())",[owner,reviewer]);
  const migrations=["202609060001_customer_auth_foundation.sql","202609080001_customer_listings.sql","202609100001_short_display_codes.sql","202609160001_public_analytics.sql","202609180002_listing_taxonomy.sql","202609250001_sales_mandates.sql","202609260005_listing_dashboard_review.sql","202609270003_admin_invitations.sql","202609280001_admin_property_moderation.sql"];
  for(const migration of migrations)await db.exec(await readFile(new URL(`../supabase/migrations/${migration}`,import.meta.url),"utf8"));
  await db.query("insert into customer_profiles(id,first_name,last_name,email,country_code,phone_number,phone_number_normalized,account_type,profile_type,email_verified_at) values($1,'Ada','Seller','seller@example.test','+234','8011111111','+2348011111111','INVESTOR','PERSONAL',now())",[owner]);
  await db.query("insert into admin_profiles(user_id,full_name,email,phone_normalized,department,admin_role,active,accepted_at) values($1,'Review Admin','admin@example.test','+2348022222222','MANAGEMENT','ADMIN',true,now())",[reviewer]);
  const insertListing="insert into customer_listings(id,user_id,listing_code,title,description,occupancy_type,ownership_type,property_type,property_subtype,has_lien,bedrooms,bathrooms,parking_spaces,facilities,property_cost_minor,minimum_down_payment_minor,location,state,city,listing_status,requested_at) values($1,$2,$3,$4,'Controlled property description','Residential','Personal','Residential','Bungalow',false,3,2,1,'{}',50000000,5000000,'Ikeja address','Lagos','Ikeja',$5,case when $5='LISTED' then now() else null end)";
  await db.query(insertListing,[listing,owner,"RES-PHYS01","Physical Mandate Property","UNLISTED"]);await db.query(insertListing,[listed,owner,"RES-LEGACY","Existing Listed Property","LISTED"]);await db.query(insertListing,[legacyPending,owner,"RES-PENDING","Existing Pending Property","PENDING"]);
  await db.query("insert into customer_listing_images(listing_id,public_id,resource_type,delivery_type,url,mime_type,size_bytes,sort_order) values($1,'property-image','image','upload','https://images.example.test/property.png','image/png',100,0)",[listing]);
  await db.exec(await readFile(new URL("../supabase/migrations/202610140001_physical_sales_mandates.sql",import.meta.url),"utf8"));
  assert.deepEqual((await db.query<{listing_code:string;requires_signed_mandate:boolean}>("select listing_code,requires_signed_mandate from customer_listings order by listing_code")).rows,[{listing_code:"RES-LEGACY",requires_signed_mandate:false},{listing_code:"RES-PENDING",requires_signed_mandate:false},{listing_code:"RES-PHYS01",requires_signed_mandate:true}]);

  const version1=(await db.query<{id:string}>("select create_listing_mandate_version($1,$2,$3,$4,$5,$6,100,now()) id",[owner,listing,SALES_MANDATE_AGREEMENT_VERSION,JSON.stringify({agreement:{version:SALES_MANDATE_AGREEMENT_VERSION},property:{reference:"RES-PHYS01"}}),"1".repeat(64),"generated-v1.pdf"])).rows[0]!.id;
  const signed1=`beryl-v2/mandates/signed/${listing}/signed-v1.pdf`;
  await db.query("insert into customer_listing_media_cleanup(public_id,user_id,resource_type,delivery_type) values($1,$2,'raw','authenticated')",[signed1,owner]);
  const submission1=(await db.query<{id:string}>("select create_listing_mandate_submission($1,$2,$3,$4) id",[owner,listing,version1,JSON.stringify([{title:"signed-v1.pdf",public_id:signed1,mime_type:"application/pdf",size_bytes:100,sort_order:0}])])).rows[0]!.id;
  await db.query("select review_listing_mandate('RES-PHYS01',$1,$2,'APPROVE',null)",[submission1,reviewer]);
  const version2=(await db.query<{id:string}>("select create_listing_mandate_version($1,$2,$3,$4,$5,$6,101,now()) id",[owner,listing,SALES_MANDATE_AGREEMENT_VERSION,JSON.stringify({agreement:{version:SALES_MANDATE_AGREEMENT_VERSION},property:{reference:"RES-PHYS01",title:"Updated"}}),"2".repeat(64),"generated-v2.pdf"])).rows[0]!.id;
  const signed2=`beryl-v2/mandates/signed/${listing}/signed-v2.pdf`,forged=`beryl-v2/mandates/signed/${listing}/forged.pdf`;
  await db.query("insert into customer_listing_media_cleanup(public_id,user_id,resource_type,delivery_type) values($1,$2,'raw','authenticated'),($3,$4,'raw','authenticated')",[signed2,owner,forged,reviewer]);
  await assert.rejects(db.query("select create_listing_mandate_submission($1,$2,$3,$4)",[owner,listing,version2,JSON.stringify([{title:"forged.pdf",public_id:forged,mime_type:"application/pdf",size_bytes:101,sort_order:0}])]),/upload was not found/i);
  const submission2=(await db.query<{id:string}>("select create_listing_mandate_submission($1,$2,$3,$4) id",[owner,listing,version2,JSON.stringify([{title:"signed-v2.pdf",public_id:signed2,mime_type:"application/pdf",size_bytes:101,sort_order:0}])])).rows[0]!.id;
  await assert.rejects(db.query("select create_listing_mandate_submission($1,$2,$3,$4)",[owner,listing,version2,JSON.stringify([{title:"duplicate.pdf",public_id:signed2,mime_type:"application/pdf",size_bytes:101,sort_order:0}])]),/active submission/);
  await db.query("select submit_customer_listing($1,$2)",[owner,listing]);
  const firstPendingVersion=(await db.query<{version:number}>("select version from customer_listings where id=$1",[listing])).rows[0]!.version;
  await assert.rejects(db.query("select review_admin_property('RES-PHYS01',$1,'APPROVE',$2,null)",[reviewer,firstPendingVersion]),/Approved signed Sales Mandate required/);
  await assert.rejects(db.query("select review_listing_mandate('RES-PHYS01',$1,$2,'APPROVE',null)",[submission1,reviewer]),/latest mandate version|not awaiting review/i);
  await db.query("select review_listing_mandate('RES-PHYS01',$1,$2,'REJECT','Upload every signed page clearly.')",[submission2,reviewer]);
  assert.deepEqual((await db.query<{listing_status:string;rejection_reason:string}>("select listing_status,rejection_reason from customer_listings where id=$1",[listing])).rows[0],{listing_status:"REJECTED",rejection_reason:"Upload every signed page clearly."});
  const signed3=`beryl-v2/mandates/signed/${listing}/signed-v2-corrected.pdf`;
  await db.query("insert into customer_listing_media_cleanup(public_id,user_id,resource_type,delivery_type) values($1,$2,'raw','authenticated')",[signed3,owner]);
  const submission3=(await db.query<{id:string}>("select create_listing_mandate_submission($1,$2,$3,$4) id",[owner,listing,version2,JSON.stringify([{title:"signed-v2-corrected.pdf",public_id:signed3,mime_type:"application/pdf",size_bytes:102,sort_order:0}])])).rows[0]!.id;
  await db.query("select submit_customer_listing($1,$2)",[owner,listing]);
  const resubmitted=(await db.query<{listing_status:string;rejection_reason:string|null;rejected_at:string|null;version:number}>("select listing_status,rejection_reason,rejected_at,version from customer_listings where id=$1",[listing])).rows[0]!;
  assert.deepEqual({listing_status:resubmitted.listing_status,rejection_reason:resubmitted.rejection_reason,rejected_at:resubmitted.rejected_at},{listing_status:"PENDING",rejection_reason:null,rejected_at:null});
  await assert.rejects(db.query("select review_admin_property('RES-PHYS01',$1,'APPROVE',$2,null)",[reviewer,resubmitted.version]),/Approved signed Sales Mandate required/);
  await db.query("select review_listing_mandate('RES-PHYS01',$1,$2,'APPROVE',null)",[submission3,reviewer]);
  await db.query("select review_admin_property('RES-PHYS01',$1,'APPROVE',$2,null)",[reviewer,resubmitted.version]);
  assert.equal((await db.query<{listing_status:string}>("select listing_status from customer_listings where id=$1",[listing])).rows[0]!.listing_status,"LISTED");

  await db.query("update customer_listings set listing_status='REJECTED' where id=$1",[legacyPending]);
  await db.query("update customer_listings set requires_signed_mandate=true where id=$1",[legacyPending]);
  await db.query("update customer_listings set listing_status='PENDING' where id=$1",[legacyPending]);
  await assert.rejects(db.query("update customer_listings set listing_status='LISTED' where id=$1",[legacyPending]),/Approved signed Sales Mandate required/);

  for(const asset of ["generated-v2.pdf",signed2]){await db.query("insert into customer_listing_media_cleanup(public_id,user_id,resource_type,delivery_type,created_at,detached) values($1,$2,'raw','authenticated',now()-interval '2 hours',true)",[asset,owner]);assert.equal((await db.query<{claimed:boolean}>("select claim_customer_listing_cleanup($1,$2,'raw','authenticated') claimed",[owner,asset])).rows[0]!.claimed,false);}
  await assert.rejects(db.query("delete from customer_listings where id=$1",[listing]),/foreign key|violates/i);
  const rpcSignatures=[
    "public.claim_customer_listing_cleanup(uuid,text,text,text)",
    "public.create_listing_mandate_version(uuid,uuid,text,jsonb,text,text,bigint,timestamp with time zone)",
    "public.record_listing_mandate_email(uuid,uuid,boolean)",
    "public.create_listing_mandate_submission(uuid,uuid,uuid,jsonb)",
    "public.review_listing_mandate(text,uuid,uuid,text,text)",
    "public.submit_customer_listing(uuid,uuid)",
    "public.review_admin_property(text,uuid,text,integer,text)",
  ];
  for(const role of ["anon","authenticated"]){for(const signature of rpcSignatures){assert.equal((await db.query<{allowed:boolean}>("select has_function_privilege($1,$2,'execute') allowed",[role,signature])).rows[0]!.allowed,false);}}
  for(const signature of rpcSignatures){assert.equal((await db.query<{allowed:boolean}>("select has_function_privilege('service_role',$1,'execute') allowed",[signature])).rows[0]!.allowed,true);}
  assert.equal((await db.query<{allowed:boolean}>("select has_function_privilege('service_role','public.enforce_signed_mandate_publication()','execute') allowed")).rows[0]!.allowed,false);
  await db.exec("set role anon");await assert.rejects(db.query("select create_listing_mandate_version($1,$2,'x','{}','"+"3".repeat(64)+"','x.pdf',1,now())",[owner,listing]));await db.exec("reset role");
});
