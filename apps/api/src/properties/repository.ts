import { createClient } from "@supabase/supabase-js";
import type { AuthConfig } from "../auth/config.js";
import { AuthError } from "../auth/errors.js";
import type { PurchasedProperty } from "./model.js";

export interface PurchasedPropertiesRepository {
  list(customerId: string, search: string, page: number, pageSize: number): Promise<{ items: PurchasedProperty[]; total: number }>;
}

function check(error:{code?:string}|null){
  if(!error)return;
  if(["23514","23502","22P02"].includes(error.code??""))throw new AuthError(400,"INVALID_PROPERTIES_QUERY","Check the purchased-properties query.");
  throw new AuthError(503,"PROPERTIES_UNAVAILABLE","Purchased properties are temporarily unavailable. Please try again.");
}

export class SupabasePurchasedPropertiesRepository implements PurchasedPropertiesRepository {
  private readonly db;
  constructor(config:AuthConfig){
    this.db=createClient(config.supabaseUrl,config.serviceKey,{auth:{persistSession:false,autoRefreshToken:false},global:{
      fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(15000)}),
    }});
  }
  async list(customerId:string,search:string,page:number,pageSize:number){
    const {data,error}=await this.db.rpc("list_customer_completed_purchases",{p_owner:customerId,p_query:search,p_page:page,p_page_size:pageSize});
    check(error);return data as {items:PurchasedProperty[];total:number};
  }
}
