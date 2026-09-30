import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AuthConfig } from "../auth/config.js";
import { AuthError, unavailable } from "../auth/errors.js";
import type { MediaAsset } from "../listings/model.js";
import type {
  AdminPaymentPreview,
  AdminPaymentResult,
  AdminWithdrawalPaymentPreview,
  AdminWithdrawalPaymentResult,
  AdminReferrerDetail,
  AdminReferrerDirectoryPage,
  AdminReferrerQuery,
  AdminWithdrawalQuery,
  AdminWithdrawalQueuePage,
} from "./referrers-model.js";

export interface AdminReferrersRepository {
  directory(query: AdminReferrerQuery): Promise<AdminReferrerDirectoryPage>;
  detail(
    id: string,
    page: number,
    pageSize: number,
  ): Promise<AdminReferrerDetail>;
  withdrawals(query:AdminWithdrawalQuery):Promise<AdminWithdrawalQueuePage>;
  preview(admin: string, commission: string): Promise<AdminPaymentPreview>;
  record(
    requestId: string,
    admin: string,
    commission: string,
    receipt: MediaAsset,
  ): Promise<AdminPaymentResult>;
  byRequest(
    admin: string,
    requestId: string,
  ): Promise<AdminPaymentResult | null>;
  receipt(admin: string, payment: string): Promise<MediaAsset>;
  beginWithdrawal(admin:string,withdrawal:string):Promise<{id:string;status:"PROCESSING"}>;
  rejectWithdrawal(admin:string,withdrawal:string,reason:string):Promise<{id:string;status:"REJECTED";rejectionReason:string}>;
  withdrawalPreview(admin:string,withdrawal:string):Promise<AdminWithdrawalPaymentPreview>;
  recordWithdrawal(requestId:string,admin:string,withdrawal:string,receipt:MediaAsset):Promise<AdminWithdrawalPaymentResult>;
  withdrawalByRequest(admin:string,requestId:string):Promise<AdminWithdrawalPaymentResult|null>;
}
function check(error: { code?: string; message?: string } | null): void {
  if (!error) return;
  if (error.code === "P0002")
    throw new AuthError(
      404,
      "REFERRAL_PAYMENT_NOT_FOUND",
      error.message ?? "Referral payment not found.",
    );
  if (error.code === "42501")
    throw new AuthError(
      403,
      "ADMIN_REFERRERS_FORBIDDEN",
      "Active Admin access is required.",
    );
  if (error.code === "23505")
    throw new AuthError(
      409,
      error.message?.includes("Withdrawal")?"WITHDRAWAL_ALREADY_PAID":"COMMISSION_UNAVAILABLE",
      error.message?.includes("Withdrawal")?"This withdrawal has already been recorded as paid.":error.message?.includes("reserved")?"This commission is already paid or reserved by an active withdrawal request.":"This commission has already been recorded as paid.",
    );
  if (["23514", "23502", "22P02"].includes(error.code ?? ""))
    throw new AuthError(
      400,
      error.message?.includes("details")
        ? "PAYMENT_DETAILS_MISSING"
        : "INVALID_REFERRER_REQUEST",
      error.message?.includes("details")
        ? "The referrer must add complete payment details before this can be recorded."
        : "Check the referrer payment details.",
    );
  throw unavailable();
}
export class SupabaseAdminReferrersRepository implements AdminReferrersRepository {
  private readonly db: SupabaseClient;
  constructor(config: AuthConfig, transport: typeof fetch = fetch) {
    this.db = createClient(config.supabaseUrl, config.serviceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: {
        fetch: (input, init) =>
          transport(input, {
            ...init,
            signal: init?.signal ?? AbortSignal.timeout(15000),
          }),
      },
    });
  }
  private async rpc<T>(
    name: string,
    args: Record<string, unknown>,
  ): Promise<T> {
    const { data, error } = await this.db.rpc(name, args);
    check(error);
    return data as T;
  }
  directory(q: AdminReferrerQuery) {
    return this.rpc<AdminReferrerDirectoryPage>("list_admin_referrers", {
      p_query: q.search,
      p_filter: q.filter,
      p_sort: q.sort,
      p_page: q.page,
      p_page_size: q.pageSize,
    });
  }
  detail(id: string, page: number, pageSize: number) {
    return this.rpc<AdminReferrerDetail>("read_admin_referrer", {
      p_referrer: id,
      p_page: page,
      p_page_size: pageSize,
    });
  }
  async withdrawals(q:AdminWithdrawalQuery):Promise<AdminWithdrawalQueuePage>{
    let request=this.db.from("referral_withdrawal_requests").select("id,public_id,referrer_id,amount_minor,status,bank_name_snapshot,account_number_last4,requested_at,processing_started_at,rejected_at,rejection_reason,cancelled_at,paid_at",{count:"exact"});
    if(q.status!=="ALL")request=request.eq("status",q.status);
    const from=(q.page-1)*q.pageSize,{data,error,count}=await request.order("requested_at",{ascending:false}).order("id",{ascending:false}).range(from,from+q.pageSize-1);
    check(error);const rows=(data??[]) as {id:string;public_id:string;referrer_id:string;amount_minor:number;status:AdminWithdrawalQueuePage["items"][number]["status"];bank_name_snapshot:string;account_number_last4:string;requested_at:string;processing_started_at:string|null;rejected_at:string|null;rejection_reason:string|null;cancelled_at:string|null;paid_at:string|null}[];
    const owners=[...new Set(rows.map(row=>row.referrer_id))],profiles=new Map<string,{name:string;email:string}>(),payments=new Map<string,string>();
    if(owners.length){const result=await this.db.from("customer_profiles").select("id,first_name,last_name,email").in("id",owners);check(result.error);for(const profile of result.data??[]){profiles.set(String(profile.id),{name:[profile.first_name,profile.last_name].filter(Boolean).join(" ")||String(profile.email),email:String(profile.email)});}}
    if(rows.length){const result=await this.db.from("referral_commission_payouts").select("withdrawal_request_id,public_id").in("withdrawal_request_id",rows.map(row=>row.id));check(result.error);for(const payment of result.data??[])if(payment.withdrawal_request_id)payments.set(String(payment.withdrawal_request_id),String(payment.public_id));}
    const total=count??0;
    return {items:rows.map(row=>{const profile=profiles.get(row.referrer_id);return {id:row.public_id,referrerId:row.referrer_id,referrerName:profile?.name??"Customer",referrerEmail:profile?.email??"",amountMinor:row.amount_minor,status:row.status,bankName:row.bank_name_snapshot,maskedAccountNumber:`••••••${row.account_number_last4}`,requestedAt:row.requested_at,updatedAt:row.paid_at??row.rejected_at??row.cancelled_at??row.processing_started_at,rejectionReason:row.rejection_reason,paymentId:payments.get(row.id)??null};}),page:q.page,pageSize:q.pageSize,total,totalPages:total?Math.ceil(total/q.pageSize):0};
  }
  preview(admin: string, commission: string) {
    return this.rpc<AdminPaymentPreview>(
      "read_admin_referral_payment_preview",
      { p_admin: admin, p_commission: commission },
    );
  }
  record(
    requestId: string,
    admin: string,
    commission: string,
    receipt: MediaAsset,
  ) {
    return this.rpc<AdminPaymentResult>("record_admin_referral_payout", {
      p_request_id: requestId,
      p_admin: admin,
      p_commission: commission,
      p_receipt_public_id: receipt.public_id,
      p_receipt_resource_type: receipt.resource_type,
      p_receipt_delivery_type: receipt.delivery_type,
      p_receipt_mime_type: receipt.mime_type,
      p_receipt_size_bytes: receipt.size_bytes,
    });
  }
  byRequest(admin: string, requestId: string) {
    return this.rpc<AdminPaymentResult | null>(
      "read_admin_referral_payout_request",
      { p_admin: admin, p_request_id: requestId },
    );
  }
  receipt(admin: string, payment: string) {
    return this.rpc<MediaAsset>("read_admin_referral_payout_receipt", {
      p_admin: admin,
      p_payment: payment,
    });
  }
  beginWithdrawal(admin:string,withdrawal:string){return this.rpc<{id:string;status:"PROCESSING"}>("begin_admin_referral_withdrawal",{p_admin:admin,p_withdrawal:withdrawal});}
  rejectWithdrawal(admin:string,withdrawal:string,reason:string){return this.rpc<{id:string;status:"REJECTED";rejectionReason:string}>("reject_admin_referral_withdrawal",{p_admin:admin,p_withdrawal:withdrawal,p_reason:reason});}
  withdrawalPreview(admin:string,withdrawal:string){return this.rpc<AdminWithdrawalPaymentPreview>("read_admin_referral_withdrawal_payment_preview",{p_admin:admin,p_withdrawal:withdrawal});}
  recordWithdrawal(requestId:string,admin:string,withdrawal:string,receipt:MediaAsset){return this.rpc<AdminWithdrawalPaymentResult>("record_admin_referral_withdrawal_payout",{p_request_id:requestId,p_admin:admin,p_withdrawal:withdrawal,p_receipt_public_id:receipt.public_id,p_receipt_resource_type:receipt.resource_type,p_receipt_delivery_type:receipt.delivery_type,p_receipt_mime_type:receipt.mime_type,p_receipt_size_bytes:receipt.size_bytes});}
  withdrawalByRequest(admin:string,requestId:string){return this.rpc<AdminWithdrawalPaymentResult|null>("read_admin_referral_withdrawal_payment_request",{p_admin:admin,p_request_id:requestId});}
}
