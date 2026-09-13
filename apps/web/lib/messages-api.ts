import { AuthApiError } from "./auth-api";

export type TicketAttachment={id:string;filename:string;mimeType:string;sizeBytes:number};
export type TicketMessage = { id:string; senderType:"CUSTOMER"|"SUPPORT"; body:string; createdAt:string; readByCustomerAt:string|null; attachments?:TicketAttachment[] };
export type TicketSummary = { id:string; ticketNumber:string; subject:string; latestMessagePreview:string; lastActivityAt:string; unread:boolean };
export type TicketDetail = { id:string; ticketNumber:string; subject:string; createdAt:string; lastActivityAt:string; messages:TicketMessage[] };

export async function messagesRequest<T>(path:string, signal:AbortSignal, body?:object, attempt=0):Promise<T> {
  const base=process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!base) throw new AuthApiError("CONFIGURATION_UNAVAILABLE","Messages are not configured.");
  let response:Response;
  try { response=await fetch(`${base.replace(/\/$/,"")}/api/v1/messages/tickets${path}`,{
    method:body?"POST":"GET",credentials:"include",cache:"no-store",signal,
    ...(body?body instanceof FormData?{body}:{headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}:{}),
  }); } catch(error) {
    if(signal.aborted) throw error;
    throw new AuthApiError("NETWORK_ERROR","Could not connect to Messages. Please try again.");
  }
  let payload:{success:boolean;data:T;error?:{code:string;message:string}};
  try { payload=await response.json(); } catch { throw new AuthApiError("INVALID_RESPONSE","Messages are temporarily unavailable. Please try again."); }
  // This response is emitted before entering a write handler. Never retry an
  // ambiguous network/server failure automatically: it may have persisted.
  if(payload.error?.code==="SESSION_REFRESHING" && attempt<3) {
    await new Promise(resolve=>setTimeout(resolve,400));
    signal.throwIfAborted(); return messagesRequest(path,signal,body,attempt+1);
  }
  if(!response.ok || !payload.success) throw new AuthApiError(payload.error?.code??"MESSAGES_UNAVAILABLE",payload.error?.message??"Messages are temporarily unavailable. Please try again.",response.status);
  return payload.data;
}

export async function downloadTicketAttachment(ticketId:string,attachment:TicketAttachment,signal:AbortSignal){
  const base=process.env.NEXT_PUBLIC_API_BASE_URL;
  if(!base)throw new AuthApiError("CONFIGURATION_UNAVAILABLE","Messages are not configured.");
  const response=await fetch(`${base.replace(/\/$/,"")}/api/v1/messages/tickets/${ticketId}/attachments/${attachment.id}`,{credentials:"include",cache:"no-store",signal});
  if(!response.ok)throw new AuthApiError("ATTACHMENT_UNAVAILABLE","Could not download this attachment. Please try again.",response.status);
  const blob=await response.blob();signal.throwIfAborted();
  const url=URL.createObjectURL(blob),link=document.createElement("a");
  link.href=url;link.download=attachment.filename;document.body.appendChild(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
