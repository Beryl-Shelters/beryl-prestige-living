"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AuthApiError } from "../../lib/auth-api";
import { messagesRequest, downloadTicketAttachment, type TicketAttachment, type TicketDetail, type TicketSummary } from "../../lib/messages-api";
import { showAuthError } from "../auth/toast-provider";
import { BrandLoader } from "../auth/brand-loader";
import { DashboardIcon } from "./dashboard-icon";
import { AttachmentPicker, SelectedAttachment, PaperclipIcon } from "./message-attachment";
import { useDashboard } from "./dashboard-provider";

const date=(value:string)=>new Date(value).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"});
const time=(value:string)=>new Date(value).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"});
const dateTime=(value:string)=>new Date(value).toLocaleString("en-GB",{day:"numeric",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"});
type TicketFilter="ALL"|"UNREAD"|"RESOLVED";
export function MessagesScreen({initialTicket=null}:{initialTicket?:string|null}) {
  const router=useRouter();
  const {refreshOverview}=useDashboard();
  const overviewRefresh=useRef(refreshOverview);
  useEffect(()=>{overviewRefresh.current=refreshOverview;},[refreshOverview]);
  const [items,setItems]=useState<TicketSummary[]>([]),[query,setQuery]=useState(""),[search,setSearch]=useState("");
  const [selected,setSelected]=useState<string|null>(initialTicket),[detail,setDetail]=useState<TicketDetail|null>(null);
  const [listState,setListState]=useState("loading"),[detailState,setDetailState]=useState("loading");
  const [completedSearch,setCompletedSearch]=useState("");
  const [revision,setRevision]=useState(0),[detailRevision,setDetailRevision]=useState(0);
  const [modal,setModal]=useState(false),[pending,setPending]=useState(false),[reply,setReply]=useState("");
  const [filter,setFilter]=useState<TicketFilter>("ALL");
  const [createError,setCreateError]=useState("");
  const [replyFile,setReplyFile]=useState<File|null>(null),[createFile,setCreateFile]=useState<File|null>(null);
  const [downloading,setDownloading]=useState<string|null>(null);
  const dialog=useRef<HTMLDialogElement>(null),end=useRef<HTMLDivElement>(null),modalTrigger=useRef<HTMLElement|null>(null);
  const writes=useRef(new Set<AbortController>()),busy=useRef(false);
  const createdSelection=useRef<string|null>(null);
  const listLoading=listState==="loading"||query.trim()!==completedSearch;
  const filteredItems=items.filter(ticket=>filter==="ALL"||(filter==="UNREAD"?ticket.unread:ticket.status==="RESOLVED"));
  const counts={ALL:items.length,UNREAD:items.filter(ticket=>ticket.unread).length,RESOLVED:items.filter(ticket=>ticket.status==="RESOLVED").length};
  const failure=useCallback((error:unknown)=>{
    if(error instanceof AuthApiError && error.status===401) router.replace("/login");
    else showAuthError(error,"messages-error");
  },[router]);
  useEffect(()=>{ const controllers=writes.current; return ()=>{for(const controller of controllers) controller.abort();}; },[]);
  useEffect(()=>{if(query.trim()===search) return; const timer=setTimeout(()=>setSearch(query.trim()),300); return ()=>clearTimeout(timer);},[query,search]);
  useEffect(()=>{
    const controller=new AbortController();
    messagesRequest<{items:TicketSummary[]}>(`?${new URLSearchParams({q:search})}`,controller.signal)
      .then(data=>{if(!controller.signal.aborted){setItems(data.items);setCompletedSearch(search);setListState("ready");}})
      .catch(error=>{if(!controller.signal.aborted){setCompletedSearch(search);setListState("error");failure(error);}});
    return ()=>controller.abort();
  },[search,revision,failure]);
  useEffect(()=>{
    if(!selected) return;
    if(createdSelection.current===selected){createdSelection.current=null;return;}
    const controller=new AbortController();
    messagesRequest<TicketDetail>(`/${selected}`,controller.signal)
      .then(data=>{if(!controller.signal.aborted){setDetail(data);setDetailState("ready");}})
      .catch(error=>{if(!controller.signal.aborted){setDetailState("error");failure(error);}});
    return ()=>controller.abort();
  },[selected,detailRevision,failure]);
  // Runs after the opened snapshot is rendered. The server watermark excludes
  // later SUPPORT replies; list refresh derives the dot from authoritative data.
  useEffect(()=>{
    if(!detail || detail.id!==selected || !detail.messages.some(m=>m.senderType==="SUPPORT"&&!m.readByCustomerAt)) return;
    const controller=new AbortController();
    messagesRequest(`/${detail.id}/read`,controller.signal,{throughMessageId:detail.messages.at(-1)!.id})
      .then(()=>{if(!controller.signal.aborted){setRevision(value=>value+1);overviewRefresh.current();}})
      .catch(error=>{if(!controller.signal.aborted)failure(error);});
    return ()=>controller.abort();
  },[detail,selected,failure]);
  useEffect(()=>{end.current?.scrollIntoView({block:"nearest"});},[detail]);
  useEffect(()=>{
    if(!modal)return;
    const element=dialog.current,previous=document.body.style.overflow,trigger=modalTrigger.current;
    element?.showModal();element?.querySelector<HTMLInputElement>("#ticket-subject")?.focus();document.body.style.overflow="hidden";
    return ()=>{element?.close();document.body.style.overflow=previous;trigger?.focus();};
  },[modal]);
  function openModal(){modalTrigger.current=document.activeElement instanceof HTMLElement?document.activeElement:null;setCreateError("");setCreateFile(null);setModal(true);}
  function select(id:string|null) {setSelected(id);setDetail(null);setReply("");setReplyFile(null);setDetailState("loading");setDetailRevision(value=>value+1);}
  async function download(attachment:TicketAttachment){
    if(!selected||downloading)return;
    const controller=new AbortController();writes.current.add(controller);setDownloading(attachment.id);
    try{await downloadTicketAttachment(selected,attachment,controller.signal);}
    catch(error){if(!controller.signal.aborted)failure(error);}
    finally{writes.current.delete(controller);if(!controller.signal.aborted)setDownloading(null);}
  }
  async function send(event:FormEvent<HTMLFormElement>,creating:boolean) {
    event.preventDefault(); if(busy.current) return;
    const form=event.currentTarget,fields=new FormData(form);
    const message=String(fields.get("message")??"").trim(),subject=String(fields.get("subject")??"").trim();
    const file=creating?createFile:replyFile;
    if((!message&&!file) || (creating&&!subject)) {
      if(creating)setCreateError("Enter a subject and message with text.");
      else showAuthError(new Error("Enter a message with text."));
      return;
    }
    if(creating)setCreateError("");
    const controller=new AbortController();writes.current.add(controller);busy.current=true;setPending(true);
    try {
      let body:object=creating?{subject,message}:{message};
      if(file){const upload=new FormData();upload.set("data",JSON.stringify(body));upload.set("attachment",file);body=upload;}
      const data=await messagesRequest<TicketDetail>(creating?"":`/${selected}/messages`,controller.signal,body);
      if(controller.signal.aborted) return;
      setSelected(data.id);setDetail(data);setDetailState("ready");setReply("");setReplyFile(null);
      if(creating){createdSelection.current=data.id;setModal(false);setQuery("");setSearch("");setCreateFile(null);}
      setRevision(value=>value+1);
      overviewRefresh.current();
    } catch(error){if(!controller.signal.aborted){
      // The native dialog covers global toasts. Report create failures here,
      // without a hidden duplicate suppressing the next Messages error toast.
      if(creating && !(error instanceof AuthApiError && error.status===401))
        setCreateError(error instanceof Error?error.message:"Could not send your message. Please try again.");
      else failure(error);
    }}
    finally {writes.current.delete(controller);busy.current=false;if(!controller.signal.aborted)setPending(false);}
  }
  return <section className={`messages-workspace${selected?" has-selection":""}`} aria-label="Messages">
    <aside className="tickets-pane" aria-label="Tickets">
      <header className="tickets-header"><h1>My Tickets</h1><button onClick={openModal} disabled={pending}>+ New Ticket</button></header>
      <div className="tickets-search"><input aria-label="Search conversations" placeholder="Search Conversations" maxLength={100} value={query} onChange={event=>setQuery(event.target.value)} /></div>
      <div className="ticket-filters" role="group" aria-label="Filter tickets">
        {(["ALL","UNREAD","RESOLVED"] as const).map(value=><button key={value} type="button" className={filter===value?"active":""} aria-pressed={filter===value} onClick={()=>setFilter(value)}>{value==="ALL"?"All":value==="UNREAD"?"Unread":"Resolved"}<span>{counts[value]}</span></button>)}
      </div>
      <div className="tickets-list" aria-busy={listLoading}>
        {listLoading?<BrandLoader />:listState==="error"?<div className="messages-retry"><p>Could not load tickets.</p><button onClick={()=>{setListState("loading");setRevision(v=>v+1);}}>Try again</button></div>:!items.length&&!completedSearch?<div className="tickets-empty"><DashboardIcon name="messages"/><h2>No messages yet</h2><button type="button" onClick={openModal}>Create a new ticket</button></div>:!filteredItems.length?<div className="tickets-empty"><p>{completedSearch?"No messages found.":`No ${filter.toLowerCase()} tickets.`}</p></div>:filteredItems.map(ticket=><button disabled={pending} className={`ticket-row${selected===ticket.id?" selected":""}`} key={ticket.id} onClick={()=>select(ticket.id)} aria-pressed={selected===ticket.id}>
          <span className="ticket-row-meta"><span>Ticket #{ticket.ticketNumber}</span><span className={`ticket-status ${ticket.status.toLowerCase()}`}>{ticket.status==="RESOLVED"?"Resolved":"Open"}</span></span>
          <span className="ticket-row-top"><strong>{ticket.subject}</strong><time dateTime={ticket.lastActivityAt}>{date(ticket.lastActivityAt)}</time></span>
          <span className="ticket-row-bottom"><span>{ticket.latestMessagePreview}</span>{ticket.unread&&<span className="ticket-unread" aria-label="Unread support message" />}</span>
        </button>)}
      </div><footer>Threads</footer>
    </aside>
    <section className="conversation-pane" aria-label="Conversation">
      {!selected?<div className="conversation-empty"><span className="conversation-empty-icon"><DashboardIcon name="messages"/></span><h2>Select a Conversation</h2><p>Choose a ticket from the left to view messages or start a new one.</p></div>:<>
        <button className="tickets-back" disabled={pending} onClick={()=>select(null)}>← Back to tickets</button>
        {detailState==="loading"?<BrandLoader />:detailState==="error"?<div className="messages-retry"><p>Could not load this conversation.</p><button onClick={()=>{setDetailState("loading");setDetailRevision(v=>v+1);}}>Try again</button></div>:detail&&<>
          <header className="conversation-header"><div><h2>Ticket #{detail.ticketNumber}</h2><p>{detail.subject}</p></div><div className="conversation-status"><span className={`ticket-status ${detail.status.toLowerCase()}`}>{detail.status==="RESOLVED"?"Resolved":"Open"}</span><small>Last activity {dateTime(detail.lastActivityAt)}</small></div></header>
          <div className="conversation-history" role="log" aria-label="Message history"><p className="ticket-opened">Ticket opened {dateTime(detail.createdAt)}</p>{detail.messages.map(message=><article key={message.id} className={`message-bubble ${message.senderType.toLowerCase()}`} aria-label={`${message.senderType==="CUSTOMER"?"Customer":"Support"} message`}>{message.body&&<p>{message.body}</p>}{message.attachments?.map(attachment=><button key={attachment.id} type="button" className="message-download" disabled={!!downloading} onClick={()=>void download(attachment)} aria-label={`Download ${attachment.filename}`}><PaperclipIcon/><span>{attachment.filename}<small>{downloading===attachment.id?"Downloading…":`${(attachment.sizeBytes/1024).toFixed(1)} KB · Download`}</small></span></button>)}<div className="message-time"><time dateTime={message.createdAt} title={date(message.createdAt)}>{time(message.createdAt)}</time>{message.senderType==="CUSTOMER"&&<span aria-label="Sent">✓</span>}</div></article>)}<div ref={end}/></div>
          {detail.status==="RESOLVED"?<div className="resolved-ticket" role="status"><strong>Ticket resolved on {dateTime(detail.resolvedAt!)}</strong><p>You can’t send or receive messages for this ticket anymore.</p><button type="button" onClick={openModal}>Create a new ticket instead</button></div>:<div className="reply-area">{replyFile&&<SelectedAttachment file={replyFile} disabled={pending} onRemove={()=>setReplyFile(null)}/>}<form className="reply-composer" onSubmit={event=>void send(event,false)} aria-busy={pending}><AttachmentPicker disabled={pending} onChange={setReplyFile} onError={message=>failure(new Error(message))}/><textarea name="message" aria-label="Reply" placeholder="Type a message" required={!replyFile} maxLength={3000} rows={1} value={reply} disabled={pending} onChange={event=>setReply(event.target.value)}/><button type="submit" aria-label="Send reply" disabled={pending||(!reply.trim()&&!replyFile)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 3 18 9-18 9 3-9-3-9Zm3 9h15" fill="none" stroke="currentColor" strokeWidth="1.7"/></svg></button></form></div>}
        </>}
      </>}
    </section>
    {modal&&<dialog className="new-ticket-dialog" ref={dialog} aria-labelledby="new-ticket-title" onCancel={event=>{if(pending)event.preventDefault();else setModal(false);}} onClose={()=>{if(!pending)setModal(false);}}>
      <form onSubmit={event=>void send(event,true)} aria-busy={pending}><div className="new-ticket-content"><button className="new-ticket-close" type="button" aria-label="Close new ticket" onClick={()=>setModal(false)} disabled={pending}>×</button><h2 id="new-ticket-title">New Ticket</h2><p>Send a message to our support team.</p>{createError&&<p id="ticket-create-error" role="alert" className="ticket-create-error">{createError}</p>}<label htmlFor="ticket-subject">Subject <span aria-hidden="true">*</span></label><input autoFocus id="ticket-subject" name="subject" aria-label="Subject" placeholder="Enter subject of the message" required maxLength={160} disabled={pending} aria-describedby={createError?"ticket-create-error":undefined}/><label htmlFor="ticket-message">Message{!createFile&&<span aria-hidden="true"> *</span>}</label><textarea id="ticket-message" name="message" aria-label="Message" placeholder="Enter message you want to send" required={!createFile} maxLength={3000} rows={4} disabled={pending} aria-describedby={createError?"ticket-create-error":undefined}/><div className="new-ticket-attachment"><AttachmentPicker disabled={pending} onChange={setCreateFile} onError={setCreateError}/><span>PDF, JPG, PNG or WEBP · Up to 10 MB</span></div>{createFile&&<SelectedAttachment file={createFile} disabled={pending} onRemove={()=>setCreateFile(null)}/>}</div><footer><button className="ticket-send" type="submit" disabled={pending}>{pending?"Sending…":"Send Message"}</button><button className="ticket-cancel" type="button" onClick={()=>setModal(false)} disabled={pending}>Cancel</button></footer></form>
    </dialog>}
  </section>;
}
