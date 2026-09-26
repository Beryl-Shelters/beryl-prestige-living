import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { createApp } from "../src/app.js";
import { authConfigSchema } from "../src/auth/config.js";
import type { MediaStorage } from "../src/listings/media.js";
import type { BuyAssistanceInput } from "../src/public-buy-assistance/model.js";
import type { BuyAssistanceRepository, BuyMandateAsset } from "../src/public-buy-assistance/repository.js";

const config = authConfigSchema.parse({ webOrigin: "http://localhost:3000", apiOrigin: "http://localhost:4000", supabaseUrl: "https://example.supabase.co", anonKey: "test", serviceKey: "test", encryptionKey: randomBytes(32).toString("base64"), cookieSecure: false, production: false });
const pdf = Buffer.from("%PDF-1.4\n%%EOF");
const valid = { contactName: "Ada Buyer", preferredContactMethod: "Email", contactEmail: " ADA@EXAMPLE.COM ", propertyType: "Residential", propertySubtype: "Bungalow", bedrooms: "3", bathrooms: "2", locality: "Lekki", state: "Lagos", city: "Lagos", facilities: ["CCTV", "Garden"], budget: "85000000", paymentIntent: "Mortgage", timing: "Within 3 Months", likelyTransferableGiftings: "Flexible completion date" };

test("public Buy Assistance validates a private multipart request without transaction side effects", async t => {
  const reservations: { id: string; input: BuyAssistanceInput; mandate?: BuyMandateAsset; accepted: boolean }[] = [];
  const uploads: string[] = []; let fail = false;
  const repository: BuyAssistanceRepository = {
    async reserve(id, input, mandate) { reservations.push({ id, input, ...(mandate ? { mandate } : {}), accepted: false }); },
    async accept(id) { if (fail) throw new Error("private database detail"); reservations.find(row => row.id === id)!.accepted = true; },
    async abandoned() { return []; }, async forget() {},
  };
  const storage: MediaStorage = {
    async upload(file, asset) { uploads.push(`${asset.resource_type}:${asset.delivery_type}:${file.mime}:${asset.public_id}`); return { ...asset, url: "", mime_type: file.mime, size_bytes: file.bytes.length }; },
    async remove() {}, async download() { throw new Error("not supported"); },
  };
  const server = createApp({ webAppUrl: config.webOrigin, auth: config, buyAssistanceRepository: repository, mediaStorage: storage }).listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve)); t.after(() => new Promise<void>(resolve => { server.close(() => resolve()); server.closeAllConnections(); }));
  const address = server.address(); assert(address && typeof address !== "string"); const base = `http://127.0.0.1:${address.port}/api/v1/public/buy-assistance`;
  const send = (body: Record<string, unknown> = valid, mandate: Buffer | null = pdf, mime = "application/pdf", origin = config.webOrigin) => { const form = new FormData(); form.set("data", JSON.stringify(body)); if (mandate) form.set("buyMandate", new Blob([new Uint8Array(mandate)], { type: mime }), "mandate.pdf"); return fetch(base, { method: "POST", headers: { Origin: origin }, body: form }); };
  const response = await send(); assert.equal(response.status, 201, await response.clone().text()); assert.deepEqual(await response.json(), { success: true, data: { recorded: true } });
  assert.equal(reservations[0]?.accepted, true); assert.equal(reservations[0]?.input.contactEmail, "ada@example.com"); assert.equal(reservations[0]?.input.budget, 8500000000); assert.match(uploads[0] ?? "", /^raw:authenticated:application\/pdf:beryl-v2\/buy-assistance\//);
  const optional = await send({ ...valid, paymentIntent: undefined, timing: undefined }, null); assert.equal(optional.status, 201);
  for (const body of [
    { ...valid, contactName: "A" }, { ...valid, preferredContactMethod: "WhatsApp" }, { ...valid, contactEmail: "bad" }, { ...valid, propertyType: "Industrial" },
    { ...valid, propertySubtype: "Villa" }, { ...valid, state: "Atlantis" }, { ...valid, facilities: ["Helipad"] }, { ...valid, budget: "0" },
    { ...valid, paymentIntent: "Installments" }, { ...valid, timing: "Someday" }, { ...valid, ownerId: "spoof" },
    { ...valid, propertyType: "Commercial", propertySubtype: "Bungalow" }, { ...valid, propertyType: "Commercial", propertySubtype: undefined, bedrooms: "3" },
  ]) assert.equal((await send(body, null)).status, 400);
  assert.equal((await send(valid, Buffer.from("fake"))).status, 400); assert.equal((await send(valid, pdf, "image/png")).status, 400);
  assert.equal((await send(valid, null, "application/pdf", "https://evil.example")).status, 403); assert.equal((await fetch(base)).status, 404);
  assert.equal((await fetch(base, { method: "POST", headers: { Origin: config.webOrigin, "Content-Type": "application/json" }, body: "{}" })).status, 415);
  fail = true; const unavailable = await send(valid, null); assert.equal(unavailable.status, 503); assert.equal(JSON.stringify(await unavailable.json()).includes("private database detail"), false); fail = false;
  let limited = false; for (let index = 0; index < 25; index++) if ((await send(valid, null)).status === 429) { limited = true; break; } assert.equal(limited, true);
  assert.equal(reservations.some(row => ["purchase", "payment", "mortgageApplication", "referral", "listing", "savedProperty"].some(key => key in row.input)), false);
});

