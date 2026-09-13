import assert from "node:assert/strict";
import {test} from "node:test";
import {randomUUID} from "node:crypto";
import {messagesFixture} from "./messages.fixture.js";
import {TicketAttachmentsService} from "../src/messages/service.js";

const pdf=Buffer.from("%PDF-1.4\nattachment test");
const webp=Buffer.from([82,73,70,70,4,0,0,0,87,69,66,80,86,80,56,32]);
function form(message="",name="plan.pdf",mime="application/pdf",bytes:Uint8Array=pdf,subject?:string){
  const body=new FormData();body.set("data",JSON.stringify(subject===undefined?{message}:{subject,message}));
  body.set("attachment",new Blob([new Uint8Array(bytes)],{type:mime}),name);return body;
}
test("Private message attachments and Overview integration",async t=>{
  const f=await messagesFixture(t),{request,repository,db,owner,other,stored,removed,storageFailures,storage}=f;
  let id="",attachmentId="";
  await t.test("create a ticket with only an attachment atomically, preserving private metadata",async()=>{
    const {response,payload}=await request("","POST",form("","floor-plan.pdf","application/pdf",pdf,"Floor plan enquiry"));
    assert.equal(response.status,201);id=payload.data.id;attachmentId=payload.data.messages[0].attachments[0].id;
    assert.equal(payload.data.messages[0].body,"");assert.equal(payload.data.messages[0].senderType,"CUSTOMER");
    assert.deepEqual(payload.data.messages[0].attachments[0],{id:attachmentId,filename:"floor-plan.pdf",mimeType:"application/pdf",sizeBytes:pdf.length});
    assert(!JSON.stringify(payload).includes("public_id"));assert(!JSON.stringify(payload).includes("cloudinary"));
    const asset=await repository.attachment(owner,id,attachmentId);assert.equal(asset.resource_type,"raw");assert.equal(asset.delivery_type,"authenticated");assert(stored.has(asset.public_id));
  });
  await t.test("own attachment downloads as bytes with private caching and forced attachment headers",async()=>{
    const {response,payload}=await request(`/${id}/attachments/${attachmentId}`);
    assert.equal(response.status,200);assert.equal(response.headers.get("cache-control"),"no-store");assert.equal(response.headers.get("x-content-type-options"),"nosniff");assert.match(response.headers.get("content-disposition")!,/^attachment;/);assert.deepEqual(payload,pdf);
  });
  await t.test("foreign, missing, wrong-ticket and unauthenticated attachment downloads denied",async()=>{
    const foreign=await repository.create(other,"Private","text");
    await assert.rejects(repository.attachment(other,id,attachmentId),{status:404});
    for(const path of [`/${foreign.id}/attachments/${attachmentId}`,`/${id}/attachments/${randomUUID()}`])assert.equal((await request(path)).response.status,404);
    assert.equal((await request(`/${id}/attachments/${attachmentId}`,"GET",undefined,{Cookie:""})).response.status,401);
  });
  await t.test("reply supports file-only and text with a file, with correct preview/history",async()=>{
    const result=await request(`/${id}/messages`,"POST",form("","second.pdf"));assert.equal(result.response.status,201);assert.equal(result.payload.data.messages.length,2);
    assert.equal((await repository.list(owner,"")).items[0]!.latestMessagePreview,"second.pdf");
    assert.equal((await request(`/${id}/messages`,"POST",form("Please review this"))).response.status,201);
    assert.equal((await repository.list(owner,"")).items[0]!.latestMessagePreview,"Please review this");
  });
  await t.test("file validation rejects wrong signatures, unsupported formats, empty and oversized bytes",async()=>{
    const count=stored.size;
    for(const body of [form("hi","fake.pdf","application/pdf",Buffer.from("<html>fake</html>")),form("hi","fake.webp","image/webp",Buffer.from("not a webp")),form("hi","mismatch.webp","image/webp",Buffer.from([137,80,78,71,13,10,26,10,0])),form("hi","mismatch.png","image/png",webp),form("hi","bad.svg","image/svg+xml",Buffer.from("<svg/>")),form("hi","program.exe","application/octet-stream",Buffer.from("MZ executable")),form("hi","empty.pdf","application/pdf",Buffer.alloc(0)),form("hi","large.pdf","application/pdf",Buffer.concat([pdf,Buffer.alloc(10*1024*1024)]))])assert.equal((await request(`/${id}/messages`,"POST",body)).response.status,400);
    assert.equal(stored.size,count);
  });
  await t.test("PDF, PNG, JPEG and WEBP attachments accepted with matching content",async()=>{
    for(const [name,mime,bytes] of [["document.pdf","application/pdf",pdf],["image.png","image/png",Buffer.from([137,80,78,71,13,10,26,10,0])],["image.jpg","image/jpeg",Buffer.from([255,216,255,224,0])],["image.webp","image/webp",webp]] as const){
      const sent=await request(`/${id}/messages`,"POST",form("",name,mime,bytes));assert.equal(sent.response.status,201);
      if(mime==="image/webp"){
        const webpAttachment=sent.payload.data.messages.at(-1).attachments[0];const downloaded=await request(`/${id}/attachments/${webpAttachment.id}`);
        assert.equal(downloaded.response.headers.get("content-type"),"image/webp");assert.match(downloaded.response.headers.get("content-disposition")!,/\.webp"$/);
      }
    }
  });
  await t.test("one file per message, strict metadata, trusted origin and owned parent required before upload",async()=>{
    const two=form();two.append("attachment",new Blob([pdf],{type:"application/pdf"}),"extra.pdf");
    const spoof=form();spoof.set("data",JSON.stringify({message:"hi",sender_type:"SUPPORT",userId:other}));
    const missing=new FormData();missing.set("data",JSON.stringify({message:"hello"}));
    for(const body of [two,spoof,missing])assert.equal((await request(`/${id}/messages`,"POST",body)).response.status,400);
    assert.equal((await request(`/${id}/messages`,"POST",form(),{Origin:"https://evil.test"})).response.status,403);
    const foreign=await repository.create(other,"Foreign","text"),before=stored.size;
    assert.equal((await request(`/${foreign.id}/messages`,"POST",form())).response.status,404);assert.equal(stored.size,before);
  });
  await t.test("Overview shows customer-created tickets immediately, but unread counts only SUPPORT messages",async()=>{
    const initial=await request("/api/v1/dashboard/overview");assert.equal(initial.response.status,200);assert(initial.payload.data.recent_messages.some((v:{id:string})=>v.id===id));assert.equal(initial.payload.data.summary.new_messages,0);
    await db.query("insert into customer_ticket_messages(ticket_id,sender_type,body) values($1,'SUPPORT','Support reply'),($1,'SUPPORT','Second reply')",[id]);
    const overview=await repository.overview(owner);assert.equal(overview.unread,2);assert.equal(overview.recent[0]!.id,id);
    const detail=await repository.detail(owner,id);await repository.acknowledge(owner,id,detail.messages.at(-1)!.id);
    assert.equal((await repository.overview(owner)).unread,0);assert((await repository.overview(owner)).recent.some(v=>v.id===id));
  });
  await t.test("Overview returns latest five own threads and never foreign threads",async()=>{
    const ids=[];for(let i=0;i<6;i++)ids.push((await repository.create(owner,`Ticket ${i}`,"text")).id);
    await repository.create(other,"Other private","secret");
    assert.deepEqual((await repository.overview(owner)).recent.map(v=>v.id),ids.slice(1).reverse());
    await repository.reply(owner,id,"Latest activity");assert.equal((await repository.overview(owner)).recent[0]!.id,id);
  });
  await t.test("missing, foreign and reused upload intents cannot attach, SQL failure rolls back message",async()=>{
    const asset=await repository.attachment(owner,id,attachmentId),before=await repository.detail(owner,id);
    await assert.rejects(repository.saveAttachment(owner,id,null,"no",asset));
    assert.deepEqual(await repository.detail(owner,id),before);
    await assert.rejects(repository.saveAttachment(owner,id,null,"no",{...asset,public_id:`beryl-v2/messages/${randomUUID()}.pdf`}));
    const foreignId=`beryl-v2/messages/${randomUUID()}.pdf`;await repository.reserveUpload(other,foreignId);
    await assert.rejects(repository.saveAttachment(owner,id,null,"no",{...asset,public_id:foreignId}));
  });
  await t.test("ambiguous uploads retain durable intents; cleanup retries and cannot remove attached files",async()=>{
    storageFailures.upload=true;assert.equal((await request(`/${id}/messages`,"POST",form("test"))).response.status,503);storageFailures.upload=false;
    const orphan=(await db.query<{public_id:string}>("select u.public_id from customer_ticket_uploads u where user_id=$1 and not exists(select 1 from customer_ticket_attachments a where a.public_id=u.public_id)",[owner])).rows[0]!.public_id;
    assert(stored.has(orphan));assert.deepEqual(await repository.claimCleanup(owner),[]);
    await db.exec("update customer_ticket_uploads set created_at=clock_timestamp()-interval '2 hours'");
    storageFailures.remove=true;const service=new TicketAttachmentsService(repository,storage);await service.cleanup(owner);assert(stored.has(orphan));
    const asset=await repository.attachment(owner,id,attachmentId);
    await assert.rejects(repository.saveAttachment(owner,id,null,"late",{...asset,public_id:orphan}));
    storageFailures.remove=false;await service.cleanup(owner);assert(!stored.has(orphan));assert(removed.includes(orphan));assert(stored.has(asset.public_id));assert(!removed.includes(asset.public_id));
  });
  await t.test("new tables and RPCs deny browser roles; service can commit file-only messages",async()=>{
    for(const role of ["anon","authenticated"]){await db.exec(`set role ${role}`);try{
      for(const table of ["customer_ticket_uploads","customer_ticket_attachments"])await assert.rejects(db.query(`select * from ${table}`));
      for(const sql of ["select customer_ticket_overview($1)","select reserve_customer_ticket_upload($1,'beryl-v2/messages/spoof.pdf')","select claim_customer_ticket_upload_cleanup($1)","select forget_customer_ticket_upload($1,'x')",`select get_customer_ticket_attachment($1,'${id}','${attachmentId}')`,`select save_customer_ticket_attachment($1,'${id}',null,'','{}')`])await assert.rejects(db.query(sql,[owner]));
    }finally{await db.exec("reset role");}}
    const asset=await repository.attachment(owner,id,attachmentId),publicId=`beryl-v2/messages/${randomUUID()}.pdf`;
    await db.exec("set role service_role");try{
      await repository.reserveUpload(owner,publicId);const result=await repository.saveAttachment(owner,id,null,"",{...asset,public_id:publicId});assert.equal(result.messages.at(-1)!.attachments.length,1);
      await assert.rejects(repository.reply(owner,id,""));
    }finally{await db.exec("reset role");}
  });
});
