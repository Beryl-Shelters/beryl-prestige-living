import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { runIfMain } from "./run-ui-suite.mjs";
runIfMain(import.meta.url,"messages");

export const messagesState={items:[]};
export function messagesRequestBody(request){
  if(!request.headers()["content-type"]?.startsWith("multipart/form-data"))return request.postDataJSON();
  const boundary=request.headers()["content-type"].split("boundary=")[1];assert(boundary);
  const parts=request.postDataBuffer().toString("latin1").split(`--${boundary}`);
  const data=parts.find(part=>part.includes('name="data"'));const file=parts.find(part=>part.includes('name="attachment"'));assert(data&&file);
  const payload=JSON.parse(data.split("\r\n\r\n")[1].replace(/\r\n$/,""));
  const headers=file.split("\r\n\r\n")[0],bytes=file.slice(file.indexOf("\r\n\r\n")+4).replace(/\r\n$/,"");
  return {...payload,attachment:{filename:headers.match(/filename="([^"]+)"/)[1],mimeType:headers.match(/Content-Type: ([^\r\n]+)/i)[1],sizeBytes:Buffer.byteLength(bytes,"latin1")}};
}
export function messagesOverview(){
  const sorted=messagesState.items.toSorted((a,b)=>b.lastActivityAt.localeCompare(a.lastActivityAt)||b.id.localeCompare(a.id));
  return {recent:sorted.slice(0,5).map(t=>({id:t.id,subject:t.subject})),unread:sorted.flatMap(t=>t.messages).filter(m=>m.senderType==="SUPPORT"&&!m.readByCustomerAt).length};
}
const message=(body,senderType="CUSTOMER")=>({id:randomUUID(),body,senderType,createdAt:new Date().toISOString(),readByCustomerAt:null});
const ticket=(subject,body,number="27")=>({id:randomUUID(),ticketNumber:number,subject,createdAt:"2026-09-11T08:00:00Z",lastActivityAt:"2026-09-11T08:00:00Z",messages:[message(body)]});
export function messagesResponse(url,method,body) {
  const parts=url.pathname.split("/").slice(5),id=parts[0];
  if(!id&&method==="GET") {
    const q=(url.searchParams.get("q")??"").trim().toLowerCase();
    return {items:messagesState.items.filter(t=>[t.subject,...t.messages.map(m=>m.body)].some(v=>v.toLowerCase().includes(q))).toSorted((a,b)=>b.lastActivityAt.localeCompare(a.lastActivityAt)||b.id.localeCompare(a.id)).map(t=>({id:t.id,ticketNumber:t.ticketNumber,subject:t.subject,lastActivityAt:t.lastActivityAt,latestMessagePreview:t.messages.at(-1).body.slice(0,160)||t.messages.at(-1).attachments?.[0]?.filename,unread:t.messages.some(m=>m.senderType==="SUPPORT"&&!m.readByCustomerAt)}))};
  }
  if(!id&&method==="POST") {
    assert.deepEqual(Object.keys(body).filter(key=>key!=="attachment").sort(),["message","subject"]);
    const value=ticket(body.subject,body.message,String(messagesState.items.length+28));value.lastActivityAt=new Date().toISOString();if(body.attachment)value.messages[0].attachments=[{id:randomUUID(),...body.attachment}];messagesState.items.push(value);return value;
  }
  const value=messagesState.items.find(t=>t.id===id);assert(value,`Unknown mock ticket ${id}`);
  if(parts[1]==="read") {
    assert.deepEqual(Object.keys(body),["throughMessageId"]);
    const index=value.messages.findIndex(m=>m.id===body.throughMessageId);assert(index>=0);
    value.messages.slice(0,index+1).forEach(m=>{if(m.senderType==="SUPPORT"&&!m.readByCustomerAt)m.readByCustomerAt=new Date().toISOString();});return {acknowledged:true};
  }
  if(parts[1]==="messages") {assert.deepEqual(Object.keys(body).filter(key=>key!=="attachment"),["message"]);const reply=message(body.message);if(body.attachment)reply.attachments=[{id:randomUUID(),...body.attachment}];value.messages.push(reply);value.lastActivityAt=new Date().toISOString();}
  return value;
}

export async function checkMessages({page,origin,calls,failures,screenshot,passed,pauseRequest,resume,toast}) {
  const endpoint="/messages/tickets";
  const open=async()=>{await page.goto(origin+"/dashboard/messages");await page.getByRole("heading",{name:"My Tickets",exact:true}).waitFor();await page.locator('.tickets-list[aria-busy="false"]').waitFor();await page.evaluate(()=>document.fonts.ready);};
  const overflow=async()=>assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  const selectFirst=async()=>{await page.locator(".ticket-row").first().click();await page.locator(".conversation-header").waitFor();};
  for(const width of [1440,1280,1024,768,390,320]) {
    await page.setViewportSize({width,height:900});messagesState.items=[];await open();
    await page.getByText("No messages found.",{exact:true}).waitFor();await overflow();await screenshot(`messages-empty-${width}`);
    if(width>800){await page.getByRole("heading",{name:"Select a Conversation"}).waitFor();assert.equal(await page.locator(".tickets-header").evaluate(el=>getComputedStyle(el).backgroundColor),"rgb(183, 134, 75)");}
    messagesState.items=[ticket("Testing Message","Hello there")];await open();await page.locator(".ticket-row").waitFor();
    assert.equal(await page.locator(".ticket-unread").count(),0);await screenshot(`messages-list-${width}`);
    await page.getByRole("button",{name:"+ New Ticket",exact:true}).click();await page.getByRole("dialog",{name:"New Ticket",exact:true}).waitFor();
    assert.equal(await page.getByRole("dialog").locator("input:not([type=file]),textarea").count(),2);
    assert.equal(await page.getByRole("dialog").getByRole("button",{name:"Attach a file",exact:true}).count(),1);
    const rect=await page.getByRole("dialog").boundingBox();assert(rect.x>=0&&rect.x+rect.width<=width);await overflow();await screenshot(`messages-modal-${width}`);
    await page.getByRole("button",{name:"Cancel",exact:true}).click();await selectFirst();await page.getByText("Ticket #27",{exact:true}).waitFor();
    assert.equal(await page.locator(".message-bubble.customer").evaluate(el=>getComputedStyle(el).backgroundColor),"rgb(217, 255, 209)");
    const bubble=await page.locator(".message-bubble.customer").boundingBox(),history=await page.locator(".conversation-history").boundingBox();assert(bubble.x>bubble.width/10+history.x);
    await overflow();await screenshot(`messages-conversation-${width}`);
    if(width<=800){await page.getByRole("button",{name:"Back to tickets"}).click();await page.locator(".ticket-row").waitFor();await page.getByRole("button",{name:"Menu",exact:true}).click();}
    assert.equal(await page.locator('.dashboard-navigation [aria-current="page"]').innerText(),"Messages");
    if(width<=800)await page.keyboard.press("Escape");
    console.log(`Messages four states passed at ${width}px`);
  }
  passed.push("Four reference states, project gold/font, customer bubble alignment, active navigation, mobile master/detail and no overflow at 1440/1280/1024/768/390/320");
  await page.setViewportSize({width:1440,height:900});messagesState.items=[];await open();
  await page.getByRole("button",{name:"+ New Ticket",exact:true}).click();
  const count=()=>calls.filter(c=>c.endpoint===endpoint&&c.method==="POST").length,before=count();
  await page.getByRole("button",{name:"Send Message",exact:true}).click();assert.equal(count(),before);
  await page.getByLabel("Subject",{exact:true}).fill("   ");await page.locator("#ticket-message").fill("   ");
  await page.getByRole("button",{name:"Send Message",exact:true}).click();await page.getByRole("dialog").getByRole("alert").filter({hasText:"Enter a subject and message with text."}).waitFor();assert.equal(count(),before);
  await page.getByLabel("Subject",{exact:true}).fill("  Viewing enquiry  ");await page.locator("#ticket-message").fill("  Please arrange a viewing.  ");
  failures.set(endpoint,{status:503,code:"MESSAGES_UNAVAILABLE",message:"Create unavailable. Please try again."});
  await page.getByRole("button",{name:"Send Message",exact:true}).click();await page.getByRole("dialog").getByRole("alert").filter({hasText:"Create unavailable. Please try again."}).waitFor();
  assert.equal(await page.locator("#ticket-subject").inputValue(),"  Viewing enquiry  ");assert.equal(messagesState.items.length,0);
  failures.delete(endpoint);
  const paused=pauseRequest(endpoint);await page.getByRole("button",{name:"Send Message",exact:true}).click();await paused;
  assert(await page.getByRole("button",{name:"Cancel",exact:true}).isDisabled());assert(await page.locator("#ticket-subject").isDisabled());await page.keyboard.press("Escape");assert(await page.getByRole("dialog").isVisible());
  resume();await page.getByRole("dialog").waitFor({state:"detached"});await page.locator(".conversation-header").waitFor();await page.locator(".ticket-row").waitFor();
  assert.equal(count(),before+2);assert.equal(await page.locator(".conversation-header h2").innerText(),"Viewing enquiry");
  const created=messagesState.items[0],replyEndpoint=`${endpoint}/${created.id}/messages`;
  failures.set(replyEndpoint,{status:503,code:"MESSAGES_UNAVAILABLE",message:"Reply unavailable. Please try again."});
  await page.getByRole("textbox",{name:"Reply",exact:true}).fill("A second message");await page.getByRole("button",{name:"Send reply",exact:true}).click();await toast("Reply unavailable. Please try again.");
  assert.equal(await page.getByRole("textbox",{name:"Reply",exact:true}).inputValue(),"A second message");assert.equal(await page.locator(".message-bubble").count(),1);
  failures.delete(replyEndpoint);const replyPaused=pauseRequest(replyEndpoint);await page.getByRole("button",{name:"Send reply",exact:true}).click();await replyPaused;assert(await page.getByRole("button",{name:"Send reply",exact:true}).isDisabled());resume();
  await page.locator(".message-bubble").nth(1).waitFor();assert.equal(await page.getByRole("textbox",{name:"Reply",exact:true}).inputValue(),"");
  await page.waitForFunction(()=>document.querySelector(".ticket-row-bottom")?.textContent==="A second message");
  passed.push("Required/trimmed validation, atomic mock create, exact write payloads, pending lock/Escape protection, persisted reply, error preserves draft and latest preview");
  const search=page.getByRole("textbox",{name:"Search conversations",exact:true});
  for(const value of ["VIEWING","arrange"]) {await search.fill(`  ${value}  `);await page.locator('.tickets-list[aria-busy="false"]').waitFor();assert.equal(await page.locator(".ticket-row").count(),1);}
  await search.fill("not present");await page.getByText("No messages found.",{exact:true}).waitFor();await search.fill("  ");await page.locator(".ticket-row").waitFor();
  await search.fill(" ");assert.equal(await page.locator(".ticket-row").count(),1);
  const support=message("<img src=x onerror=alert(1)>\n"+"longword".repeat(70),"SUPPORT");created.messages.push(support);created.lastActivityAt=support.createdAt;await open();await page.locator(".ticket-unread").waitFor();
  const ackEndpoint=`${endpoint}/${created.id}/read`,ackPaused=pauseRequest(ackEndpoint);await selectFirst();await ackPaused;
  assert.equal(await page.locator(".message-bubble.support img, .message-bubble.support script").count(),0);
  assert.equal(await page.locator(".message-bubble.support p").innerText(),support.body);
  const later=message("Arrived after opening","SUPPORT");created.messages.push(later);
  const refreshed=page.waitForResponse(r=>new URL(r.url()).pathname==="/api/v1/messages/tickets"&&r.request().method()==="GET");resume();
  // Observe the read call's subsequent list fetch, then verify late reply unread.
  await refreshed;
  assert.equal(later.readByCustomerAt,null);assert(support.readByCustomerAt);assert.equal(await page.locator(".ticket-unread").count(),1);
  await open();await selectFirst();await page.locator(".ticket-unread").waitFor({state:"detached"});
  for(const width of [1440,320]){await page.setViewportSize({width,height:900});await overflow();await screenshot(`messages-support-wrapping-${width}`);}
  passed.push("Subject/historical-content/blank search; seeded SUPPORT plain-text wrapping; legitimate unread dot and opened-snapshot acknowledgement preserving late replies");
  await page.setViewportSize({width:1440,height:900});
  const loading=pauseRequest(endpoint);await page.goto(origin+"/dashboard/messages");await loading;await page.locator(".tickets-list .brand-loader").waitFor();assert.equal(await page.getByText("No messages found.",{exact:true}).count(),0);resume();await page.locator(".ticket-row").waitFor();
  const detailEndpoint=`${endpoint}/${created.id}`;
  failures.set(detailEndpoint,{status:503,code:"MESSAGES_UNAVAILABLE",message:"Conversation unavailable."});await page.locator(".ticket-row").click();await toast("Conversation unavailable.");assert.equal(await page.locator(".ticket-row").count(),1);
  failures.delete(detailEndpoint);await page.getByRole("button",{name:"Try again",exact:true}).click();await page.locator(".conversation-header").waitFor();
  failures.set(endpoint,{status:503,code:"MESSAGES_UNAVAILABLE",message:"Tickets unavailable."});await page.goto(origin+"/dashboard/messages");await toast("Tickets unavailable.");assert.equal(await page.getByText("No messages found.",{exact:true}).count(),0);
  failures.delete(endpoint);await page.getByRole("button",{name:"Try again",exact:true}).click();await page.locator(".ticket-row").waitFor();
  failures.set(endpoint,{status:401,code:"SESSION_EXPIRED",message:"Please log in again."});await page.goto(origin+"/dashboard/messages");await page.waitForURL("**/login");failures.delete(endpoint);
  passed.push("Logo loading without fake empty data; conversation failure retains list; list error/retry; Messages session expiry redirects to Login");

  await open();await selectFirst();
  const pdf={name:"floor-plan.pdf",mimeType:"application/pdf",buffer:Buffer.from("%PDF-1.4\nbrowser attachment")};
  const webp={name:"site-photo.webp",mimeType:"image/webp",buffer:Buffer.from([82,73,70,70,4,0,0,0,87,69,66,80,86,80,56,32])};
  const picker=page.locator('.reply-composer input[type="file"]');
  assert.match(await picker.getAttribute("accept"),/\.webp/);assert.match(await picker.getAttribute("accept"),/image\/webp/);
  await picker.setInputFiles(pdf);await page.getByRole("button",{name:"Remove attachment",exact:true}).click();assert.equal(await page.locator(".selected-message-file").count(),0);
  await picker.setInputFiles(webp);
  failures.set(replyEndpoint,{status:503,code:"MESSAGES_UNAVAILABLE",message:"Attachment could not be sent."});
  await page.getByRole("button",{name:"Send reply",exact:true}).click();await toast("Attachment could not be sent.");assert.match(await page.locator(".selected-message-file").innerText(),/site-photo.webp/);
  failures.delete(replyEndpoint);
  const attachmentPaused=pauseRequest(replyEndpoint);await page.getByRole("button",{name:"Send reply",exact:true}).click();await attachmentPaused;
  assert(await page.getByRole("button",{name:"Attach a file",exact:true}).isDisabled());resume();
  await page.getByRole("button",{name:"Download site-photo.webp",exact:true}).waitFor();assert.equal(await page.locator(".selected-message-file").count(),0);
  const attachment=created.messages.at(-1).attachments[0];assert.equal(created.messages.at(-1).body,"");assert.equal(attachment.sizeBytes,webp.buffer.length);assert.equal(attachment.mimeType,"image/webp");
  const download=page.waitForEvent("download");await page.getByRole("button",{name:"Download site-photo.webp",exact:true}).click();assert.equal((await download).suggestedFilename(),"site-photo.webp");
  for(const width of [1440,1280,1024,768,390,320]){
    await page.setViewportSize({width,height:900});await picker.setInputFiles({...pdf,name:"a-very-long-floor-plan-filename-for-a-property-attachment.pdf"});await overflow();await screenshot(`messages-attachments-${width}`);await page.getByRole("button",{name:"Remove attachment",exact:true}).click();
  }
  await page.setViewportSize({width:1440,height:900});
  await page.getByRole("button",{name:"+ New Ticket",exact:true}).click();await page.getByLabel("Subject",{exact:true}).fill("Attached enquiry");
  await page.getByRole("dialog").locator('input[type="file"]').setInputFiles(pdf);await page.getByRole("button",{name:"Send Message",exact:true}).click();await page.getByRole("dialog").waitFor({state:"detached"});
  await page.getByRole("button",{name:"Download floor-plan.pdf",exact:true}).waitFor();const newId=messagesState.items.at(-1).id;
  await page.getByRole("link",{name:"Overview",exact:true}).click();await page.locator(".recent-messages").getByRole("link",{name:"Attached enquiry",exact:true}).waitFor();
  const recentLink=page.locator(".recent-message-link").filter({hasText:"Attached enquiry"});
  const recentRect=await recentLink.boundingBox();assert(recentRect.width>200&&recentRect.height>=35,"The complete recent-message row must be clickable");
  assert.equal(await page.locator('.dashboard-kpi[aria-label="New Messages"] p').innerText(),"0 messages");
  await screenshot("overview-recent-ticket-conversations");
  await page.locator(".recent-messages").getByRole("link",{name:"Attached enquiry",exact:true}).click();await page.locator(".conversation-header h2").filter({hasText:"Attached enquiry"}).waitFor();assert.equal(new URL(page.url()).searchParams.get("ticket"),newId);
  assert.deepEqual(await page.locator(".message-download svg").evaluateAll(elements=>elements.map(element=>({width:element.getBoundingClientRect().width,height:element.getBoundingClientRect().height}))),[{width:20,height:20}]);
  passed.push("Private PDF/WEBP attachment create/reply/download; WEBP picker contract; file-only messages; remove/retry/pending controls; six-width wrapping; Overview immediately shows customer threads and opens the selected conversation");
}
