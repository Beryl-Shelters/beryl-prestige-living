import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { AuthConfig } from "../auth/config.js";
import { AuthError, unavailable } from "../auth/errors.js";
import type { AdminLeadDetail, AdminLeadDirectoryPage, AdminLeadQuery } from "./leads-model.js";

export interface AdminLeadsRepository {
  directory(query: AdminLeadQuery): Promise<AdminLeadDirectoryPage>;
  detail(publicId: string): Promise<AdminLeadDetail>;
  move(publicId: string, adminId: string, stage: "CONTACTED" | "WON" | "LOST", version: number): Promise<void>;
}

function leadError(error: { code?: string } | null): void {
  if (!error) return;
  if (error.code === "P0002") throw new AuthError(404, "LEAD_NOT_FOUND", "Lead not found.");
  if (error.code === "40001") throw new AuthError(409, "LEAD_CHANGED", "This lead changed. Refresh and try again.");
  if (error.code === "42501") throw new AuthError(403, "ADMIN_LEAD_FORBIDDEN", "Active Admin access is required.");
  if (["23514", "22P02"].includes(error.code ?? "")) throw new AuthError(409, "LEAD_TRANSITION_INVALID", "This lead cannot be moved to that stage.");
  throw unavailable();
}

export class SupabaseAdminLeadsRepository implements AdminLeadsRepository {
  private readonly db: SupabaseClient;
  constructor(config: AuthConfig, transport: typeof fetch = fetch) {
    this.db = createClient(config.supabaseUrl, config.serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: (input, init) => transport(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(15000) }) },
    });
  }
  private async rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
    const { data, error } = await this.db.rpc(name, args);
    leadError(error);
    return data as T;
  }
  directory(query: AdminLeadQuery) {
    return this.rpc<AdminLeadDirectoryPage>("list_admin_leads", {
      p_query: query.search, p_page: query.page, p_page_size: query.pageSize,
    });
  }
  detail(publicId: string) {
    return this.rpc<AdminLeadDetail>("read_admin_lead", { p_public_id: publicId });
  }
  async move(publicId: string, adminId: string, stage: "CONTACTED" | "WON" | "LOST", version: number) {
    await this.rpc("move_admin_lead", { p_public_id: publicId, p_admin: adminId, p_to_stage: stage, p_version: version });
  }
}
