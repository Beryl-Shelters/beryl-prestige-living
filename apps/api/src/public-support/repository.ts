import { createClient } from "@supabase/supabase-js";
import type { AuthConfig } from "../auth/config.js";

export type AgentReport = { reportType: "AGENT"; agentId: string; agentName: string | null; reason: string };
export type PropertyReport = { reportType: "PROPERTY"; propertyCode: string; propertyName: string | null; reason: string };
export type SupportReport = AgentReport | PropertyReport;
export interface PublicSupportRepository { submit(report: SupportReport): Promise<void> }

export class SupabasePublicSupportRepository implements PublicSupportRepository {
  private readonly db;
  constructor(config: AuthConfig) {
    this.db = createClient(config.supabaseUrl, config.serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(15000) }) },
    });
  }
  async submit(report: SupportReport): Promise<void> {
    const { error } = await this.db.from("public_support_reports").insert({
      report_type: report.reportType,
      agent_identifier: report.reportType === "AGENT" ? report.agentId : null,
      agent_name: report.reportType === "AGENT" ? report.agentName : null,
      property_code: report.reportType === "PROPERTY" ? report.propertyCode : null,
      property_name: report.reportType === "PROPERTY" ? report.propertyName : null,
      reason: report.reason,
    });
    if (error) throw new Error("Support report unavailable");
  }
}
