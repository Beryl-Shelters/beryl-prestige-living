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
  detail(code: string) { return this.rpc<AdminPropertyDetail>("read_admin_property", { p_code: code }); }
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
}

