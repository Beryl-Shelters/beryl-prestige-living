import { createClient } from "@supabase/supabase-js";
import type { AuthConfig } from "../auth/config.js";
import { AuthError } from "../auth/errors.js";
import type { CreatedReferral, CreatedWithdrawal, ReferralPage, WithdrawalPage } from "./model.js";

type CreatedRow=Omit<CreatedReferral,"referralUrl">;
export interface ReferralsRepository { list(owner:string,page:number,pageSize:number):Promise<Omit<ReferralPage,"program">>; create(owner:string,type:"PROPERTY"|"SELLER",listingId:string|null):Promise<CreatedRow>; createPublicProperty(owner:string,propertyCode:string):Promise<CreatedRow>; withdrawals(owner:string,minimumMinor:number,page:number,pageSize:number):Promise<WithdrawalPage>; requestWithdrawal(requestId:string,owner:string,amountMinor:number,minimumMinor:number):Promise<CreatedWithdrawal>; cancelWithdrawal(owner:string,id:string):Promise<{id:string;status:"CANCELLED"}>; }
function check(error:{code?:string;message?:string}|null){
  if(!error)return;
  if(error.code==="P0002")throw new AuthError(404,error.message?.includes("Withdrawal")?"WITHDRAWAL_NOT_FOUND":"LISTING_NOT_FOUND",error.message??"Not found.");
  if(error.code==="23505")throw new AuthError(409,"WITHDRAWAL_REQUEST_CONFLICT",error.message??"This withdrawal request was already used.");
  if(error.code==="40001")throw new AuthError(409,"WITHDRAWAL_BALANCE_CHANGED","Your available balance changed. Review it and try again.");
  if(["23514","23502","22P02"].includes(error.code??"")){
    const message=error.message??"Check the referral details.";
    throw new AuthError(400,message.includes("details")?"PAYMENT_DETAILS_MISSING":message.includes("balance")?"INSUFFICIENT_WITHDRAWAL_BALANCE":message.includes("minimum")||message.includes("amount")?"INVALID_WITHDRAWAL_AMOUNT":message.includes("cancelled")?"WITHDRAWAL_NOT_CANCELLABLE":"INVALID_REFERRAL",message);
  }
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
  async createPublicProperty(owner:string,propertyCode:string){
    for(let attempt=0;attempt<3;attempt++){
      const {data,error}=await this.db.rpc("create_listed_property_referral_link",{p_referrer:owner,p_property_code:propertyCode});
      if(error?.code==="23505"&&error.message.includes("customer_referral_links_referral_code_key")&&attempt<2)continue;
      check(error);return data as CreatedRow;
    }
    throw new AuthError(503,"REFERRALS_UNAVAILABLE","Referrals are temporarily unavailable. Please try again.");
  }
  withdrawals(owner:string,minimumMinor:number,page:number,pageSize:number){return this.rpc<WithdrawalPage>("list_customer_referral_withdrawals",{p_owner:owner,p_minimum_minor:minimumMinor,p_page:page,p_page_size:pageSize});}
  requestWithdrawal(requestId:string,owner:string,amountMinor:number,minimumMinor:number){return this.rpc<CreatedWithdrawal>("create_customer_referral_withdrawal",{p_request_id:requestId,p_owner:owner,p_amount_minor:amountMinor,p_minimum_minor:minimumMinor});}
  cancelWithdrawal(owner:string,id:string){return this.rpc<{id:string;status:"CANCELLED"}>("cancel_customer_referral_withdrawal",{p_owner:owner,p_withdrawal:id});}
}
