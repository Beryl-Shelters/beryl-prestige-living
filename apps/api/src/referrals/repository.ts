import { createClient } from "@supabase/supabase-js";
import type { AuthConfig } from "../auth/config.js";
import { AuthError } from "../auth/errors.js";
import type { CreatedReferral, ReferralPage } from "./model.js";

type CreatedRow=Omit<CreatedReferral,"referralUrl">;
export interface ReferralsRepository { list(owner:string,page:number,pageSize:number):Promise<Omit<ReferralPage,"program">>; create(owner:string,type:"PROPERTY"|"SELLER",listingId:string|null):Promise<CreatedRow>; }
function check(error:{code?:string;message?:string}|null){
  if(!error)return;
  if(error.code==="P0002")throw new AuthError(404,"LISTING_NOT_FOUND","Listing not found.");
  if(["23514","23502","22P02"].includes(error.code??""))throw new AuthError(400,"INVALID_REFERRAL","Check the referral details.");
  throw new AuthError(503,"REFERRALS_UNAVAILABLE","Referrals are temporarily unavailable. Please try again.");
}
export class SupabaseReferralsRepository implements ReferralsRepository {
  private readonly db;
  constructor(config:AuthConfig){this.db=createClient(config.supabaseUrl,config.serviceKey,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(15000)})}});}
  private async rpc<T>(name:string,args:Record<string,unknown>){const {data,error}=await this.db.rpc(name,args);check(error);return data as T;}
  list(owner:string,page:number,pageSize:number){return this.rpc<Omit<ReferralPage,"program">>("list_customer_referrals",{p_owner:owner,p_page:page,p_page_size:pageSize});}
  async create(owner:string,type:"PROPERTY"|"SELLER",listingId:string|null){
    for(let attempt=0;attempt<3;attempt++){
      const {data,error}=await this.db.rpc("create_customer_referral_link",{p_owner:owner,p_type:type,p_listing:listingId});
      if(error?.code==="23505"&&error.message.includes("customer_referral_links_referral_code_key")&&attempt<2)continue;
      check(error);return data as CreatedRow;
    }
    throw new AuthError(503,"REFERRALS_UNAVAILABLE","Referrals are temporarily unavailable. Please try again.");
  }
}
