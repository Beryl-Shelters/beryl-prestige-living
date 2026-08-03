import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/202608030001_customer_onboarding_personas.sql"
  ),
  "utf8"
);

describe("customer onboarding/persona transaction migration", () => {
  it("creates all four atomic mutation RPCs", () => {
    for (const rpc of [
      "complete_customer_buyer_onboarding",
      "complete_customer_seller_onboarding",
      "activate_customer_persona",
      "switch_customer_active_persona"
    ]) {
      expect(migration).toContain(`function public.${rpc}`);
    }
  });

  it("upserts profiles and persona membership idempotently", () => {
    expect(migration).toContain("on conflict (user_persona_id) do update");
    expect(migration).toContain(
      "on conflict (user_id, persona_type) do nothing"
    );
    expect(migration).toContain("on conflict (user_id) do update");
  });

  it("updates persona completion, active persona, and customer projection atomically", () => {
    expect(migration).toContain("update public.user_personas");
    expect(migration).toContain("onboarding_completed_at");
    expect(migration).toContain("update public.profiles");
    expect(migration).toContain("last_active_persona");
    expect(migration).toContain("insert into public.customer_records");
    expect(migration.trim().startsWith("begin;")).toBe(true);
    expect(migration.trim().endsWith("commit;")).toBe(true);
  });

  it("allows only the service role to execute mutation RPCs", () => {
    expect(migration.match(/from public, anon, authenticated/g)).toHaveLength(4);
    expect(migration.match(/to service_role/g)).toHaveLength(4);
    expect(migration).not.toMatch(/grant execute[\s\S]*to authenticated;/i);
  });
});
