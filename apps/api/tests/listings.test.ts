import assert from "node:assert/strict";
import {test} from "node:test";
import {randomUUID} from "node:crypto";
import {completeness,listingOptions,minorUnits,parseContent} from "../src/listings/model.js";
import {planAsset} from "../src/listings/media.js";
import {ListingsService} from "../src/listings/service.js";
import {validateFile} from "../src/listings/uploads.js";
import {imageBytes,listingFixture,listingForm,validContent} from "./listings.fixture.js";

function assertNoProviderDetails(value: unknown) {
  const forbidden = new Set(["public_id", "signature_public_id", "resource_type", "delivery_type", "url"]);
  const visit = (entry: unknown): void => {
    if (Array.isArray(entry)) return entry.forEach(visit);
    if (!entry || typeof entry !== "object") return;
    for (const [key, child] of Object.entries(entry)) {
      assert.equal(forbidden.has(key), false, `customer response exposed provider field ${key}`);
      visit(child);
    }
  };
  visit(value);
}

test("Listings API and actual local migration transactions",async t=>{
  const f=await listingFixture(t);let id="",version=1;
  await t.test("requires account session and trusted mutation origin",async()=>{assert.equal((await f.request("","GET",undefined,{Cookie:""})).response.status,401);assert.equal((await f.request("","POST",listingForm(),{Origin:"https://evil.example"})).response.status,403);assert.equal(f.uploaded.length,0);});
  await t.test("valid create generates immutable code, exact kobo and ordered images",async()=>{const {response,payload}=await f.request("","POST",listingForm(validContent,[{bytes:imageBytes,mime:"image/png"},{bytes:imageBytes,mime:"image/png"}]));assert.equal(response.status,201,JSON.stringify(payload));id=payload.data.id;version=payload.data.version;assert.match(payload.data.listing_code,/^RES-[A-HJ-NP-Z2-9]{6}$/);assert.equal(payload.data.property_cost_minor,5000000001);assert.equal(payload.data.listing_status,"UNLISTED");assert.deepEqual(payload.data.images.map((i:{sort_order:number})=>i.sort_order),[0,1]);assert.equal(payload.data.toilet_count,null);assert.equal(payload.data.leads,0);assert.equal(payload.data.views,0);assert(!("user_id" in payload.data));assert(!JSON.stringify(payload).includes("public_id"));});
  await t.test("required fields, amounts, coordinates, owner and moderation spoofing are rejected before storage",async()=>{const count=f.uploaded.length;for(const change of [{title:""},{property_cost:"0"},{minimum_down_payment:"60000000"},{minimum_down_payment:"-1"},{property_cost:"1e9"},{longitude:181},{latitude:-91},{user_id:f.other},{listing_status:"LISTED"},{listing_status:"REJECTED"},{listing_code:"FORGED"},{completeness:100},{year_built:3000}])assert.equal((await f.request("","POST",listingForm({...validContent,...change}))).response.status,400);assert.equal(f.uploaded.length,count);});
  await t.test("foreign ownership is hidden for read, edit, delete, approval and uploads",async()=>{const asset={...f.uploaded[0]!,public_id:`foreign-${randomUUID()}`,id:randomUUID(),sort_order:0};await f.repository.journal(f.other,asset);const foreign=await f.repository.mutate(f.other,{action:"CREATE",id:null,version:null,content:parseContent(validContent),images:[asset]});for(const [path,method,body] of [[`/${foreign}`,"GET",undefined],[`/${foreign}`,"PATCH",listingForm(validContent,[],{version:1})],[`/${foreign}`,"DELETE",{version:1}],[`/${foreign}/request-approval`,"POST",{version:1}],[`/${foreign}/documents`,"POST",listingForm()]] as const)assert.equal((await f.request(path,method,body)).response.status,404);const list=await f.request();assert.deepEqual(list.payload.data.items.map((v:{id:string})=>v.id),[id]);assert.equal((await f.request("?user_id="+f.other)).response.status,400);});
  await t.test("editing retains omitted existing images; explicit removal keeps deterministic order",async()=>{const before=await f.repository.get(f.owner,id);const edited=await f.request(`/${id}`,"PATCH",listingForm({...validContent,title:"Updated property"},[],{version}));assert.equal(edited.response.status,200);version=edited.payload.data.version;assert.deepEqual(edited.payload.data.images.map((i:{id:string})=>i.id),before!.images.map(i=>i.id));assert.equal(edited.payload.data.listing_code,before!.listing_code);const keep=edited.payload.data.images[1].id;const removed=await f.request(`/${id}`,"PATCH",listingForm(validContent,[],{version,retained_images:[keep]}));assert.equal(removed.response.status,200);version=removed.payload.data.version;assert.equal(removed.payload.data.images.length,1);assert.equal(removed.payload.data.images[0].sort_order,0);assert(f.removed.includes(before!.images[0]!.public_id));});
  await t.test("approval, stale version, pending edit protection and unlist transitions",async()=>{
    assert.equal((await f.request(`/${id}/request-approval`,"POST",{version})).response.status,409);
    const sigAsset=await f.storage.upload({field:"signature",mime:"image/png",bytes:imageBytes},planAsset({field:"signature",mime:"image/png",bytes:imageBytes},false,true));
    await f.repository.journal(f.owner,sigAsset);
    const docAsset=await f.storage.upload({field:"documents",mime:"application/pdf",bytes:Buffer.from("%PDF-1.4 test")},planAsset({field:"documents",mime:"application/pdf",bytes:Buffer.from("%PDF-1.4 test")},false,false,true));
    await f.repository.journal(f.owner,docAsset);
    await f.repository.mutateMandate(f.owner,id,{seller_title:"Mr",surname:"Doe",first_names:"John",gender:"Male",email:"john@example.com",telephone:"08012345678",date_of_birth:"1980-01-01",nationality:"Nigerian",post_code:"100001",address:"123 Street",property_development_name:"Beryl Estate",document_title:"C of O",signer_name:"John A. Doe",signer_address:"456 Signer Street",signer_email:"signer@example.com",mandate_date:"2026-09-23",agreed_to_mandate:true,signature_public_id:sigAsset.public_id,signature_mime_type:"image/png",signature_size_bytes:sigAsset.size_bytes},[{...docAsset,title:"Title Deed"}]);
    const approved=await f.request(`/${id}/submit`,"POST",{});
    assert.equal(approved.response.status,201);
    assert.equal(approved.payload.data.listing_status,"PENDING");
    assert(approved.payload.data.requested_at);
    version=approved.payload.data.version;
    assert.equal((await f.request(`/${id}/unlist`,"POST",{version:version-1})).response.status,409);
    assert.equal((await f.request(`/${id}`,"PATCH",listingForm(validContent,[],{version}))).response.status,409);
    assert.equal((await f.request(`/${id}/submit`,"POST",{})).response.status,409);
    const unlisted=await f.request(`/${id}/unlist`,"POST",{version});
    assert.equal(unlisted.response.status,200);
    assert.equal(unlisted.payload.data.listing_status,"UNLISTED");
    version=unlisted.payload.data.version;
  });
  await t.test("private single-document upload and owner download",async()=>{const body=new FormData();body.set("data",JSON.stringify({title:"Ownership papers",document_type:"Ownership",description:"First document",version}));body.set("document",new Blob(["%PDF-1.4 test"],{type:"application/pdf"}),"../../unsafe.pdf");const result=await f.request(`/${id}/documents`,"POST",body);assert.equal(result.response.status,201,JSON.stringify(result.payload));version=result.payload.data.version;const docs=result.payload.data.documents;assert.equal(docs.length,1);assert.equal(docs[0].description,"First document");assert.equal(docs[0].sort_order,0);assert(!JSON.stringify(docs).includes("public_id"));assert(!JSON.stringify(docs).includes("url"));assert(f.uploaded.filter(v=>v.resource_type==="raw").every(v=>v.delivery_type==="authenticated"));const download=await f.request(`/${id}/documents/${docs[0].id}`);assert.equal(download.response.status,200);assert.match(download.response.headers.get("content-disposition")??"",/^attachment;/);});
  await t.test("search, status, pagination and Dashboard recent listings are owner scoped",async()=>{const listed=await f.request("?q=Duplex&page_size=1");assert.equal(listed.payload.data.total,1);assert.equal(listed.payload.data.page_size,1);assert.equal((await f.request("?status=PENDING")).payload.data.total,0);const code=(await f.repository.get(f.owner,id))!.listing_code;assert.equal((await f.request(`?q=${code}`)).payload.data.total,1);assert.equal((await f.request("?page=2&page_size=1")).payload.data.items.length,0);const dashboard=await f.request("/api/v1/dashboard/overview");assert.deepEqual(dashboard.payload.data.recent_property_listings.map((v:{id:string})=>v.id),[id]);assert.equal(dashboard.payload.data.summary.total_investments,0);});
  await t.test("hard deletion cascades rows; provider failure leaves durable cleanup without failing deletion",async()=>{f.failures.remove=true;const result=await f.request(`/${id}`,"DELETE",{version});assert.equal(result.response.status,200);assert.equal((await f.request(`/${id}`)).response.status,404);assert.equal((await f.db.query("select id from public.customer_listing_documents where listing_id=$1",[id])).rows.length,0);const queued=await f.db.query("select * from public.customer_listing_media_cleanup where user_id=$1",[f.owner]);assert.equal(queued.rows.length,4);await f.db.query("update public.customer_listing_media_cleanup set created_at=clock_timestamp()-interval '2 hours' where user_id=$1",[f.owner]);f.failures.remove=false;await new ListingsService(f.repository,f.storage).cleanup(f.owner);assert.equal((await f.db.query("select * from public.customer_listing_media_cleanup where user_id=$1",[f.owner])).rows.length,0);});
  await t.test("SQL rollback, immutable identity, constraints, RLS and service-only function permissions",async()=>{const content=parseContent(validContent);await assert.rejects(()=>f.repository.mutate(f.owner,{action:"CREATE",id:null,version:null,content,images:[]}));assert.equal((await f.repository.list(f.owner,{q:"",page:1,page_size:10})).total,0);const {rows}=await f.db.query<{enabled:boolean;table_name:string}>("select relname as table_name,relrowsecurity as enabled from pg_class where relname in ('customer_listings','customer_listing_images','customer_listing_documents','customer_listing_media_cleanup','sales_mandates','sales_mandate_documents')");assert.equal(rows.length,6);assert(rows.every(r=>r.enabled));for(const role of ["anon","authenticated"]){for(const table of ["customer_listings","sales_mandates","sales_mandate_documents"]){const privilege=await f.db.query<{allowed:boolean}>("select has_table_privilege($1,$2,'select') as allowed",[role,`public.${table}`]);assert.equal(privilege.rows[0]!.allowed,false);}for(const signature of ["public.mutate_customer_listing(uuid,uuid,text,integer,jsonb,jsonb,jsonb)","public.mutate_sales_mandate(uuid,uuid,jsonb,jsonb)","public.submit_customer_listing(uuid,uuid)"]){const execute=await f.db.query<{allowed:boolean}>("select has_function_privilege($1,$2,'execute') as allowed",[role,signature]);assert.equal(execute.rows[0]!.allowed,false);}}const foreign=(await f.repository.list(f.other,{q:"",page:1,page_size:10})).items[0]!;await assert.rejects(()=>f.db.query("update public.customer_listings set listing_code='FORGED' where id=$1",[foreign.id]));await assert.rejects(()=>f.db.query("update public.customer_listings set minimum_down_payment_minor=property_cost_minor+1 where id=$1",[foreign.id]));});
});

