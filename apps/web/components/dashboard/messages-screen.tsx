"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AuthApiError } from "../../lib/auth-api";
import { messagesRequest, type TicketDetail, type TicketSummary } from "../../lib/messages-api";
import { showAuthError } from "../auth/toast-provider";
import { BrandLoader } from "../auth/brand-loader";
import { DashboardIcon } from "./dashboard-icon";

const date=(value:string)=>new Date(value).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"});
const time=(value:string)=>new Date(value).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"});
export function MessagesScreen() {
  const router=useRouter();
  const [items,setItems]=useState<TicketSummary[]>([]),[query,setQuery]=useState(""),[search,setSearch]=useState("");
  const [selected,setSelected]=useState<string|null>(null),[detail,setDetail]=useState<TicketDetail|null>(null);
  const [listState,setListState]=useState("loading"),[detailState,setDetailState]=useState("loading");
  const [completedSearch,setCompletedSearch]=useState("");
  const [revision,setRevision]=useState(0),[detailRevision,setDetailRevision]=useState(0);
  const [modal,setModal]=useState(false),[pending,setPending]=useState(false),[reply,setReply]=useState("");
  const [createError,setCreateError]=useState("");
  const dialog=useRef<HTMLDialogElement>(null),end=useRef<HTMLDivElement>(null);
  const writes=useRef(new Set<AbortController>()),busy=useRef(false);
  const createdSelection=useRef<string|null>(null);
  const listLoading=listState==="loading"||query.trim()!==completedSearch;
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
      .then(()=>{if(!controller.signal.aborted)setRevision(value=>value+1);})
      .catch(error=>{if(!controller.signal.aborted)failure(error);});
    return ()=>controller.abort();
  },[detail,selected,failure]);
  useEffect(()=>{end.current?.scrollIntoView({block:"nearest"});},[detail]);
  useEffect(()=>{
    if(!modal)return;
    const element=dialog.current,previous=document.body.style.overflow;
    element?.showModal();document.body.style.overflow="hidden";
    return ()=>{element?.close();document.body.style.overflow=previous;};
  },[modal]);
  function select(id:string|null) {setSelected(id);setDetail(null);setReply("");setDetailState("loading");setDetailRevision(value=>value+1);}
  async function send(event:FormEvent<HTMLFormElement>,creating:boolean) {
    event.preventDefault(); if(busy.current) return;
    const form=event.currentTarget,fields=new FormData(form);
    const message=String(fields.get("message")??"").trim(),subject=String(fields.get("subject")??"").trim();
    if(!message || (creating&&!subject)) {
      if(creating)setCreateError("Enter a subject and message with text.");
      else showAuthError(new Error("Enter a message with text."));
      return;
    }
    if(creating)setCreateError("");
    const controller=new AbortController();writes.current.add(controller);busy.current=true;setPending(true);
    try {
      const data=await messagesRequest<TicketDetail>(creating?"":`/${selected}/messages`,controller.signal,creating?{subject,message}:{message});
      if(controller.signal.aborted) return;
      setSelected(data.id);setDetail(data);setDetailState("ready");setReply("");
      if(creating){createdSelection.current=data.id;setModal(false);setQuery("");setSearch("");}
      setRevision(value=>value+1);
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
      <header className="tickets-header"><h1>My Tickets</h1><button onClick={()=>{setCreateError("");setModal(true);}} disabled={pending}>+ New Ticket</button></header>
      <div className="tickets-search"><input aria-label="Search conversations" placeholder="Search conversations..." maxLength={100} value={query} onChange={event=>setQuery(event.target.value)} /></div>
      <div className="tickets-list" aria-busy={listLoading}>
        {listLoading?<BrandLoader />:listState==="error"?<div className="messages-retry"><p>Could not load tickets.</p><button onClick={()=>{setListState("loading");setRevision(v=>v+1);}}>Try again</button></div>:!items.length?<div className="tickets-empty"><DashboardIcon name="messages"/><p>No messages found.</p></div>:items.map(ticket=><button disabled={pending} className={`ticket-row${selected===ticket.id?" selected":""}`} key={ticket.id} onClick={()=>select(ticket.id)} aria-pressed={selected===ticket.id}>
          <span className="ticket-row-top"><strong>{ticket.subject}</strong><time dateTime={ticket.lastActivityAt}>{date(ticket.lastActivityAt)}</time></span>
          <span className="ticket-row-bottom"><span>{ticket.latestMessagePreview}</span>{ticket.unread&&<span className="ticket-unread" aria-label="Unread support message" />}</span>
        </button>)}
      </div><footer>Threads</footer>
    </aside>
    <section className="conversation-pane" aria-label="Conversation">
      {!selected?<div className="conversation-empty"><span className="conversation-empty-icon"><DashboardIcon name="messages"/></span><h2>Select a Conversation</h2><p>Choose a ticket from the left to view messages or start a new one.</p></div>:<>
        <button className="tickets-back" disabled={pending} onClick={()=>select(null)}>← Back to tickets</button>
        {detailState==="loading"?<BrandLoader />:detailState==="error"?<div className="messages-retry"><p>Could not load this conversation.</p><button onClick={()=>{setDetailState("loading");setDetailRevision(v=>v+1);}}>Try again</button></div>:detail&&<>
          <header className="conversation-header"><h2>{detail.subject}</h2><p>Ticket #{detail.ticketNumber}</p></header>
          <div className="conversation-history" role="log" aria-label="Message history">{detail.messages.map(message=><article key={message.id} className={`message-bubble ${message.senderType.toLowerCase()}`} aria-label={`${message.senderType==="CUSTOMER"?"Customer":"Support"} message`}><p>{message.body}</p><div className="message-time"><time dateTime={message.createdAt} title={date(message.createdAt)}>{time(message.createdAt)}</time>{message.senderType==="CUSTOMER"&&<span aria-label="Sent">✓</span>}</div></article>)}<div ref={end}/></div>
          <form className="reply-composer" onSubmit={event=>void send(event,false)} aria-busy={pending}><textarea name="message" aria-label="Reply" placeholder="Type your reply..." required maxLength={3000} rows={1} value={reply} disabled={pending} onChange={event=>setReply(event.target.value)}/><button type="submit" aria-label="Send reply" disabled={pending||!reply.trim()}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 3 18 9-18 9 3-9-3-9Zm3 9h15" fill="none" stroke="currentColor" strokeWidth="1.7"/></svg></button></form>
        </>}
      </>}
    </section>
    {modal&&<dialog className="new-ticket-dialog" ref={dialog} aria-labelledby="new-ticket-title" onCancel={event=>{if(pending)event.preventDefault();else setModal(false);}} onClose={()=>{if(!pending)setModal(false);}}>
      <form onSubmit={event=>void send(event,true)} aria-busy={pending}><div className="new-ticket-content"><h2 id="new-ticket-title">New Ticket</h2><p>Create a new ticket.</p>{createError&&<p role="alert" className="ticket-create-error">{createError}</p>}<label htmlFor="ticket-subject">Subject</label><input id="ticket-subject" name="subject" placeholder="Enter the subject of the message" required maxLength={160} disabled={pending}/><label htmlFor="ticket-message">Message<span aria-hidden="true">*</span></label><textarea id="ticket-message" name="message" placeholder="Enter the message you want to send to the user" required maxLength={3000} rows={4} disabled={pending}/></div><footer><button type="button" onClick={()=>setModal(false)} disabled={pending}>Cancel</button><button type="submit" disabled={pending}>{pending?"Sending…":"Send Message"}</button></footer></form>
    </dialog>}
  </section>;
}
