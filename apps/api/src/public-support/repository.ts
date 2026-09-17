import { createClient } from "@supabase/supabase-js";
import type { AuthConfig } from "../auth/config.js";

export type AgentReport = { reportType: "AGENT"; agentId: string; agentName: string | null; reason: string };
export interface PublicSupportRepository { submit(report: AgentReport): Promise<void> }

export class SupabasePublicSupportRepository implements PublicSupportRepository {
  private readonly db;
  constructor(config: AuthConfig) {
    this.db = createClient(config.supabaseUrl, config.serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(15000) }) },
    });
  }
  async submit(report: AgentReport): Promise<void> {
    const { error } = await this.db.from("public_support_reports").insert({
      report_type: report.reportType,
      agent_identifier: report.agentId,
      agent_name: report.agentName,
      reason: report.reason,
    });
    if (error) throw new Error("Support report unavailable");
  }
}
