import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { randomBytes } from "node:crypto";
import { createApp } from "../src/app.js";
import { authConfigSchema } from "../src/auth/config.js";
import { AuthCipher, hashToken } from "../src/auth/crypto.js";
import { expired } from "../src/auth/errors.js";
import type { AuthGateway, Customer, StoredSession } from "../src/auth/gateway.js";
import { EmptyDashboardRepository, type DashboardRepository } from "../src/dashboard/repository.js";
import { DashboardService } from "../src/dashboard/service.js";
import { accountTypeLabel, customerInitials, customerName, greeting, messageCount, naira, units } from "../../web/lib/dashboard-format.js";

const config = authConfigSchema.parse({ webOrigin: "http://localhost:3000", apiOrigin: "http://localhost:4000",
  supabaseUrl: "https://example.supabase.co", anonKey: "test-anon", serviceKey: "test-service",
  encryptionKey: randomBytes(32).toString("base64"), cookieSecure: false, production: false });
const customer: Customer = { id: "own-customer", first_name: "Ada", last_name: "Okafor", email: "ada@example.test",
  country_code: "+234", phone_number: "08031234567", phone_number_normalized: "+2348031234567",
  account_type: "PROPERTY_DEVELOPER", profile_type: "PERSONAL", email_verified_at: new Date().toISOString() };
