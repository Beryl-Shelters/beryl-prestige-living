import { PGlite } from "@electric-sql/pglite";
import { randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { TestContext } from "node:test";
import { createApp } from "../src/app.js";
import { authConfigSchema } from "../src/auth/config.js";
import { AuthCipher, hashToken } from "../src/auth/crypto.js";
import { AuthError } from "../src/auth/errors.js";
import type { AuthGateway, Customer, StoredSession } from "../src/auth/gateway.js";
import type { SavedPropertyPage, SavedPropertiesQuery } from "../src/saved-properties/model.js";
import type { SavedPropertiesRepository } from "../src/saved-properties/repository.js";

export async function savedPropertiesFixture(t: TestContext) {
  const db = new PGlite(); t.after(() => db.close());
  await db.exec("create schema auth; create table auth.users(id uuid primary key); create role anon; create role authenticated; create role service_role;");
  for (const migration of ["202609080001_customer_listings.sql", "202609100001_short_display_codes.sql", "202609130001_customer_referrals.sql", "202609250002_customer_saved_properties.sql"])
    await db.exec(await readFile(new URL(`../supabase/migrations/${migration}`, import.meta.url), "utf8"));
  const owner = randomUUID(), other = randomUUID();
  await db.query("insert into auth.users values($1),($2)", [owner, other]);
  const listing = randomUUID(), foreignListing = randomUUID(), hiddenListing = randomUUID();
  const insert = `insert into public.customer_listings(id,user_id,listing_code,title,description,occupancy_type,ownership_type,property_type,property_subtype,has_lien,bedrooms,bathrooms,parking_spaces,facilities,property_cost_minor,minimum_down_payment_minor,location,state,city,listing_status,listed_at)
    values($1,$2,$3,$4,'Safe public description','Residential','Personal','Residential','Bungalow',false,$5,2,1,array['Wi-Fi'],8500000000,100000000,'Test road',$6,$7,$8,case when $8='LISTED' then clock_timestamp() else null end)`;
  await db.query(insert, [listing, owner, "RES-OWN111", "Owner home", 3, "Lagos", "Ikeja", "LISTED"]);
  await db.query(insert, [foreignListing, other, "RES-OTH222", "Foreign listed home", 4, "Rivers", "Port Harcourt", "LISTED"]);
  await db.query(insert, [hiddenListing, other, "RES-HID333", "Private pending home", 5, "Abuja", "Abuja", "PENDING"]);
  await db.query("insert into public.customer_listing_images(listing_id,public_id,resource_type,delivery_type,url,mime_type,size_bytes,sort_order) values($1,'saved-test-image','image','upload','https://images.example.test/saved-home.png','image/png',100,0)", [foreignListing]);
  async function rpc<T>(name: string, args: unknown[]): Promise<T> {
    try { return (await db.query<{ value: T }>(`select public.${name}(${args.map((_, index) => `$${index + 1}`).join(",")}) as value`, args)).rows[0]!.value; }
    catch (error) { const code = (error as { code?: string }).code;
      if (code === "P0002") throw new AuthError(404, "PROPERTY_NOT_AVAILABLE", "This property is not available to save.");
      if (["23514", "23502", "22P02"].includes(code ?? "")) throw new AuthError(400, "INVALID_SAVED_PROPERTY", "Check the property details.");
      throw error;
    }
  }
  const repository: SavedPropertiesRepository = {
    list: (id: string, query: SavedPropertiesQuery) => rpc<SavedPropertyPage>("list_customer_saved_properties", [id, query.q, query.page, query.pageSize]),
    save: (id, code) => rpc<boolean>("save_customer_property", [id, code]),
    remove: (id, code) => rpc<boolean>("remove_customer_saved_property", [id, code]),
    states: (id, codes) => rpc<string[]>("customer_saved_property_states", [id, codes]),
  };
  const config = authConfigSchema.parse({ webOrigin: "http://localhost:3000", apiOrigin: "http://localhost:4000", supabaseUrl: "https://example.supabase.co", anonKey: "test", serviceKey: "test", encryptionKey: randomBytes(32).toString("base64"), cookieSecure: false, production: false });
  const profile: Customer = { id: owner, first_name: "Ada", last_name: "Okafor", email: "ada@example.test", phone_number: null, phone_number_normalized: null, country_code: null, account_type: "INVESTOR", profile_type: "PERSONAL", email_verified_at: new Date().toISOString() };
  const raw = "saved-properties-test-session", row: StoredSession = { token_hash: hashToken(raw), user_id: owner, purpose: "ACCOUNT", refresh_lock: null, expires_at: new Date(Date.now() + 3600000).toISOString(), encrypted_tokens: new AuthCipher(config.encryptionKey).seal({ userId: owner, accessToken: "test", refreshToken: "test", expiresAt: Date.now() / 1000 + 3600 }, "provider-tokens") };
  const state = { activeUser: owner };
  const gateway = { readSession: async (hash: string, purpose: string) => hash === row.token_hash && purpose === row.purpose ? { ...row, user_id: state.activeUser } : null, validate: async () => {}, findCustomer: async () => ({ ...profile, id: state.activeUser }) } as unknown as AuthGateway;
  const server = createApp({ webAppUrl: config.webOrigin, auth: config, gateway, savedPropertiesRepository: repository }).listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  t.after(() => new Promise<void>(resolve => { server.close(() => resolve()); server.closeAllConnections(); }));
  const address = server.address(); if (!address || typeof address === "string") throw new Error("Missing server");
  async function request(path = "", method = "GET", body?: object, cookie = `beryl_account=${raw}`, headers: Record<string, string> = {}) {
    const response = await fetch(`http://127.0.0.1:${address.port}/api/v1/saved-properties${path}`, { method, headers: { Cookie: cookie, Origin: config.webOrigin, ...(method !== "GET" ? { "Content-Type": "application/json" } : {}), ...headers }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { response, payload: await response.json() };
  }
  return { db, owner, other, listing, foreignListing, hiddenListing, repository, request, state };
}
