import { createClient,type SupabaseClient } from "@supabase/supabase-js";
import type { AuthConfig } from "../auth/config.js";
import { AuthError,unavailable } from "../auth/errors.js";
import type { AdminCompletedPurchaseInput,AdminCompletedPurchaseResult,AdminReferralValidation } from "./purchases-model.js";

export interface AdminPurchasesRepository {
  validate(adminId:string,referralCode:string,customerId:string,propertyCode:string,closedAt:string):Promise<AdminReferralValidation>;
  record(adminId:string,input:AdminCompletedPurchaseInput):Promise<AdminCompletedPurchaseResult>;
}
function purchaseError(error:{code?:string;message?:string}|null):void{
  if(!error)return;
  if(error.code==="P0002")throw new AuthError(404,"PURCHASE_REFERENCE_NOT_FOUND",error.message?.includes("Referral")?"Referral link not found.":error.message?.includes("buyer")?"Verified buyer not found.":"Property not found.");
  if(error.code==="42501")throw new AuthError(403,"ADMIN_PURCHASE_FORBIDDEN","Active Admin access is required.");
  if(error.code==="23505")throw new AuthError(409,"PURCHASE_REQUEST_CONFLICT","This purchase request was already used with different details.");
  if(["23514","23502","22P02"].includes(error.code??""))throw new AuthError(400,"INVALID_PURCHASE_ATTRIBUTION",error.message?.includes("Self-referral")?"Self-referral is not permitted.":error.message?.includes("match")?"The referral does not match this property.":"Check the completed purchase and referral details.");
  throw unavailable();
}
export class SupabaseAdminPurchasesRepository implements AdminPurchasesRepository {
  private readonly db:SupabaseClient;
  constructor(config:AuthConfig,transport:typeof fetch=fetch){this.db=createClient(config.supabaseUrl,config.serviceKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:(input,init)=>transport(input,{...init,signal:init?.signal??AbortSignal.timeout(15000)})}});}
  private async rpc<T>(name:string,args:Record<string,unknown>):Promise<T>{const {data,error}=await this.db.rpc(name,args);purchaseError(error);return data as T;}
  validate(adminId:string,referralCode:string,customerId:string,propertyCode:string,closedAt:string){return this.rpc<AdminReferralValidation>("validate_admin_referral_attribution",{p_admin:adminId,p_referral_code:referralCode,p_buyer:customerId,p_property_code:propertyCode,p_closed_at:closedAt});}
  record(adminId:string,input:AdminCompletedPurchaseInput){return this.rpc<AdminCompletedPurchaseResult>("record_admin_completed_purchase",{p_request_id:input.requestId,p_admin:adminId,p_customer:input.customerId,p_property_code:input.propertyCode,p_price_minor:input.priceMinor,p_closed_at:input.closedAt,p_referral_code:input.referralCode??null});}
}
