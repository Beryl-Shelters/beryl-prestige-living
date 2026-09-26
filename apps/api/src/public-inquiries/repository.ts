import { createClient } from "@supabase/supabase-js";
import type { AuthConfig } from "../auth/config.js";

export const inquiryTypes = ["Property Inquiry","Buying a Property","Selling/Listing a Property","Property Viewing","General Inquiry","Other"] as const;
export const inquirySources = ["home","about","referrals","buy","sell","analytics","careers","support","saved-properties","compare-properties","mortgage-calculator","other"] as const;
export type RealEstateInquiry = { inquiryType: typeof inquiryTypes[number]; name: string; phone: string; email: string; message: string; sourcePage: typeof inquirySources[number] };
export interface PublicInquiriesRepository { submit(inquiry: RealEstateInquiry): Promise<void> }

export class SupabasePublicInquiriesRepository implements PublicInquiriesRepository {
  private readonly db;
  constructor(config: AuthConfig) { this.db=createClient(config.supabaseUrl,config.serviceKey,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(15000)})}}); }
  async submit(inquiry: RealEstateInquiry): Promise<void> {
    const {error}=await this.db.from("public_real_estate_inquiries").insert({inquiry_type:inquiry.inquiryType,full_name:inquiry.name,phone:inquiry.phone,email:inquiry.email,message:inquiry.message,source_page:inquiry.sourcePage});
    if(error)throw new Error("Inquiry unavailable");
  }
}
