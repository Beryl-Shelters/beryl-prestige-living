import { createClient } from "@supabase/supabase-js";
import type { AuthConfig } from "../auth/config.js";
import type { CareerApplicationInput } from "./model.js";

export interface CareerApplicationsRepository {
  reserve(publicId: string): Promise<void>;
  accept(publicId: string, input: CareerApplicationInput, size: number): Promise<void>;
  abandoned(): Promise<string[]>;
  forget(publicId: string): Promise<void>;
}

export class SupabaseCareerApplicationsRepository implements CareerApplicationsRepository {
  private readonly db;
  constructor(config: AuthConfig) {
    this.db = createClient(config.supabaseUrl, config.serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(15000) }) },
    });
  }
  async reserve(publicId: string): Promise<void> {
    const { error } = await this.db.from("public_career_applications").insert({ resume_public_id: publicId });
    if (error) throw new Error("Career reservation unavailable");
  }
  async accept(publicId: string, input: CareerApplicationInput, size: number): Promise<void> {
    const { data, error } = await this.db.from("public_career_applications").update({
      status: "ACCEPTED", full_name: input.fullName, email: input.email, phone: input.phone,
      position: input.position, cover_letter: input.coverLetter || null,
      resume_mime_type: "application/pdf", resume_size_bytes: size, accepted_at: new Date().toISOString(),
    }).eq("resume_public_id", publicId).eq("status", "PENDING").select("id").single();
    if (error || !data) throw new Error("Career application unavailable");
  }
  async abandoned(): Promise<string[]> {
    const cutoff = new Date(Date.now() - 3600000).toISOString();
    const { data, error } = await this.db.from("public_career_applications").select("resume_public_id")
      .eq("status", "PENDING").lt("created_at", cutoff).order("created_at").limit(24);
    if (error) throw new Error("Career cleanup unavailable");
    return (data ?? []).map(row => row.resume_public_id);
  }
  async forget(publicId: string): Promise<void> {
    const { error } = await this.db.from("public_career_applications").delete().eq("resume_public_id", publicId).eq("status", "PENDING");
    if (error) throw new Error("Career cleanup unavailable");
  }
}
