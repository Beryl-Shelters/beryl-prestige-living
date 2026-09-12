import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { messagesFixture } from "./messages.fixture.js";
import { checkTicketError } from "../src/messages/repository.js";

test("Messages API and disposable PostgreSQL",async t=>{
  const {db,owner,other,repository,request,row,profile}=await messagesFixture(t);
  const create=()=>repository.create(owner,"Viewing enquiry","Please arrange a viewing.");
  await t.test("anonymous, recovery-only and invalid sessions rejected",async()=>{
    for(const Cookie of ["","beryl_recovery=messages-test-session","beryl_account=invalid"]) assert.equal((await request("","GET",undefined,{Cookie})).response.status,401);
  });
  await t.test("unverified and expired account sessions rejected",async()=>{
    const verified=profile.email_verified_at;profile.email_verified_at=null;assert.equal((await request()).response.status,401);profile.email_verified_at=verified;
    const expiry=row.expires_at;row.expires_at="2000-01-01T00:00:00Z";assert.equal((await request()).response.status,401);row.expires_at=expiry;
  });
  await t.test("create atomically returns first CUSTOMER message and trims input",async()=>{
    const {response,payload}=await request("","POST",{subject:"  First enquiry  ",message:"  Hello\nthere  "});assert.equal(response.status,201);
    assert.equal(payload.data.subject,"First enquiry");assert.equal(payload.data.messages.length,1);assert.equal(payload.data.messages[0].body,"Hello\nthere");assert.equal(payload.data.messages[0].senderType,"CUSTOMER");
    assert.equal((await db.query<{user_id:string}>("select user_id from customer_tickets where id=$1",[payload.data.id])).rows[0]!.user_id,owner);
  });
  await t.test("compact unique server-generated immutable numbers",async()=>{
    const a=await create(),b=await create();assert.match(a.ticketNumber,/^[1-9]\d*$/);assert.notEqual(a.ticketNumber,b.ticketNumber);
    await assert.rejects(db.query("update customer_tickets set ticket_number=999 where id=$1",[a.id]));
    await assert.rejects(db.query("insert into customer_tickets(user_id,subject,ticket_number) values($1,'spoof',900)",[owner]));
  });
  for(const [name,body] of Object.entries({"subject required":{message:"hello"},"message required":{subject:"hello"},"blank subject":{subject:" \t\n ",message:"hello"},"blank message":{subject:"hello",message:" \n "},"subject bound":{subject:"x".repeat(161),message:"hello"},"message bound":{subject:"hello",message:"x".repeat(3001)},"null rejected":{subject:null,message:"hi"}})) {
    await t.test(name,async()=>assert.equal((await request("","POST",body)).response.status,400));
  }
  await t.test("bounds accepted and message HTML stored only as plain text",async()=>{
    const {response,payload}=await request("","POST",{subject:"s".repeat(160),message:"<script>alert(1)</script>"+"x".repeat(2975)});assert.equal(response.status,201);assert.match(payload.data.messages[0].body,/^<script>/);
  });
  await t.test("browser cannot set owner, number, sender, timestamps or read state",async()=>{
    for(const extra of [{userId:other},{ticketNumber:"27"},{sender_type:"SUPPORT"},{createdAt:"2000-01-01"},{is_read:true}]) assert.equal((await request("","POST",{subject:"Hello",message:"Text",...extra})).response.status,400);
    assert.equal((await request(`?userId=${other}`)).response.status,400);
    const {payload}=await request("","POST",{subject:"Owner header",message:"Text"},{"X-Owner-Id":other});
    assert.equal((await db.query<{user_id:string}>("select user_id from customer_tickets where id=$1",[payload.data.id])).rows[0]!.user_id,owner);
  });
  const foreign=await repository.create(other,"Foreign private subject","Foreign private message"),own=await create();
  await t.test("own list and detail are owner scoped, private and no-store",async()=>{
    const list=await request();assert.equal(list.response.headers.get("cache-control"),"no-store");assert(!list.payload.data.items.some((item:{id:string})=>item.id===foreign.id));
    assert.equal((await request(`/${own.id}`)).payload.data.id,own.id);
  });
  await t.test("foreign and nonexistent detail use identical safe not-found",async()=>{
    const a=await request(`/${foreign.id}`),b=await request(`/${randomUUID()}`);assert.equal(a.response.status,404);assert.deepEqual(a.payload,b.payload);
  });
  await t.test("reply appends ordered history and advances activity, preview and list order",async()=>{
    await create();const {response,payload}=await request(`/${own.id}/messages`,"POST",{message:"  A second message  "});assert.equal(response.status,201);
    assert.deepEqual(payload.data.messages.map((m:{body:string})=>m.body),["Please arrange a viewing.","A second message"]);
    assert(payload.data.lastActivityAt>own.lastActivityAt);
    const list=await repository.list(owner,"");assert.equal(list.items[0]!.id,own.id);assert.equal(list.items[0]!.latestMessagePreview,"A second message");assert.equal(list.items[0]!.unread,false);
  });
  await t.test("foreign reply is hidden",async()=>assert.equal((await request(`/${foreign.id}/messages`,"POST",{message:"no"})).response.status,404));
  await t.test("reply rejects spoofed sender, owner, read state, timestamp and blank/long bodies",async()=>{
    for(const body of [{message:"hello",senderType:"SUPPORT"},{message:"hello",userId:other},{message:"hello",readByCustomerAt:new Date().toISOString()},{message:"hello",createdAt:"2000-01-01"},{message:" \n "},{message:"x".repeat(3001)}]) assert.equal((await request(`/${own.id}/messages`,"POST",body)).response.status,400);
  });
  await t.test("search subject and historical content, case-insensitive and trimmed",async()=>{
    assert((await request("?q=%20VIEWING%20")).payload.data.items.some((v:{id:string})=>v.id===own.id));
    assert((await request("?q=arrange")).payload.data.items.some((v:{id:string})=>v.id===own.id));
  });
  await t.test("blank search restores all; search cannot leak foreign content",async()=>{
    assert.deepEqual((await request("?q=%20%20")).payload,(await request()).payload);
    assert.deepEqual((await request("?q=Foreign")).payload.data.items,[]);
  });
  await t.test("search metacharacters are literal and bounded",async()=>{
    const special=await repository.create(owner,"100%_literal\\","special");
    for(const q of ["%","_","\\"])assert.deepEqual((await repository.list(owner,q)).items.map(v=>v.id),[special.id]);
    assert.equal((await request(`?q=${"x".repeat(101)}`)).response.status,400);
  });
  await t.test("SUPPORT seed produces unread; detail GET alone is read-only",async()=>{
    await db.query("insert into customer_ticket_messages(ticket_id,sender_type,body) values($1,'SUPPORT','We can help.')",[own.id]);
    const detail=(await request(`/${own.id}`)).payload.data;assert.equal(detail.messages.at(-1).senderType,"SUPPORT");assert.equal(detail.messages.at(-1).readByCustomerAt,null);
    assert.equal((await repository.list(owner,"")).items.find(v=>v.id===own.id)!.unread,true);
  });
  await t.test("acknowledgement reads opened SUPPORT snapshot only, preserves later replies and activity",async()=>{
    const opened=await repository.detail(owner,own.id);
    await db.query("insert into customer_ticket_messages(ticket_id,sender_type,body) values($1,'SUPPORT','Later reply')",[own.id]);
    const before=await repository.detail(owner,own.id);
    assert.equal((await request(`/${own.id}/read`,"POST",{throughMessageId:opened.messages.at(-1)!.id})).response.status,200);
    const after=await repository.detail(owner,own.id);assert(after.messages.at(-2)!.readByCustomerAt);assert.equal(after.messages.at(-1)!.readByCustomerAt,null);assert.equal(after.messages[0]!.readByCustomerAt,null);assert.equal(after.lastActivityAt,before.lastActivityAt);
    assert((await repository.list(owner,"")).items.find(v=>v.id===own.id)!.unread);
    await repository.acknowledge(owner,own.id,after.messages.at(-1)!.id);
    const read=await repository.detail(owner,own.id);await repository.acknowledge(owner,own.id,after.messages.at(-1)!.id);assert.deepEqual(await repository.detail(owner,own.id),read);
    assert.equal((await repository.list(owner,"")).items.find(v=>v.id===own.id)!.unread,false);
  });
  await t.test("read watermark must belong to owned ticket",async()=>{
    assert.equal((await request(`/${own.id}/read`,"POST",{throughMessageId:foreign.messages[0]!.id})).response.status,404);
    assert.equal((await request(`/${foreign.id}/read`,"POST",{throughMessageId:foreign.messages[0]!.id})).response.status,404);
  });
  await t.test("cross-origin writes and non-JSON requests denied",async()=>{
    assert.equal((await request("","POST",{subject:"x",message:"y"},{Origin:"https://evil.test"})).response.status,403);
    assert.equal((await request("","POST",undefined)).response.status,403);
  });
  await t.test("SQL invalid first message rolls back parent and invalid reply rolls back activity",async()=>{
    const before=await db.query("select * from customer_tickets order by id");await assert.rejects(db.query("select create_customer_ticket($1,'Rollback','  ')",[owner]));assert.deepEqual(await db.query("select * from customer_tickets order by id"),before);
    const old=await repository.detail(owner,own.id);await assert.rejects(db.query("select reply_customer_ticket($1,$2,'  ')",[owner,own.id]));assert.deepEqual(await repository.detail(owner,own.id),old);
  });
  await t.test("SQL immutable identity and messages, invalid sender and whitespace rejected",async()=>{
    await assert.rejects(db.query("update customer_tickets set user_id=$1 where id=$2",[other,own.id]));
    await assert.rejects(db.query("update customer_ticket_messages set body='changed' where ticket_id=$1",[own.id]));
    for(const sender of ["ADMIN", ""])await assert.rejects(db.query("insert into customer_ticket_messages(ticket_id,sender_type,body) values($1,$2,'text')",[own.id,sender]));
    await assert.rejects(db.query("select create_customer_ticket($1,E'\\t\\n','hello')",[owner]));
  });
  await t.test("anon/authenticated direct tables and all RPCs denied; service RPC only",async()=>{
    for(const role of ["anon","authenticated","service_role"]) {
      await db.exec(`set role ${role}`);
      try {
        for(const table of ["customer_tickets","customer_ticket_messages"])await assert.rejects(db.query(`select * from ${table}`));
        for(const sql of ["select list_customer_tickets($1,'')","select create_customer_ticket($1,'x','y')"]) {
          if(role==="service_role")await db.query(sql,[owner]);else await assert.rejects(db.query(sql,[owner]));
        }
        for(const sql of ["select read_customer_ticket($1,$2)","select reply_customer_ticket($1,$2,'hi')",`select acknowledge_customer_ticket($1,$2,'${own.messages[0]!.id}')`]) {
          if(role!=="service_role")await assert.rejects(db.query(sql,[owner,own.id]));
        }
      } finally {await db.exec("reset role");}
    }
  });
  await t.test("RLS still filters rows if browser accidentally receives SELECT grant",async()=>{
    await db.exec("grant select on customer_tickets,customer_ticket_messages to authenticated; set role authenticated");
    try{assert.equal((await db.query("select * from customer_tickets")).rows.length,0);assert.equal((await db.query("select * from customer_ticket_messages")).rows.length,0);}finally{await db.exec("reset role; revoke select on customer_tickets,customer_ticket_messages from authenticated");}
  });
  await t.test("all definer RPCs have fixed safe search paths",async()=>{
    const {rows}=await db.query<{proconfig:string[]}>("select proconfig from pg_proc where proname in ('list_customer_tickets','read_customer_ticket','create_customer_ticket','reply_customer_ticket','acknowledge_customer_ticket') and prosecdef");assert.equal(rows.length,5);for(const row of rows)assert.deepEqual(row.proconfig,["search_path=public, pg_temp"]);
  });
  await t.test("provider diagnostics are not exposed",()=>assert.throws(()=>checkTicketError({code:"XX000"}),{message:"Messages are temporarily unavailable. Please try again."}));
});
