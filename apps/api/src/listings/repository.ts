import { createClient } from "@supabase/supabase-js";
import type { AuthConfig } from "../auth/config.js";
import { AuthError } from "../auth/errors.js";
import type { Listing, ListingContent, ListingDocument, ListingImage, ListingQuery, MediaAsset } from "./model.js";

export type Mutation = { action: "CREATE" | "EDIT" | "DELETE" | "REQUEST_APPROVAL" | "UNLIST" | "DOCUMENTS"; id: string | null; version: number | null; content?: ListingContent; images?: ListingImage[]; documents?: Omit<ListingDocument, "id" | "batch_id">[] };
export type CleanupAsset = Pick<MediaAsset, "public_id" | "resource_type" | "delivery_type">;
export interface ListingsRepository {
  list(owner: string, query: ListingQuery): Promise<{ items: Listing[]; total: number }>;
  get(owner: string, id: string): Promise<Listing | null>;
  mutate(owner: string, value: Mutation): Promise<string>;
  recent(owner: string): Promise<{ id: string; title: string }[]>;
  journal(owner: string, asset: CleanupAsset): Promise<void>;
  cleanupCandidates(owner: string): Promise<CleanupAsset[]>;
  referenced(owner: string, asset: CleanupAsset): Promise<boolean>;
  claimCleanup(owner: string, asset: CleanupAsset): Promise<boolean>;
  forgetCleanup(owner: string, asset: CleanupAsset): Promise<void>;
}
export const notFound = () => new AuthError(404, "LISTING_NOT_FOUND", "Listing not found.");
export const conflict = () => new AuthError(409, "LISTING_CHANGED", "This listing has changed. Refresh and try again.");
function check(error: { code?: string; message?: string } | null) {
  if (!error) return;
  if (error.code === "P0002") throw notFound();
  if (error.code === "40001") throw conflict();
  if (["23514", "23505", "23502", "22P02"].includes(error.code ?? "")) throw new AuthError(409, "LISTING_NOT_READY", "This listing cannot be updated. Check its details and current status.");
  throw new AuthError(503, "LISTINGS_UNAVAILABLE", "Listings are temporarily unavailable. Please try again.");
}
const selection = "*,images:customer_listing_images(*),documents:customer_listing_documents(*)";
function ordered(row: Listing): Listing { return { ...row, images: row.images.sort((a,b) => a.sort_order-b.sort_order), documents: row.documents.sort((a,b) => a.batch_id.localeCompare(b.batch_id) || a.sort_order-b.sort_order) }; }
export class SupabaseListingsRepository implements ListingsRepository {
  private readonly db;
  constructor(config: AuthConfig) {
    this.db = createClient(config.supabaseUrl, config.serviceKey, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(15000) }) } });
  }
  async list(owner: string, query: ListingQuery) {
    let request = this.db.from("customer_listings").select(selection, { count: "exact" }).eq("user_id", owner);
    if (query.status) request = request.eq("listing_status", query.status);
    // Quoted PostgREST values prevent filter grammar injection; wildcard input
    // is escaped, so search is literal rather than an arbitrary filter language.
    if (query.q) { const value = query.q.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/[%_*]/g, c => `\\${c}`); request = request.or(`title.ilike."%${value}%",listing_code.ilike."%${value}%"`); }
    const { data, count, error } = await request.order("created_at", { ascending: false }).order("id", { ascending: false }).range((query.page-1)*query.page_size, query.page*query.page_size-1);
    check(error); return { items: (data as unknown as Listing[]).map(ordered), total: count ?? 0 };
  }
  async get(owner: string, id: string) {
    const { data, error } = await this.db.from("customer_listings").select(selection).eq("user_id", owner).eq("id", id).maybeSingle();
    check(error); return data ? ordered(data as unknown as Listing) : null;
  }
  async mutate(owner: string, value: Mutation) {
    for (let attempt=0; attempt<3; attempt++) {
      const { data, error } = await this.db.rpc("mutate_customer_listing", { p_owner: owner, p_id: value.id, p_action: value.action, p_version: value.version, p_content: value.content ?? {}, p_images: value.images ?? [], p_documents: value.documents ?? [] });
      if (value.action === "CREATE" && error?.code === "23505" && error.message.includes("customer_listings_listing_code_key") && attempt<2) continue;
      check(error); return data as string;
    }
    throw conflict();
  }
  async recent(owner: string) {
    const { data, error } = await this.db.from("customer_listings").select("id,title").eq("user_id", owner).order("created_at", { ascending: false }).order("id", { ascending: false }).limit(5);
    check(error); return data ?? [];
  }
  async journal(owner: string, asset: CleanupAsset) { const { error } = await this.db.from("customer_listing_media_cleanup").insert({ ...asset, user_id: owner }); check(error); }
  async cleanupCandidates(owner: string) {
    const { data, error } = await this.db.from("customer_listing_media_cleanup").select("public_id,resource_type,delivery_type").eq("user_id", owner).lt("created_at", new Date(Date.now()-3600000).toISOString()).order("created_at").limit(24);
    check(error); return (data ?? []) as CleanupAsset[];
  }
  async referenced(_owner: string, asset: CleanupAsset) {
    // Internal cleanup safety checks all references, not browser-visible data.
    for (const table of ["customer_listing_images", "customer_listing_documents"]) {
      const { data, error } = await this.db.from(table).select("id").eq("public_id", asset.public_id).eq("resource_type", asset.resource_type).eq("delivery_type", asset.delivery_type).limit(1); check(error);
      if (data?.length) return true;
    }
    return false;
  }
  async claimCleanup(owner: string, asset: CleanupAsset) {
    const { data, error } = await this.db.rpc("claim_customer_listing_cleanup", { p_owner: owner, p_public_id: asset.public_id, p_resource_type: asset.resource_type, p_delivery_type: asset.delivery_type });
    check(error); return data === true;
  }
  async forgetCleanup(owner: string, asset: CleanupAsset) { const { error } = await this.db.from("customer_listing_media_cleanup").delete().eq("user_id", owner).eq("public_id", asset.public_id).eq("resource_type", asset.resource_type).eq("delivery_type", asset.delivery_type); check(error); }
}
