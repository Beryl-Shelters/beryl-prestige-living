import { createClient } from "@supabase/supabase-js";
import type { AuthConfig } from "../auth/config.js";
import type { BuyAssistanceInput } from "./model.js";

export type BuyMandateAsset = { publicId: string; mimeType: "application/pdf"; sizeBytes: number };
export interface BuyAssistanceRepository {
  reserve(id: string, input: BuyAssistanceInput, mandate?: BuyMandateAsset): Promise<void>;
  accept(id: string): Promise<void>;
  abandoned(): Promise<{ id: string; mandate: BuyMandateAsset | null }[]>;
  forget(id: string): Promise<void>;
}
export class SupabaseBuyAssistanceRepository implements BuyAssistanceRepository {
  private readonly db;
  constructor(config: AuthConfig) { this.db = createClient(config.supabaseUrl, config.serviceKey, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(15000) }) } }); }
  async reserve(id: string, input: BuyAssistanceInput, mandate?: BuyMandateAsset): Promise<void> {
    const { error } = await this.db.from("public_buy_assistance_requests").insert({ id, contact_name: input.contactName, preferred_contact_method: input.preferredContactMethod,
      contact_phone: input.contactPhone ?? null, contact_email: input.contactEmail ?? null, property_type: input.propertyType, property_subtype: input.propertySubtype ?? null,
      bedrooms: input.bedrooms ?? null, bathrooms: input.bathrooms ?? null, locality: input.locality ?? null, state: input.state, city: input.city ?? null,
      facilities: input.facilities, budget_minor: input.budget, payment_intent: input.paymentIntent ?? null, timing: input.timing ?? null,
      likely_transferable_giftings: input.likelyTransferableGiftings ?? null });
    if (error) throw new Error("Buy assistance reservation unavailable");
    if (mandate) { const { error: assetError } = await this.db.from("public_buy_assistance_assets").insert({ request_id: id, public_id: mandate.publicId, mime_type: mandate.mimeType, size_bytes: mandate.sizeBytes }); if (assetError) throw new Error("Buy mandate reservation unavailable"); }
  }
  async accept(id: string): Promise<void> { const { data, error } = await this.db.from("public_buy_assistance_requests").update({ status: "ACCEPTED", accepted_at: new Date().toISOString() }).eq("id", id).eq("status", "PENDING").select("id").single(); if (error || !data) throw new Error("Buy assistance acceptance unavailable"); }
  async abandoned(): Promise<{ id: string; mandate: BuyMandateAsset | null }[]> {
    const cutoff = new Date(Date.now() - 3600000).toISOString(); const { data, error } = await this.db.from("public_buy_assistance_requests").select("id,mandate:public_buy_assistance_assets(public_id,mime_type,size_bytes)").eq("status", "PENDING").lt("created_at", cutoff).order("created_at").limit(24);
    if (error) throw new Error("Buy assistance cleanup unavailable");
    return (data ?? []).map(row => { const mandate = Array.isArray(row.mandate) ? row.mandate[0] : row.mandate; return { id: row.id, mandate: mandate ? { publicId: mandate.public_id, mimeType: "application/pdf", sizeBytes: mandate.size_bytes } : null }; });
  }
  async forget(id: string): Promise<void> { const { error } = await this.db.from("public_buy_assistance_requests").delete().eq("id", id).eq("status", "PENDING"); if (error) throw new Error("Buy assistance cleanup unavailable"); }
}