test("Buy Assistance migration keeps requests and mandates private with strict constraints", async t => {
  const db = new PGlite(); t.after(() => db.close()); await db.exec("create role anon; create role authenticated; create role service_role bypassrls;");
  await db.exec(await readFile(new URL("../supabase/migrations/202609260003_public_buy_assistance_requests.sql", import.meta.url), "utf8"));
  const grants = await db.query<{ request_rls: boolean; asset_rls: boolean; anon_read: boolean; auth_insert: boolean; service_request: boolean; service_asset: boolean }>("select (select relrowsecurity from pg_class where oid='public.public_buy_assistance_requests'::regclass) request_rls,(select relrowsecurity from pg_class where oid='public.public_buy_assistance_assets'::regclass) asset_rls,has_table_privilege('anon','public.public_buy_assistance_requests','SELECT') anon_read,has_table_privilege('authenticated','public.public_buy_assistance_requests','INSERT') auth_insert,has_table_privilege('service_role','public.public_buy_assistance_requests','INSERT,SELECT,UPDATE,DELETE') service_request,has_table_privilege('service_role','public.public_buy_assistance_assets','INSERT,SELECT,UPDATE,DELETE') service_asset");
  assert.deepEqual(grants.rows[0], { request_rls: true, asset_rls: true, anon_read: false, auth_insert: false, service_request: true, service_asset: true });
  const id = "10000000-0000-4000-8000-000000000001";
  await db.exec(`set role service_role; insert into public.public_buy_assistance_requests(id,contact_name,preferred_contact_method,contact_email,property_type,property_subtype,state,budget_minor) values('${id}','Ada Buyer','Email','ada@example.com','Residential','Bungalow','Lagos',8500000000); insert into public.public_buy_assistance_assets(request_id,public_id,mime_type,size_bytes) values('${id}','private/mandate.pdf','application/pdf',14); update public.public_buy_assistance_requests set status='ACCEPTED',accepted_at=now() where id='${id}'; reset role;`);
  await assert.rejects(() => db.exec("insert into public.public_buy_assistance_requests(id,contact_name,preferred_contact_method,property_type,state,budget_minor) values(gen_random_uuid(),'No Contact','Phone','Residential','Lagos',1)"));
  await assert.rejects(() => db.exec(`insert into public.public_buy_assistance_assets(request_id,public_id,mime_type,size_bytes) values('${id}','private/bad.png','image/png',10)`));
});