test("listing completeness and exact money are deterministic, bounded and not browser-authoritative",()=>{assert.equal(minorUnits("9999999999999.99"),999999999999999);assert.equal(minorUnits("0.01"),1);assert.throws(()=>minorUnits("1.001"));const listing={...parseContent(validContent),images:[{}],facilities:[]} as Parameters<typeof completeness>[0];assert.equal(completeness(listing),80);assert.equal(completeness({...listing,units:2,land_area:100,year_built:2020,longitude:0,latitude:0,facilities:["CCTV"]}),100);});
test("image/document MIME magic, file-size and executable restrictions",()=>{validateFile({field:"images",mime:"image/png",bytes:imageBytes},false);for(const [mime,bytes,document] of [["image/png",Buffer.from("MZ executable"),false],["application/pdf",Buffer.from("%PDF-1.4"),false],["image/webp",imageBytes,true],["image/png",Buffer.alloc(5242881),false],["application/pdf",Buffer.alloc(10485761),true]] as const)assert.throws(()=>validateFile({field:"x",mime,bytes},document));});
test("expanded listing taxonomy accepts all states, subtypes and conveniences while rejecting unsupported values",async t=>{
  assert.equal(listingOptions.state.length,37);
  assert.equal(new Set(listingOptions.state).size,37);
  for(const state of listingOptions.state) assert.equal(parseContent({...validContent,state}).state,state);
  for(const subtype of listingOptions.property_subtype) assert.equal(parseContent({...validContent,property_subtype:subtype}).property_subtype,subtype);
  for(const facility of listingOptions.facilities) assert.deepEqual(parseContent({...validContent,facilities:[facility]}).facilities,[facility]);
  for(const invalid of [{state:"Atlantis"},{property_subtype:"Villa"},{facilities:["Pool"]},{bedrooms:101},{bathrooms:101},{bedrooms:-1},{bathrooms:1.5}])assert.throws(()=>parseContent({...validContent,...invalid}));
  const f=await listingFixture(t);
  const created=await f.request("","POST",listingForm({...validContent,state:"Rivers",property_subtype:"Detached Duplexes",bedrooms:7,bathrooms:12,facilities:["Children Play Area","Tennis Court","Basketball Court"]}));
  assert.equal(created.response.status,201,JSON.stringify(created.payload));
  assert.equal(created.payload.data.listing_status,"UNLISTED");
  assert.deepEqual(created.payload.data.facilities,["Children Play Area","Tennis Court","Basketball Court"]);
  const edited=await f.request(`/${created.payload.data.id}`,"PATCH",listingForm({...validContent,state:"Federal Capital Territory (FCT)",property_subtype:"Block of flats",bedrooms:8,bathrooms:9,facilities:["Swimming Pool","Air Conditioning"]},[],{version:created.payload.data.version}));
  assert.equal(edited.response.status,200,JSON.stringify(edited.payload));
  assert.equal(edited.payload.data.property_subtype,"Block of flats");
  assert.equal(edited.payload.data.state,"Federal Capital Territory (FCT)");
  assert.equal(edited.payload.data.bedrooms,8);
  assert.deepEqual(edited.payload.data.facilities,["Swimming Pool","Air Conditioning"]);
});

