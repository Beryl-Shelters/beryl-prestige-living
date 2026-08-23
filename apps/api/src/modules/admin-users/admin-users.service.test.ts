import { beforeEach, describe, expect, it, vi } from "vitest";

type Result = { data: any; error: any };
const db = vi.hoisted(() => ({ rpc: { data: null, error: null } as Result, tables: new Map<string, Result[]>(), rpcCalls: [] as any[] }));
const builder = (table: string) => {
  const chain: any = {};
  for (const method of ["select", "eq"]) chain[method] = vi.fn(() => chain);
  chain.maybeSingle = vi.fn(async () => db.tables.get(table)?.shift() ?? { data: null, error: null });
  chain.then = (resolve: (value: Result) => unknown) => resolve(db.tables.get(table)?.shift() ?? { data: [], error: null });
  return chain;
};
vi.mock("../../config/supabase", () => ({ supabaseAdmin: {
  rpc: vi.fn(async (name: string, args: any) => { db.rpcCalls.push({ name, args }); return db.rpc; }),
  from: vi.fn((table: string) => builder(table))
} }));

import { getUserDetail, listUsers } from "./admin-users.service";

describe("Admin Users service", () => {
  beforeEach(() => { db.rpc = { data: null, error: null }; db.tables.clear(); db.rpcCalls.length = 0; });

  it("returns authoritative RPC counts, items, and pagination", async () => {
    db.rpc.data = { counts: { totalUsers: 8, buyerProfiles: 6, sellerProfiles: 3, referrerProfiles: 4 }, items: [], pagination: { page: 2, limit: 6, total: 8, totalPages: 2 } };
    await expect(listUsers({ q: "Ada", role: "BUYER", verification: "VERIFIED", sort: "NAME_ASC", page: 2, limit: 6 })).resolves.toEqual(db.rpc.data);
    expect(db.rpcCalls[0]).toEqual({ name: "list_admin_customer_users", args: { p_query: "Ada", p_role: "BUYER", p_verification: "VERIFIED", p_sort: "NAME_ASC", p_page: 2, p_limit: 6 } });
  });

  it("maps list infrastructure failures safely", async () => {
    db.rpc = { data: null, error: { message: "private postgres detail" } };
    await expect(listUsers({ sort: "MOST_RECENT", page: 1, limit: 6 })).rejects.toMatchObject({ statusCode: 503, code: "USERS_UNAVAILABLE" });
  });

  it("maps verified multi-persona company customer detail", async () => {
    db.tables.set("profiles", [{ data: { id: "user-1", full_name: "Ngozi Umeh", first_name: "Ngozi", last_name: "Umeh", email: "ngozi@example.com", phone_number: "+2348012345678", referral_code: "EMK7Q2", email_verified_at: "2026-08-01T00:00:00Z", created_at: "2026-07-28T00:00:00Z" }, error: null }]);
    db.tables.set("customer_records", [{ data: { user_id: "user-1" }, error: null }]);
    db.tables.set("user_personas", [{ data: [
      { id: "buyer-1", persona_type: "BUYER", onboarding_status: "COMPLETED", onboarding_completed_at: "2026-08-02T00:00:00Z" },
      { id: "seller-1", persona_type: "SELLER_DEVELOPER", onboarding_status: "COMPLETED", onboarding_completed_at: "2026-08-03T00:00:00Z" }
    ], error: null }]);
    db.tables.set("buyer_profiles", [{ data: { preferred_locations: ["Lekki, Lagos"], budget_min: 30000000, budget_max: 60000000, currency: "NGN" }, error: null }]);
    db.tables.set("seller_profiles", [{ data: { profile_type: "BUSINESS", company_name: "Adigun Developments Ltd.", company_address: "7 Adeola Odeku Street" }, error: null }]);
    await expect(getUserDetail("user-1")).resolves.toMatchObject({
      customer: { verified: true, roles: ["BUYER", "SELLER", "REFERRER"], referralCode: "EMK7Q2" },
      buyerProfile: { activated: true, preferredAreas: ["Lekki, Lagos"], budgetMin: 30000000 },
      sellerProfile: { activated: true, sellerType: "BUSINESS", companyName: "Adigun Developments Ltd." },
      referrerProfile: { activated: true, referralCode: "EMK7Q2", activatedAt: null }
    });
  });

  it("returns safe inactive and missing optional states", async () => {
    db.tables.set("profiles", [{ data: { id: "user-2", full_name: "Ada Obi", email: "ada@example.com", phone_number: null, referral_code: null, email_verified_at: null, created_at: "2026-07-28T00:00:00Z" }, error: null }]);
    db.tables.set("customer_records", [{ data: { user_id: "user-2" }, error: null }]);
    db.tables.set("user_personas", [{ data: [{ id: "buyer-2", persona_type: "BUYER", onboarding_status: "NOT_STARTED", onboarding_completed_at: null }], error: null }]);
    await expect(getUserDetail("user-2")).resolves.toMatchObject({ customer: { verified: false, roles: [] }, buyerProfile: { activated: false, preferredAreas: [] }, sellerProfile: { activated: false, sellerType: null }, referrerProfile: { activated: false, referralCode: null } });
  });

  it("distinguishes missing customers from infrastructure errors", async () => {
    db.tables.set("profiles", [{ data: null, error: null }, { data: null, error: { message: "private" } }]);
    await expect(getUserDetail("missing")).rejects.toMatchObject({ statusCode: 404, code: "ADMIN_USER_NOT_FOUND" });
    await expect(getUserDetail("broken")).rejects.toMatchObject({ statusCode: 503, code: "USERS_UNAVAILABLE" });
  });
});
