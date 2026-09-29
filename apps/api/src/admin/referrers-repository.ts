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
} from "./referrers-model.js";

export interface AdminReferrersRepository {
  directory(query: AdminReferrerQuery): Promise<AdminReferrerDirectoryPage>;
  detail(
    id: string,
    page: number,
    pageSize: number,
  ): Promise<AdminReferrerDetail>;
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
