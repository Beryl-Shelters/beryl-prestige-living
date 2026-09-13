import { createClient } from "@supabase/supabase-js";
import type { AuthConfig } from "../auth/config.js";
import { AuthError } from "../auth/errors.js";
import type { TicketDetail, TicketSummary } from "./model.js";
import type { MediaAsset } from "../listings/model.js";
export type TicketAsset=MediaAsset & {filename:string};

export interface TicketsRepository {
  list(owner: string, q: string): Promise<{ items: TicketSummary[] }>;
  detail(owner: string, id: string): Promise<TicketDetail>;
  create(owner: string, subject: string, message: string): Promise<TicketDetail>;
  reply(owner: string, id: string, message: string): Promise<TicketDetail>;
  acknowledge(owner: string, id: string, through: string): Promise<void>;
  overview(owner:string):Promise<{unread:number;recent:{id:string;subject:string}[]}>;
  reserveUpload(owner:string,publicId:string):Promise<void>;
  saveAttachment(owner:string,id:string|null,subject:string|null,message:string,asset:TicketAsset):Promise<TicketDetail>;
  attachment(owner:string,id:string,attachmentId:string):Promise<TicketAsset>;
  claimCleanup(owner:string):Promise<string[]>;
  forgetUpload(owner:string,publicId:string):Promise<void>;
}
export function checkTicketError(error: { code?: string } | null) {
  if (!error) return;
  if (error.code === "P0002") throw new AuthError(404,"TICKET_NOT_FOUND","Ticket not found.");
  if (["23514","23502","22P02"].includes(error.code ?? "")) throw new AuthError(400,"INVALID_TICKET","Check the ticket subject and message.");
  throw new AuthError(503,"MESSAGES_UNAVAILABLE","Messages are temporarily unavailable. Please try again.");
}
export class SupabaseTicketsRepository implements TicketsRepository {
  private readonly db;
  constructor(config: AuthConfig) {
    this.db = createClient(config.supabaseUrl,config.serviceKey,{ auth: { persistSession:false,autoRefreshToken:false }, global: {
      fetch: (input,init) => fetch(input,{...init,signal:AbortSignal.timeout(15000)}),
    } });
  }
  private async rpc<T>(name: string, args: Record<string,unknown>): Promise<T> {
    const {data,error} = await this.db.rpc(name,args); checkTicketError(error); return data as T;
  }
  list(owner: string,q: string) { return this.rpc<{items:TicketSummary[]}>("list_customer_tickets",{p_owner:owner,p_q:q}); }
  detail(owner: string,id: string) { return this.rpc<TicketDetail>("read_customer_ticket",{p_owner:owner,p_id:id}); }
  create(owner: string,subject: string,message: string) { return this.rpc<TicketDetail>("create_customer_ticket",{p_owner:owner,p_subject:subject,p_message:message}); }
  reply(owner: string,id: string,message: string) { return this.rpc<TicketDetail>("reply_customer_ticket",{p_owner:owner,p_id:id,p_message:message}); }
  async acknowledge(owner: string,id: string,through: string) { await this.rpc("acknowledge_customer_ticket",{p_owner:owner,p_id:id,p_through:through}); }
  overview(owner:string){return this.rpc<{unread:number;recent:{id:string;subject:string}[]}>("customer_ticket_overview",{p_owner:owner});}
  async reserveUpload(owner:string,publicId:string){await this.rpc("reserve_customer_ticket_upload",{p_owner:owner,p_public_id:publicId});}
  saveAttachment(owner:string,id:string|null,subject:string|null,message:string,asset:TicketAsset){return this.rpc<TicketDetail>("save_customer_ticket_attachment",{p_owner:owner,p_id:id,p_subject:subject,p_message:message,p_asset:asset});}
  attachment(owner:string,id:string,attachmentId:string){return this.rpc<TicketAsset>("get_customer_ticket_attachment",{p_owner:owner,p_id:id,p_attachment:attachmentId});}
  claimCleanup(owner:string){return this.rpc<string[]>("claim_customer_ticket_upload_cleanup",{p_owner:owner});}
  async forgetUpload(owner:string,publicId:string){await this.rpc("forget_customer_ticket_upload",{p_owner:owner,p_public_id:publicId});}
}
