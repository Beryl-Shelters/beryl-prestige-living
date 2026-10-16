import { createClient } from "@supabase/supabase-js";
import type { AuthConfig } from "../auth/config.js";
import type { RecentListing } from "../dashboard/repository.js";
import { AuthError } from "../auth/errors.js";
import type { Listing, ListingContent, ListingCounts, ListingDocument, ListingImage, ListingQuery, ListingStatus, MandateContent, MandateDocumentInput, MediaAsset, PhysicalMandateVersion, SalesMandate } from "./model.js";

export type Mutation = { action: "CREATE" | "EDIT" | "DELETE" | "REQUEST_APPROVAL" | "UNLIST" | "DOCUMENTS"; id: string | null; version: number | null; content?: ListingContent; images?: ListingImage[]; documents?: Omit<ListingDocument, "id" | "batch_id">[] };
export type CleanupAsset = Pick<MediaAsset, "public_id" | "resource_type" | "delivery_type">;
export interface ListingsRepository {
  list(owner: string, query: ListingQuery): Promise<{ items: Listing[]; total: number; counts: ListingCounts }>;
  get(owner: string, id: string): Promise<Listing | null>;
  mutate(owner: string, value: Mutation): Promise<string>;
  recent(owner: string): Promise<RecentListing[]>;
  journal(owner: string, asset: CleanupAsset): Promise<void>;
  cleanupCandidates(owner: string): Promise<CleanupAsset[]>;
  referenced(owner: string, asset: CleanupAsset): Promise<boolean>;
  claimCleanup(owner: string, asset: CleanupAsset): Promise<boolean>;
  forgetCleanup(owner: string, asset: CleanupAsset): Promise<void>;
  mandate(owner: string, id: string): Promise<SalesMandate | null>;
  mutateMandate(owner: string, listingId: string, content: MandateContent, documents: MandateDocumentInput[]): Promise<string>;
  submit(owner: string, listingId: string): Promise<string>;
  unlist(owner: string, listingId: string, version: number): Promise<string>;
  physicalMandate(owner:string,listingId:string):Promise<PhysicalMandateVersion|null>;
  createPhysicalMandate(owner:string,listingId:string,input:{agreementVersion:string;agreementSnapshot:Record<string,unknown>;snapshotHash:string;pdfPublicId:string;pdfSizeBytes:number;generatedAt:string}):Promise<string>;
  recordMandateEmail(owner:string,versionId:string,sent:boolean):Promise<void>;
  validateMandateUploads(owner:string,listingId:string,documents:Array<{public_id:string}>):Promise<boolean>;
  createMandateSubmission(owner:string,listingId:string,versionId:string,documents:Array<{title:string;public_id:string;mime_type:string;size_bytes:number;sort_order:number}>):Promise<string>;
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
const selection = "*,images:customer_listing_images(*),documents:customer_listing_documents(*),mandate_versions:listing_mandate_versions(*,submissions:listing_mandate_submissions(*,documents:listing_mandate_submission_documents(*)))";
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
    const search = query.q ? query.q.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/[%_*]/g, c => `\\${c}`) : "";
    const searchFilter = search ? `title.ilike."%${search}%",listing_code.ilike."%${search}%",location.ilike."%${search}%",state.ilike."%${search}%",city.ilike."%${search}%"` : "";
    if (searchFilter) request = request.or(searchFilter);
    const { data, count, error } = await request.order("created_at", { ascending: false }).order("id", { ascending: false }).range((query.page-1)*query.page_size, query.page*query.page_size-1);
    check(error);
    const countStatus = async (status?: ListingStatus) => {
      let countRequest = this.db.from("customer_listings").select("id", { count: "exact", head: true }).eq("user_id", owner);
      if (searchFilter) countRequest = countRequest.or(searchFilter);
      if (status) countRequest = countRequest.eq("listing_status", status);
      const result = await countRequest;
      check(result.error);
      return result.count ?? 0;
    };
    const [all, UNLISTED, PENDING, LISTED, REJECTED] = await Promise.all([
      countStatus(), countStatus("UNLISTED"), countStatus("PENDING"), countStatus("LISTED"), countStatus("REJECTED"),
    ]);
    return { items: (data as unknown as Listing[]).map(ordered), total: count ?? 0, counts: { all, UNLISTED, PENDING, LISTED, REJECTED } };
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
    const { data, error } = await this.db.from("customer_listings").select("id,title,listing_status,property_cost_minor,updated_at,images:customer_listing_images(url,sort_order)").eq("user_id", owner).order("created_at", { ascending: false }).order("id", { ascending: false }).limit(4);
    check(error);
    return (data ?? []).map(row => ({ id: row.id, title: row.title, status: row.listing_status, priceMinor: row.property_cost_minor,
      imageUrl: [...row.images].sort((a,b)=>a.sort_order-b.sort_order)[0]?.url ?? null, updatedAt: row.updated_at })) as RecentListing[];
  }
  async journal(owner: string, asset: CleanupAsset) { const { error } = await this.db.from("customer_listing_media_cleanup").insert({ ...asset, user_id: owner }); check(error); }
  async cleanupCandidates(owner: string) {
    const { data, error } = await this.db.from("customer_listing_media_cleanup").select("public_id,resource_type,delivery_type").eq("user_id", owner).lt("created_at", new Date(Date.now()-3600000).toISOString()).order("created_at").limit(24);
    check(error); return (data ?? []) as CleanupAsset[];
  }
  async referenced(_owner: string, asset: CleanupAsset) {
    // Internal cleanup safety checks all references, not browser-visible data.
    for (const table of ["customer_listing_images", "customer_listing_documents", "sales_mandate_documents", "listing_mandate_submission_documents"]) {
      const { data, error } = await this.db.from(table).select("id").eq("public_id", asset.public_id).eq("resource_type", asset.resource_type).eq("delivery_type", asset.delivery_type).limit(1); check(error);
      if (data?.length) return true;
    }
    if (asset.resource_type === "raw" && asset.delivery_type === "authenticated") {
      const { data, error } = await this.db.from("sales_mandates").select("id").eq("signature_public_id", asset.public_id).limit(1); check(error);
      if (data?.length) return true;
      const version = await this.db.from("listing_mandate_versions").select("id").eq("pdf_public_id", asset.public_id).limit(1); check(version.error);
      if (version.data?.length) return true;
    }
    return false;
  }
  async claimCleanup(owner: string, asset: CleanupAsset) {
    const { data, error } = await this.db.rpc("claim_customer_listing_cleanup", { p_owner: owner, p_public_id: asset.public_id, p_resource_type: asset.resource_type, p_delivery_type: asset.delivery_type });
    check(error); return data === true;
  }
  async forgetCleanup(owner: string, asset: CleanupAsset) { const { error } = await this.db.from("customer_listing_media_cleanup").delete().eq("user_id", owner).eq("public_id", asset.public_id).eq("resource_type", asset.resource_type).eq("delivery_type", asset.delivery_type); check(error); }

  async mandate(owner: string, id: string) {
    const { data, error } = await this.db.from("sales_mandates").select("*,documents:sales_mandate_documents(*)").eq("user_id", owner).eq("listing_id", id).maybeSingle();
    check(error); return data;
  }
  async mutateMandate(owner: string, listingId: string, content: MandateContent, documents: MandateDocumentInput[]) {
    const { data, error } = await this.db.rpc("mutate_sales_mandate", { p_owner: owner, p_listing_id: listingId, p_content: content, p_documents: documents });
    check(error); return data as string;
  }
  async submit(owner: string, listingId: string) {
    const { error } = await this.db.rpc("submit_customer_listing", { p_owner: owner, p_id: listingId });
    check(error); return listingId;
  }
  async unlist(owner: string, listingId: string, version: number) {
    const { data, error } = await this.db.rpc("unlist_customer_listing", { p_owner: owner, p_id: listingId, p_version: version });
    check(error); return data as string;
  }
  async physicalMandate(owner:string,listingId:string) {
    const {data,error}=await this.db.from("listing_mandate_versions")
      .select("*,submissions:listing_mandate_submissions(*,documents:listing_mandate_submission_documents(*))")
      .eq("user_id",owner).eq("listing_id",listingId).order("version",{ascending:false}).limit(1).maybeSingle();
    check(error); return data as PhysicalMandateVersion|null;
  }
  async createPhysicalMandate(owner:string,listingId:string,input:{agreementVersion:string;agreementSnapshot:Record<string,unknown>;snapshotHash:string;pdfPublicId:string;pdfSizeBytes:number;generatedAt:string}) {
    const {data,error}=await this.db.rpc("create_listing_mandate_version",{p_owner:owner,p_listing_id:listingId,p_agreement_version:input.agreementVersion,p_agreement_snapshot:input.agreementSnapshot,p_snapshot_hash:input.snapshotHash,p_pdf_public_id:input.pdfPublicId,p_pdf_size_bytes:input.pdfSizeBytes,p_generated_at:input.generatedAt});
    check(error); return data as string;
  }
  async recordMandateEmail(owner:string,versionId:string,sent:boolean) {
    const {error}=await this.db.rpc("record_listing_mandate_email",{p_owner:owner,p_version_id:versionId,p_sent:sent}); check(error);
  }
  async validateMandateUploads(owner:string,listingId:string,documents:Array<{public_id:string}>) {
    const publicIds=documents.map(document=>document.public_id),prefix=`beryl-v2/mandates/signed/${listingId}/`;
    if(new Set(publicIds).size!==publicIds.length||publicIds.some(publicId=>!publicId.startsWith(prefix)))return false;
    const {data,error}=await this.db.from("customer_listing_media_cleanup").select("public_id").eq("user_id",owner).eq("resource_type","raw").eq("delivery_type","authenticated").eq("claimed",false).in("public_id",publicIds);
    check(error);return new Set((data??[]).map(value=>value.public_id)).size===publicIds.length;
  }
  async createMandateSubmission(owner:string,listingId:string,versionId:string,documents:Array<{title:string;public_id:string;mime_type:string;size_bytes:number;sort_order:number}>) {
    const {data,error}=await this.db.rpc("create_listing_mandate_submission",{p_owner:owner,p_listing_id:listingId,p_version_id:versionId,p_documents:documents});check(error);return data as string;
  }
}
