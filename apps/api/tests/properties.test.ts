import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { test, type TestContext } from "node:test";
import { createApp } from "../src/app.js";
import { authConfigSchema } from "../src/auth/config.js";
import { AuthCipher, hashToken } from "../src/auth/crypto.js";
import { expired } from "../src/auth/errors.js";
import type { AuthGateway, Customer, StoredSession } from "../src/auth/gateway.js";
import type { PurchasedPropertiesRepository } from "../src/properties/repository.js";

const config = authConfigSchema.parse({ webOrigin: "http://localhost:3000", apiOrigin: "http://localhost:4000",
  supabaseUrl: "https://example.supabase.co", anonKey: "test-anon", serviceKey: "test-service",
  encryptionKey: randomBytes(32).toString("base64"), cookieSecure: false, production: false });
const owner = "11111111-1111-4111-8111-111111111111";

async function fixture(t: TestContext, repository?: PurchasedPropertiesRepository) {
  const raw = "opaque-properties-session";
  const profile: Customer = { id: owner, first_name: "Ada", last_name: "Okafor", email: "ada@example.test", country_code: null,
    phone_number: null, phone_number_normalized: null, account_type: "INVESTOR", profile_type: "PERSONAL", email_verified_at: new Date().toISOString() };
  const row: StoredSession = { token_hash: hashToken(raw), user_id: owner, purpose: "ACCOUNT", refresh_lock: null,
    expires_at: new Date(Date.now() + 3600000).toISOString(),
    encrypted_tokens: new AuthCipher(config.encryptionKey).seal({ userId: owner, accessToken: "private-access", refreshToken: "private-refresh", expiresAt: Date.now() / 1000 + 3600 }, "provider-tokens") };
  const state = { invalidProvider: false };
  const gateway = {
    async readSession(hash: string, purpose: string) { return hash === row.token_hash && purpose === row.purpose && Date.parse(row.expires_at) > Date.now() ? row : null; },
    async validate() { if (state.invalidProvider) throw expired(); },
    async findCustomer(column: string, id: string) { assert.equal(column, "id"); assert.equal(id, owner); return profile; },
  } as unknown as AuthGateway;
  const server = createApp({ webAppUrl: config.webOrigin, auth: config, gateway, ...(repository ? { purchasedPropertiesRepository: repository } : {}) }).listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  t.after(() => new Promise<void>(resolve => { server.close(() => resolve()); server.closeAllConnections(); }));
  const address = server.address(); assert(address && typeof address !== "string");
  async function request(suffix = "", cookie = `beryl_account=${raw}`, headers = {}) {
    const response = await fetch(`http://127.0.0.1:${address.port}/api/v1/dashboard/properties${suffix}`, { headers: { Cookie: cookie, ...headers } });
    return { response, payload: await response.json() };
  }
  return { request, row, profile, state, raw };
}

test("purchased properties rejects anonymous, forged, recovery-only and expired sessions", async t => {
  const { request, row, raw } = await fixture(t);
  for (const cookie of ["", "beryl_account=forged", `beryl_recovery=${raw}`]) assert.equal((await request("", cookie)).response.status, 401);
  row.expires_at = new Date(0).toISOString(); assert.equal((await request()).response.status, 401);
});
test("purchased properties rejects provider-invalid and unverified accounts", async t => {
  const { request, state, profile } = await fixture(t);
  state.invalidProvider = true; assert.equal((await request()).response.status, 401);
  state.invalidProvider = false; profile.email_verified_at = null; assert.equal((await request()).response.status, 401);
});
test("purchased properties returns the legitimate empty read model until an Admin purchase source exists", async t => {
  const { request } = await fixture(t); const { response, payload } = await request();
  assert.equal(response.status, 200); assert.equal(response.headers.get("cache-control"), "no-store"); assert.match(response.headers.get("vary") ?? "", /Cookie/);
  assert.deepEqual(payload.data, { items: [], page: 1, pageSize: 10, total: 0, totalPages: 0 });
});
test("purchased properties uses only the validated session owner and returns the future-ready contract", async t => {
  const calls: unknown[] = [];
  const repository: PurchasedPropertiesRepository = { async list(customerId, search, page, pageSize) {
    calls.push({ customerId, search, page, pageSize });
    return { total: 11, items: [{ id: "purchase-1", propertyTitle: "Ocean View", propertyCode: "RES-AB12C", state: "Lagos", type: "Residential", subtype: "Apartment", price: "₦50,000,000.00", status: "Completed", closedAt: "12 Sep 2026" }] };
  } };
  const { request } = await fixture(t, repository);
  const { response, payload } = await request("?q=%20Ocean%20&page=2", undefined, { "X-User-Id": "another-customer" });
  assert.equal(response.status, 200); assert.deepEqual(calls, [{ customerId: owner, search: "Ocean", page: 2, pageSize: 10 }]);
  assert.equal(payload.data.totalPages, 2); assert.deepEqual(Object.keys(payload.data.items[0]), ["id", "propertyTitle", "propertyCode", "state", "type", "subtype", "price", "status", "closedAt"]);
});
test("purchased properties rejects malformed, duplicate and owner-selector queries", async t => {
  const calls: unknown[] = []; const repository: PurchasedPropertiesRepository = { async list(...args) { calls.push(args); return { items: [], total: 0 }; } };
  const { request } = await fixture(t, repository);
  for (const suffix of ["?page=0", "?page=1.5", "?page=1&page=2", "?q=a&q=b", `?q=${"x".repeat(101)}`, "?user_id=other", "?customerId=other"]) assert.equal((await request(suffix)).response.status, 400, suffix);
  assert.deepEqual(calls, []);
});
test("purchased properties reports repository failures without leaking diagnostics", async t => {
  const repository: PurchasedPropertiesRepository = { async list() { throw new Error("private database diagnostics"); } };
  const { request } = await fixture(t, repository); const { response, payload } = await request();
  assert.equal(response.status, 503); assert.equal(payload.error.code, "PROPERTIES_UNAVAILABLE"); assert(!JSON.stringify(payload).includes("private database"));
});