async function fixture(t: TestContext, repository: DashboardRepository = new EmptyDashboardRepository()) {
  const raw = "opaque-dashboard-account-session";
  const profile = { ...customer };
  const state = { invalidProvider: false };
  const row: StoredSession = { token_hash: hashToken(raw), user_id: profile.id, purpose: "ACCOUNT", refresh_lock: null,
    expires_at: new Date(Date.now() + 3600000).toISOString(),
    encrypted_tokens: new AuthCipher(config.encryptionKey).seal({ userId: profile.id, accessToken: "private-access", refreshToken: "private-refresh", expiresAt: Date.now() / 1000 + 3600 }, "provider-tokens") };
  // Fail loudly for any unexpected domain/provider operation.
  const methods = {
    async readSession(hash: string, purpose: string) { return hash === row.token_hash && purpose === row.purpose && Date.parse(row.expires_at) > Date.now() ? row : null; },
    async validate() { if (state.invalidProvider) throw expired(); },
    async findCustomer(column: string, id: string) { assert.equal(column, "id"); assert.equal(id, profile.id); return profile; },
  };
  const gateway = new Proxy(methods, { get(target, property) {
    if (property in target) return target[property as keyof typeof target];
    return async () => { throw new Error(`Unexpected gateway call: ${String(property)}`); };
  } }) as unknown as AuthGateway;
  const server = createApp({ webAppUrl: config.webOrigin, auth: config, gateway, dashboardRepository: repository }).listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  t.after(() => new Promise<void>((resolve) => { server.close(() => resolve()); server.closeAllConnections(); }));
  const address = server.address(); assert(address && typeof address !== "string");
  async function request(cookie = `beryl_account=${raw}`, suffix = "", extraHeaders = {}) {
    const response = await fetch(`http://127.0.0.1:${address.port}/api/v1/dashboard/overview${suffix}`, { headers: { Cookie: cookie, ...extraHeaders } });
    return { response, payload: await response.json() };
  }
  return { request, row, profile, state, raw };
}
test("dashboard rejects anonymous, forged, recovery-only and expired account sessions", async (t) => {
  const { request, row, raw } = await fixture(t);
  for (const cookie of ["", "beryl_account=forged", `beryl_recovery=${raw}`]) assert.equal((await request(cookie)).response.status, 401);
  row.expires_at = new Date(0).toISOString();
  assert.equal((await request()).response.status, 401);
});
test("dashboard rejects provider-invalid sessions and unverified profiles", async (t) => {
  const { request, profile, state } = await fixture(t);
  state.invalidProvider = true; assert.equal((await request()).response.status, 401);
  state.invalidProvider = false; profile.email_verified_at = null;
  assert.equal((await request()).response.status, 401);
});
test("dashboard returns own safe profile and explicit Phase 1 zero/empty read models", async (t) => {
  const { request } = await fixture(t);
  const { response, payload } = await request();
  assert.equal(response.status, 200); assert.equal(response.headers.get("cache-control"), "no-store");
  assert.match(response.headers.get("vary") ?? "", /Cookie/);
  assert.deepEqual(payload.data.customer, { id: customer.id, first_name: "Ada", last_name: "Okafor", account_type: "PROPERTY_DEVELOPER", profile_type: "PERSONAL" });
  assert.deepEqual(payload.data.summary, { total_investments: 0, properties_owned: 0, referral_earnings: 0, new_messages: 0 });
  assert.equal(payload.data.revenue.monthly.length, 12);
  assert.deepEqual(payload.data.revenue.monthly.map((point: { label: string }) => point.label), ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]);
  assert(payload.data.revenue.monthly.every((point: { amount: number }) => point.amount === 0));
  assert.deepEqual(payload.data.revenue.yearly, []); assert.deepEqual(payload.data.recent_messages, []); assert.deepEqual(payload.data.recent_property_listings, []);
  for (const secret of ["private-access", "private-refresh", "email_verified_at", "ada@example", "phone_number"]) assert(!JSON.stringify(payload).includes(secret));
});
test("dashboard cannot select another customer using query or headers", async (t) => {
  const { request } = await fixture(t);
  for (const query of ["?user_id=other", "?customerId=other", "?id=other", "?user_id[]=other"]) {
    assert.equal((await request(undefined, query)).response.status, 400);
  }
  const { payload } = await request(undefined, "", { "X-User-Id": "other" });
  assert.equal(payload.data.customer.id, customer.id);
});
test("overview service passes only the server customer to each adapter and aggregates real returned values", async () => {
  const ids: string[] = [];
  const repository: DashboardRepository = {
    async investments(id) { ids.push(id); return { total: 500, monthly: [{ label: "Jan", amount: 25 }], yearly: [] }; },
    async propertiesOwned(id) { ids.push(id); return 2; },
    async referralEarnings(id) { ids.push(id); return 40; },
    async messages(id) { ids.push(id); return { unread: 1, recent: [{ id: "message", subject: "Test subject" }] }; },
    async recentListings(id) { ids.push(id); return [{ id: "listing", title: "Test listing" }]; },
  };
  const result = await new DashboardService(repository).overview(customer);
  assert.deepEqual(ids, Array(5).fill(customer.id));
  assert.deepEqual(result.summary, { total_investments: 500, properties_owned: 2, referral_earnings: 40, new_messages: 1 });
  assert.equal(result.revenue.monthly[0]?.amount, 25); assert.equal(result.recent_messages.length, 1); assert.equal(result.recent_property_listings.length, 1);
});
test("dashboard reports adapter failures instead of disguising them as zeros", async (t) => {
  const repository = new EmptyDashboardRepository();
  repository.propertiesOwned = async () => { throw new Error("private database diagnostics"); };
  const { request } = await fixture(t, repository);
  const { response, payload } = await request();
  assert.equal(response.status, 503); assert.equal(payload.error.code, "DASHBOARD_UNAVAILABLE");
  assert(!JSON.stringify(payload).includes("private database"));
});
test("dashboard presentation helpers format real names, initials, local greeting bands and Naira/plurals", () => {
  assert.equal(customerName(customer), "Ada Okafor"); assert.equal(customerInitials(customer), "AO");
  assert.equal(accountTypeLabel(customer.account_type), "Property Developer");
  for (const [hour, expected] of [[0, "Good Morning"], [11, "Good Morning"], [12, "Good Afternoon"], [17, "Good Afternoon"], [18, "Good Evening"], [23, "Good Evening"]] as const) assert.equal(greeting(new Date(2026, 8, 8, hour)), expected);
  assert.equal(naira(0), "₦0.00"); assert.equal(naira(0, 0), "₦0"); assert.equal(naira(1200000), "₦1,200,000.00");
  assert.equal(units(0), "0 Units"); assert.equal(units(1), "1 Unit"); assert.equal(messageCount(1), "1 message"); assert.equal(messageCount(2), "2 messages");
});