test("sales mandate uploads, submission constraints, privacy, and cleanup", async t => {
  const f = await listingFixture(t);
  const created = await f.request("", "POST", listingForm(validContent));
  assert.equal(created.response.status, 201);
  const id = created.payload.data.id;

  // 1. Signature MIME and size validation
  // Valid PNG signature accepted
  const sigBody = new FormData();
  sigBody.set("signature", new Blob([imageBytes], { type: "image/png" }), "sig.png");
  const sigReq = await f.request(`/${id}/mandate/signature`, "POST", sigBody);
  assert.equal(sigReq.response.status, 201);
  assertNoProviderDetails(sigReq.payload.data);
  const sigUpload = sigReq.payload.data;
  const sigAsset = f.uploaded.at(-1)!;
  assert.equal(sigUpload.mime_type, "image/png");
  assert.equal(typeof sigUpload.upload_id, "string");

  // JPEG signature rejected
  const jpegBody = new FormData();
  jpegBody.set("signature", new Blob([Buffer.from([255, 216, 255, 224, 0, 16, 74, 70, 73, 70])], { type: "image/jpeg" }), "sig.jpg");
  assert.equal((await f.request(`/${id}/mandate/signature`, "POST", jpegBody)).response.status, 400);

  // PDF signature rejected
  const pdfBody = new FormData();
  pdfBody.set("signature", new Blob([Buffer.from("%PDF-1.4 test")], { type: "application/pdf" }), "sig.pdf");
  assert.equal((await f.request(`/${id}/mandate/signature`, "POST", pdfBody)).response.status, 400);

  // Fake PNG MIME with non-PNG bytes rejected
  const fakePngBody = new FormData();
  fakePngBody.set("signature", new Blob([Buffer.from("not a real png")], { type: "image/png" }), "fake.png");
  assert.equal((await f.request(`/${id}/mandate/signature`, "POST", fakePngBody)).response.status, 400);

  // >2 MiB signature rejected
  const bigPng = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), Buffer.alloc(2 * 1024 * 1024 + 10)]);
  const bigSigBody = new FormData();
  bigSigBody.set("signature", new Blob([bigPng], { type: "image/png" }), "big.png");
  assert.equal((await f.request(`/${id}/mandate/signature`, "POST", bigSigBody)).response.status, 400);

  // 2. Mandate document validation
  // Multiple documents (up to 10) accepted
  const docsBody = new FormData();
  docsBody.set("data", JSON.stringify(["Title Deed 1", "Survey Plan 2"]));
  docsBody.append("documents", new Blob([Buffer.from("%PDF-1.4 doc 1")], { type: "application/pdf" }), "doc1.pdf");
  docsBody.append("documents", new Blob([imageBytes], { type: "image/png" }), "doc2.png");
  const docsReq = await f.request(`/${id}/mandate/documents`, "POST", docsBody);
  assert.equal(docsReq.response.status, 201);
  assertNoProviderDetails(docsReq.payload.data);
  const docsUploads = docsReq.payload.data;
  const docsAssets = f.uploaded.slice(-2);
  assert.equal(docsUploads.length, 2);
  const docsPayload = docsUploads.map(({ upload_id, title }: { upload_id:string;title:string }) =>
    ({ kind: "upload" as const, upload_id, title }));

  // >10 documents rejected
  const tooManyBody = new FormData();
  const titles = Array.from({ length: 11 }, (_, i) => `Doc ${i}`);
  tooManyBody.set("data", JSON.stringify(titles));
  for (let i = 0; i < 11; i++) {
    tooManyBody.append("documents", new Blob([imageBytes], { type: "image/png" }), `doc${i}.png`);
  }
  assert.equal((await f.request(`/${id}/mandate/documents`, "POST", tooManyBody)).response.status, 400);

  // Invalid document MIME rejected
  const invalidDocBody = new FormData();
  invalidDocBody.set("data", JSON.stringify(["Invalid"]));
  invalidDocBody.append("documents", new Blob([Buffer.from("text file")], { type: "text/plain" }), "doc.txt");
  assert.equal((await f.request(`/${id}/mandate/documents`, "POST", invalidDocBody)).response.status, 400);

  // 3. Mandate submission constraints
  // Missing mandate blocks submission
  assert.equal((await f.request(`/${id}/submit`, "POST", {})).response.status, 409);

  // Save mandate with required fields including document_title and mandate_date
  const mandateData = {
    content: {
      seller_title: "Mr", surname: "Doe", first_names: "John", gender: "Male", email: "john@example.com",
      telephone: "08012345678",
      date_of_birth: "1980-01-01", nationality: "Nigerian", post_code: "100001", address: "123 Street",
      property_development_name: "Beryl Estate", document_title: "Certificate of Occupancy",
      signer_name: "John Authorised Signer", signer_address: "456 Signer Street", signer_email: "signer@example.com",
      mandate_date: "2026-09-23", agreed_to_mandate: false
    },
    signature: { kind: "upload" as const, upload_id: sigUpload.upload_id },
    documents: docsPayload
  };
  const mandateReq = await f.request(`/${id}/mandates`, "POST", mandateData);
  assert.equal(mandateReq.response.status, 201);
  assertNoProviderDetails(mandateReq.payload.data);
  assert.equal(mandateReq.payload.data.has_signature, true);
  assert.equal(mandateReq.payload.data.document_title, "Certificate of Occupancy");
  assert.equal(mandateReq.payload.data.telephone, "08012345678");
  assert.equal(mandateReq.payload.data.signer_name, "John Authorised Signer");
  assert.equal(mandateReq.payload.data.signer_address, "456 Signer Street");
  assert.equal(mandateReq.payload.data.signer_email, "signer@example.com");
  assert.equal(mandateReq.payload.data.mandate_date, "2026-09-23");
  assert.equal(mandateReq.payload.data.agreed_to_mandate, false);
  assert.equal(mandateReq.payload.data.documents.length, 2);
  const listingAfterMandate = await f.request(`/${id}`, "GET");
  const listingJson = JSON.stringify(listingAfterMandate.payload);
  for (const privateValue of ["1980-01-01", "John Authorised Signer", "456 Signer Street", "signer@example.com", sigAsset.public_id])
    assert.equal(listingJson.includes(privateValue), false);

  // Owner can retrieve own mandate
  const getMandate = await f.request(`/${id}/mandate`, "GET");
  assert.equal(getMandate.response.status, 200);
  assertNoProviderDetails(getMandate.payload.data);
  assert.equal(getMandate.payload.data.document_title, "Certificate of Occupancy");
  assert.equal(getMandate.payload.data.telephone, "08012345678");
  assert.equal(getMandate.payload.data.signer_name, "John Authorised Signer");

  // A draft may persist with consent false, but authoritative submission rejects it.
  assert.equal((await f.request(`/${id}/submit`, "POST", {})).response.status, 409);
  const consentedData = {
    content: { ...mandateData.content, agreed_to_mandate: true },
    signature: { kind: "existing" as const },
    documents: mandateReq.payload.data.documents.map((document: {id:string}) => ({ kind: "existing" as const, id: document.id }))
  };
  const consented = await f.request(`/${id}/mandates`, "POST", consentedData);
  assert.equal(consented.response.status, 201);

  // 4. Submit listing: UNLISTED -> PENDING
  const submit = await f.request(`/${id}/submit`, "POST", {});
  assert.equal(submit.response.status, 201);
  assert.equal(submit.payload.data.listing_status, "PENDING");
  assert.ok(submit.payload.data.requested_at);

  // Mandate submitted_at is set in DB
  const { rows: mandateRows } = await f.db.query("select submitted_at from public.sales_mandates where listing_id=$1", [id]);
  assert.ok(mandateRows[0]?.submitted_at);

  // Old REQUEST_APPROVAL cannot bypass or change status
  const oldApproval = await f.request(`/${id}/request-approval`, "POST", { version: submit.payload.data.version });
  assert.equal(oldApproval.response.status, 409);

  // 5. Security & Authorization
  // Foreign user cannot view mandate, upload, mutate, or submit
  const f2 = await listingFixture(t);
  assert.equal((await f2.request(`/${id}/mandate`, "GET")).response.status, 404);
  assert.equal((await f2.request(`/${id}/mandates`, "POST", mandateData)).response.status, 404);
  assert.equal((await f2.request(`/${id}/mandate/signature`, "POST", sigBody)).response.status, 404);
  assert.equal((await f2.request(`/${id}/mandate/documents`, "POST", docsBody)).response.status, 404);
  assert.equal((await f2.request(`/${id}/submit`, "POST", {})).response.status, 404);
  assert.equal((await f2.request(`/${id}/mandate/signature`, "GET")).response.status, 404);
  assert.equal((await f2.request(`/${id}/mandate/documents/${mandateReq.payload.data.documents[0].id}`, "GET")).response.status, 404);

  // Unauthenticated user is rejected
  const unauthResp = await f.request(`/${id}/mandate`, "GET", undefined, { Cookie: "" });
  assert.ok([401, 403].includes(unauthResp.response.status));

  // Owner can download signature and mandate document
  const downloadSig = await f.request(`/${id}/mandate/signature`, "GET");
  assert.equal(downloadSig.response.status, 200);
  assert.equal(downloadSig.response.headers.get("content-type"), "image/png");

  const downloadDoc = await f.request(`/${id}/mandate/documents/${consented.payload.data.documents[0].id}`, "GET");
  assert.equal(downloadDoc.response.status, 200);

  // 6. Signature replacement order and compensation
  // Unlist property first to allow edits
  const unlistReq = await f.request(`/${id}/unlist`, "POST", { version: submit.payload.data.version });
  assert.equal(unlistReq.response.status, 200);
  const unlistedVersion = unlistReq.payload.data.version;

  // Upload new signature
  const newSigBody = new FormData();
  newSigBody.set("signature", new Blob([imageBytes], { type: "image/png" }), "new_sig.png");
  const newSigReq = await f.request(`/${id}/mandate/signature`, "POST", newSigBody);
  assert.equal(newSigReq.response.status, 201);
  assertNoProviderDetails(newSigReq.payload.data);
  const newSigUpload = newSigReq.payload.data;
  const newSigAsset = f.uploaded.at(-1)!;
  assert.notEqual(newSigAsset.public_id, sigAsset.public_id);
  await f.db.exec("select pg_sleep(0.01)");

  // Replace signature on mandate
  const updatedMandateData = {
    ...consentedData,
    documents: consented.payload.data.documents.map((document: {id:string}) => ({ kind: "existing" as const, id: document.id })),
    signature: { kind: "upload" as const, upload_id: newSigUpload.upload_id }
  };
  const updateMandateReq = await f.request(`/${id}/mandates`, "POST", updatedMandateData);
  assert.equal(updateMandateReq.response.status, 201);
  assertNoProviderDetails(updateMandateReq.payload.data);
  assert.equal(updateMandateReq.payload.data.has_signature, true);
  assert.notEqual(updateMandateReq.payload.data.signed_at, mandateReq.payload.data.signed_at);

  // Old signature public_id is queued/removed from storage
  assert.ok(f.removed.includes(sigAsset.public_id));

  // Test document removal: detach 1 of 2 documents
  const removedDocId = docsAssets[0]!.public_id;
  const singleDocMandateData = {
    ...updatedMandateData,
    signature: { kind: "existing" as const },
    documents: [{ kind: "existing" as const, id: updateMandateReq.payload.data.documents[1].id }]
  };
  const removeDocReq = await f.request(`/${id}/mandates`, "POST", singleDocMandateData);
  assert.equal(removeDocReq.response.status, 201);
  assert.equal(removeDocReq.payload.data.documents.length, 1);
  assert.equal(removeDocReq.payload.data.documents[0].title, "Survey Plan 2");
  assertNoProviderDetails(removeDocReq.payload.data);
  assert.ok(f.removed.includes(removedDocId));
  assert.equal((await f.repository.mandate(f.owner, id))!.documents[0]!.public_id, docsAssets[1]!.public_id);

  // Reload mandate confirms only 1 document persists
  const reloadedMandate = await f.request(`/${id}/mandate`, "GET");
  assert.equal(reloadedMandate.payload.data.documents.length, 1);
  assert.equal(reloadedMandate.payload.data.telephone, "08012345678");

  // Telephone update survives save draft and reload
  const updatePhoneData = {
    ...singleDocMandateData,
    documents: [{ kind: "existing" as const, id: removeDocReq.payload.data.documents[0].id }],
    content: {
      ...singleDocMandateData.content,
      telephone: "09087654321"
    }
  };
  const phoneReq = await f.request(`/${id}/mandates`, "POST", updatePhoneData);
  assert.equal(phoneReq.response.status, 201);
  assert.equal(phoneReq.payload.data.telephone, "09087654321");
  const reloadedPhone = await f.request(`/${id}/mandate`, "GET");
  assert.equal(reloadedPhone.payload.data.telephone, "09087654321");

  // A failed save retaining the current signature must never delete that valid asset.
  const retainedDocument = { kind: "existing" as const, id: phoneReq.payload.data.documents[0].id };
  const invalidDuplicateDocs = { ...updatePhoneData, documents: [retainedDocument, retainedDocument] };
  assert.equal((await f.request(`/${id}/mandates`, "POST", invalidDuplicateDocs)).response.status, 409);
  assert.equal(f.removed.includes(newSigAsset.public_id), false);

  // A newly uploaded signature whose DB save fails remains in durable cleanup,
  // then is safely removed only after the late-attachment grace period.
  const orphanSigBody = new FormData();
  orphanSigBody.set("signature", new Blob([imageBytes], { type: "image/png" }), "orphan.png");
  const orphanSigUpload = (await f.request(`/${id}/mandate/signature`, "POST", orphanSigBody)).payload.data;
  assertNoProviderDetails(orphanSigUpload);
  const orphanSig = f.uploaded.at(-1)!;
  const failedNewSignature = { ...invalidDuplicateDocs, signature: { kind: "upload" as const, upload_id: orphanSigUpload.upload_id } };
  assert.equal((await f.request(`/${id}/mandates`, "POST", failedNewSignature)).response.status, 409);
  assert.equal((await f.db.query("select public_id from public.customer_listing_media_cleanup where user_id=$1 and public_id=$2", [f.owner, orphanSig.public_id])).rows.length, 1);
  await f.db.query("update public.customer_listing_media_cleanup set created_at=clock_timestamp()-interval '2 hours' where user_id=$1 and public_id=$2", [f.owner, orphanSig.public_id]);
  await new ListingsService(f.repository, f.storage).cleanup(f.owner);
  assert.equal(f.removed.includes(orphanSig.public_id), true);
  assert.equal((await f.repository.mandate(f.owner, id))!.signature_public_id, newSigAsset.public_id);

  // 7. REJECTED resubmission flow
  // Simulate admin rejection in DB
  await f.db.query("update public.customer_listings set listing_status='REJECTED' where id=$1", [id]);
  const rejectedListing = await f.request(`/${id}`, "GET");
  assert.equal(rejectedListing.payload.data.listing_status, "REJECTED");

  // Seller edits rejected listing
  const editRejected = await f.request(`/${id}`, "PATCH", listingForm({ ...validContent, title: "Updated After Rejection" }, [], { version: unlistedVersion + 1 }));
  assert.equal(editRejected.response.status, 200);
  assert.equal(editRejected.payload.data.title, "Updated After Rejection");

  // Seller resubmits rejected listing -> PENDING
  const resubmit = await f.request(`/${id}/submit`, "POST", {});
  assert.equal(resubmit.response.status, 201);
  assert.equal(resubmit.payload.data.listing_status, "PENDING");
});
