import { createClient } from "@supabase/supabase-js";
import type { AuthConfig } from "../auth/config.js";
import type { SellAssistanceInput } from "./model.js";

export type AssistanceAsset = { publicId: string; kind: "PROPERTY_IMAGE" | "AUTHORIZATION_DOCUMENT"; mimeType: string; sizeBytes: number; sortOrder: number };
export type AbandonedAssistance = { id: string; assets: AssistanceAsset[] };
export interface SellAssistanceRepository {
  reserve(id: string, input: SellAssistanceInput, assets: AssistanceAsset[]): Promise<void>;
  accept(id: string): Promise<void>;
  abandoned(): Promise<AbandonedAssistance[]>;
  forget(id: string): Promise<void>;
}

export class SupabaseSellAssistanceRepository implements SellAssistanceRepository {
  private readonly db;
  constructor(config: AuthConfig) {
    this.db = createClient(config.supabaseUrl, config.serviceKey, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(15000) }) } });
  }
  async reserve(id: string, input: SellAssistanceInput, assets: AssistanceAsset[]): Promise<void> {
    const { error } = await this.db.from("public_sell_assistance_requests").insert({
      id, contact_name: input.contactName, preferred_contact_method: input.preferredContactMethod,
      contact_phone: input.contactPhone ?? null, contact_email: input.contactEmail ?? null,
      seller_type: input.sellerType ?? null, property_location: input.location, property_type: input.propertyType,
      land_area: input.landArea ?? null, parking_spaces: input.parkingSpaces ?? null, facilities: input.facilities,
      units: input.units ?? null, title_document: input.titleDocument ?? null, lien_status: input.lienStatus ?? null,
      asking_price_minor: input.askingPrice, minimum_down_payment_percent: input.minimumDownPaymentPercent ?? null,
      sale_authorized: input.saleAuthorized ?? null, likely_transferable_giftings: input.likelyTransferableGiftings ?? null,
    });
    if (error) throw new Error("Sell assistance reservation unavailable");
    if (assets.length) {
      const { error: assetError } = await this.db.from("public_sell_assistance_assets").insert(assets.map(asset => ({
        request_id: id, asset_kind: asset.kind, public_id: asset.publicId, mime_type: asset.mimeType,
        size_bytes: asset.sizeBytes, sort_order: asset.sortOrder,
      })));
      if (assetError) throw new Error("Sell assistance assets unavailable");
    }
  }
  async accept(id: string): Promise<void> {
    const { data, error } = await this.db.from("public_sell_assistance_requests").update({ status: "ACCEPTED", accepted_at: new Date().toISOString() })
      .eq("id", id).eq("status", "PENDING").select("id").single();
    if (error || !data) throw new Error("Sell assistance acceptance unavailable");
  }
  async abandoned(): Promise<AbandonedAssistance[]> {
    const cutoff = new Date(Date.now() - 3600000).toISOString();
    const { data, error } = await this.db.from("public_sell_assistance_requests")
      .select("id,assets:public_sell_assistance_assets(public_id,asset_kind,mime_type,size_bytes,sort_order)")
      .eq("status", "PENDING").lt("created_at", cutoff).order("created_at").limit(12);
    if (error) throw new Error("Sell assistance cleanup unavailable");
    return (data ?? []).map(row => ({ id: row.id, assets: (row.assets ?? []).map(asset => ({ publicId: asset.public_id, kind: asset.asset_kind, mimeType: asset.mime_type, sizeBytes: asset.size_bytes, sortOrder: asset.sort_order })) }));
  }
  async forget(id: string): Promise<void> {
    const { error } = await this.db.from("public_sell_assistance_requests").delete().eq("id", id).eq("status", "PENDING");
    if (error) throw new Error("Sell assistance cleanup unavailable");
  }
}
