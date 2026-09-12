import { createClient } from "@supabase/supabase-js";
import type { AuthConfig } from "../auth/config.js";
import { AuthError } from "../auth/errors.js";
import type { TicketDetail, TicketSummary } from "./model.js";

export interface TicketsRepository {
  list(owner: string, q: string): Promise<{ items: TicketSummary[] }>;
  detail(owner: string, id: string): Promise<TicketDetail>;
  create(owner: string, subject: string, message: string): Promise<TicketDetail>;
  reply(owner: string, id: string, message: string): Promise<TicketDetail>;
  acknowledge(owner: string, id: string, through: string): Promise<void>;
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
  private async rpc<T>(name: string, args: Record<string,string>): Promise<T> {
    const {data,error} = await this.db.rpc(name,args); checkTicketError(error); return data as T;
  }
  list(owner: string,q: string) { return this.rpc<{items:TicketSummary[]}>("list_customer_tickets",{p_owner:owner,p_q:q}); }
  detail(owner: string,id: string) { return this.rpc<TicketDetail>("read_customer_ticket",{p_owner:owner,p_id:id}); }
  create(owner: string,subject: string,message: string) { return this.rpc<TicketDetail>("create_customer_ticket",{p_owner:owner,p_subject:subject,p_message:message}); }
  reply(owner: string,id: string,message: string) { return this.rpc<TicketDetail>("reply_customer_ticket",{p_owner:owner,p_id:id,p_message:message}); }
  async acknowledge(owner: string,id: string,through: string) { await this.rpc("acknowledge_customer_ticket",{p_owner:owner,p_id:id,p_through:through}); }
}
