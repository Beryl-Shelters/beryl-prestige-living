import { readFileSync } from "node:fs";
import path from "node:path";
import { describe,expect,it } from "vitest";
const sql=readFileSync(path.resolve(__dirname,"../../../supabase/migrations/202608180004_marketplace_reopen_rejected.sql"),"utf8");
describe("Marketplace rejected reopen migration",()=>{
  it("locks and owner-scopes the canonical property",()=>{expect(sql).toMatch(/p\.id = p_property_id and p\.owner_id = p_owner_id\s+for update/i)});
  it("permits only REJECTED to DRAFT and detects duplicate reopen",()=>{expect(sql).toContain("marketplace_status <> 'REJECTED'");expect(sql).toContain("'ALREADY_REOPENED'");expect(sql).toContain("marketplace_status = 'DRAFT'");expect(sql).toContain("marketplace_current_step = 'REVIEW'")});
  it("preserves rejection, review, submission, media, documents, mandate, and history state",()=>{const update=sql.slice(sql.indexOf("update public.properties"),sql.indexOf("returning p.* into v_property")+30);expect(update).not.toMatch(/rejection_reason\s*=|marketplace_rejected_at\s*=|marketplace_reviewed_at\s*=|marketplace_submitted_at\s*=/);expect(sql).not.toMatch(/delete from|property_images|property_documents|public\.mandates|marketplace_property_review_history/)});
  it("uses server time and service-role-only execution",()=>{expect(sql).toContain("p_now timestamptz default now()");expect(sql).toMatch(/revoke all on function .* from public, anon, authenticated/);expect(sql).toMatch(/grant execute on function .* to service_role/)});
});
