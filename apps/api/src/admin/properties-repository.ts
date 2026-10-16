import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { AuthConfig } from "../auth/config.js";
import { AuthError, unavailable } from "../auth/errors.js";
import type { MediaAsset } from "../listings/model.js";
import type { AdminPropertyDetail, AdminPropertyDirectoryPage, AdminPropertyQuery } from "./properties-model.js";

export interface AdminPropertiesRepository {
  directory(query: AdminPropertyQuery): Promise<AdminPropertyDirectoryPage>;
  detail(code: string): Promise<AdminPropertyDetail>;
  review(code: string, reviewerId: string, action: "APPROVE" | "REJECT", version: number, reason?: string): Promise<void>;
  document(code: string, documentId: string, mandate: boolean): Promise<MediaAsset | null>;
  signature(code: string): Promise<MediaAsset | null>;
  physicalDocument(code:string,documentId:string):Promise<MediaAsset|null>;
  reviewMandate(code:string,submissionId:string,reviewerId:string,action:"APPROVE"|"REJECT",reason?:string):Promise<void>;
}

function propertyError(error: { code?: string } | null): void {
  if (!error) return;
  if (error.code === "P0002") throw new AuthError(404, "PROPERTY_NOT_FOUND", "Property not found.");
  if (error.code === "40001") throw new AuthError(409, "PROPERTY_CHANGED", "This property changed. Refresh and try again.");
  if (error.code === "42501") throw new AuthError(403, "ADMIN_PROPERTY_FORBIDDEN", "Active Admin access is required.");
  if (["23514", "22P02"].includes(error.code ?? "")) throw new AuthError(409, "PROPERTY_REVIEW_INVALID", "This property cannot be reviewed in its current state.");
  throw unavailable();
}

type AssetRow = { public_id: string; resource_type: "raw"; delivery_type: "authenticated"; mime_type: string; size_bytes: number };
const asset = (row: AssetRow): MediaAsset => ({ ...row, url: "" });

export class SupabaseAdminPropertiesRepository implements AdminPropertiesRepository {
  private readonly db: SupabaseClient;
  constructor(config: AuthConfig, transport: typeof fetch = fetch) {
    this.db = createClient(config.supabaseUrl, config.serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: (input, init) => transport(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(15000) }) },
    });
  }
  private async rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
    const { data, error } = await this.db.rpc(name, args); propertyError(error); return data as T;
  }
  directory(query: AdminPropertyQuery) {
    return this.rpc<AdminPropertyDirectoryPage>("list_admin_properties", {
      p_query: query.search, p_status: query.status, p_sort: query.sort,
      p_page: query.page, p_page_size: query.pageSize,
    });
  }
  async detail(code: string) {
    const detail=await this.rpc<AdminPropertyDetail>("read_admin_property", { p_code: code });
    const {data,error}=await this.db.from("listing_mandate_versions").select("id,version,agreement_version,generated_at,submissions:listing_mandate_submissions(id,submission_number,status,uploaded_at,reviewed_at,rejection_reason,reviewer:admin_profiles!listing_mandate_submissions_reviewed_by_fkey(full_name),documents:listing_mandate_submission_documents(id,title,sort_order,mime_type,size_bytes))").eq("listing_id",detail.id).order("version",{ascending:false});
    propertyError(error);
    const versions=data??[],latest=versions[0];
    detail.physicalMandate=latest?{id:latest.id,version:latest.version,agreementVersion:latest.agreement_version,generatedAt:latest.generated_at,submissions:versions.flatMap(version=>(version.submissions??[]).map((submission)=>({id:submission.id,mandateVersion:version.version,agreementVersion:version.agreement_version,submissionNumber:submission.submission_number,status:submission.status,uploadedAt:submission.uploaded_at,reviewedAt:submission.reviewed_at,reviewerName:submission.reviewer?.[0]?.full_name??null,rejectionReason:submission.rejection_reason,documents:(submission.documents??[]).map(document=>({id:document.id,title:document.title,sortOrder:document.sort_order,mimeType:document.mime_type,sizeBytes:document.size_bytes}))})))}:null;
    return detail;
  }
  async review(code: string, reviewerId: string, action: "APPROVE" | "REJECT", version: number, reason?: string) {
    await this.rpc("review_admin_property", { p_code: code, p_reviewer: reviewerId, p_action: action, p_version: version, p_reason: reason ?? null });
  }
  private async listingId(code: string) {
    const { data, error } = await this.db.from("customer_listings").select("id").eq("listing_code", code).maybeSingle();
    propertyError(error); return data?.id as string | undefined;
  }
  async document(code: string, documentId: string, mandate: boolean) {
    const listingId = await this.listingId(code); if (!listingId) return null;
    if (!mandate) {
      const { data, error } = await this.db.from("customer_listing_documents")
        .select("public_id,resource_type,delivery_type,mime_type,size_bytes").eq("listing_id", listingId).eq("id", documentId).maybeSingle();
      propertyError(error); return data ? asset(data as AssetRow) : null;
    }
    const mandateResult = await this.db.from("sales_mandates").select("id").eq("listing_id", listingId).maybeSingle();
    propertyError(mandateResult.error); if (!mandateResult.data) return null;
    const { data, error } = await this.db.from("sales_mandate_documents")
      .select("public_id,resource_type,delivery_type,mime_type,size_bytes").eq("mandate_id", mandateResult.data.id).eq("id", documentId).maybeSingle();
    propertyError(error); return data ? asset(data as AssetRow) : null;
  }
  async signature(code: string) {
    const listingId = await this.listingId(code); if (!listingId) return null;
    const { data, error } = await this.db.from("sales_mandates")
      .select("signature_public_id,signature_mime_type,signature_size_bytes").eq("listing_id", listingId).maybeSingle();
    propertyError(error); if (!data) return null;
    return asset({ public_id: data.signature_public_id, resource_type: "raw", delivery_type: "authenticated", mime_type: data.signature_mime_type, size_bytes: data.signature_size_bytes });
  }
  async physicalDocument(code:string,documentId:string) {
    const listingId=await this.listingId(code);if(!listingId)return null;
    const {data,error}=await this.db.from("listing_mandate_submission_documents").select("public_id,resource_type,delivery_type,mime_type,size_bytes,submission:listing_mandate_submissions!inner(listing_id)").eq("id",documentId).eq("submission.listing_id",listingId).maybeSingle();propertyError(error);return data?asset(data as unknown as AssetRow):null;
  }
  async reviewMandate(code:string,submissionId:string,reviewerId:string,action:"APPROVE"|"REJECT",reason?:string) {
    const {error}=await this.db.rpc("review_listing_mandate",{p_code:code,p_submission_id:submissionId,p_reviewer:reviewerId,p_action:action,p_reason:reason??null});propertyError(error);
  }
}

