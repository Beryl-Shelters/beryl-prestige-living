import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { createApp } from "../src/app.js";
import { authConfigSchema } from "../src/auth/config.js";
import type { MediaStorage } from "../src/listings/media.js";
import type { SellAssistanceInput } from "../src/public-sell-assistance/model.js";
import type { AssistanceAsset, SellAssistanceRepository } from "../src/public-sell-assistance/repository.js";

const config = authConfigSchema.parse({ webOrigin: "http://localhost:3000", apiOrigin: "http://localhost:4000", supabaseUrl: "https://example.supabase.co", anonKey: "test", serviceKey: "test", encryptionKey: randomBytes(32).toString("base64"), cookieSecure: false, production: false });
const png = Buffer.from([137,80,78,71,13,10,26,10,0]); const pdf = Buffer.from("%PDF-1.4\n%%EOF");
const valid = { contactName: "Ada Seller", preferredContactMethod: "Email", contactEmail: " ADA@EXAMPLE.COM ", sellerType: "Family Property", location: "Lekki, Lagos", propertyType: "Residential", landArea: 500, parkingSpaces: 2, facilities: ["CCTV", "Garden"], units: 2, titleDocument: "C of O", lienStatus: "No", askingPrice: "50000000", minimumDownPaymentPercent: 30, saleAuthorized: true, likelyTransferableGiftings: "Existing survey package" };

test("public Sell Assistance validates private multipart submissions without listing or transaction side effects", async t => {
  const reservations: { id: string; input: SellAssistanceInput; assets: AssistanceAsset[]; accepted: boolean }[] = []; let fail = false; const uploads: string[] = [];
  const repository: SellAssistanceRepository = {
    async reserve(id, input, assets) { reservations.push({ id, input, assets, accepted: false }); },
    async accept(id) { if (fail) throw new Error("private database detail"); reservations.find(row => row.id === id)!.accepted = true; },
    async abandoned() { return []; }, async forget() {},
  };
  const storage: MediaStorage = {
    async upload(file, asset) { uploads.push(`${asset.resource_type}:${asset.delivery_type}:${file.mime}`); return { ...asset, url: "", mime_type: file.mime, size_bytes: file.bytes.length }; },
    async remove() {}, async download() { throw new Error("not supported"); },
  };
  const server = createApp({ webAppUrl: config.webOrigin, auth: config, sellAssistanceRepository: repository, mediaStorage: storage }).listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve)); t.after(() => new Promise<void>(resolve => { server.close(() => resolve()); server.closeAllConnections(); }));
  const address = server.address(); assert(address && typeof address !== "string"); const base = `http://127.0.0.1:${address.port}/api/v1/public/sell-assistance`;
  const send = (body: Record<string, unknown> = valid, image = png, imageMime = "image/png", document: Buffer | null = pdf, documentMime = "application/pdf", origin = config.webOrigin) => {
    const form = new FormData(); form.set("data", JSON.stringify(body)); if (image.length) form.append("propertyImages", new Blob([new Uint8Array(image)], { type: imageMime }), "property.png"); if (document) form.set("authorizationDocument", new Blob([new Uint8Array(document)], { type: documentMime }), "authorization.pdf");
    return fetch(base, { method: "POST", headers: { Origin: origin }, body: form });
  };
  const response = await send(); assert.equal(response.status, 201, await response.clone().text()); assert.deepEqual(await response.json(), { success: true, data: { recorded: true } });
  assert.equal(reservations[0]?.accepted, true); assert.equal(reservations[0]?.input.contactEmail, "ada@example.com"); assert.equal(reservations[0]?.input.askingPrice, 5000000000); assert.deepEqual(uploads, ["raw:authenticated:image/png", "raw:authenticated:application/pdf"]);
  assert.equal(JSON.stringify(await (await send({ ...valid, saleAuthorized: false }, Buffer.alloc(0), "image/png", null)).json()).includes("publicId"), false);
  for (const body of [
    { ...valid, contactName: "" }, { ...valid, preferredContactMethod: "WhatsApp" }, { ...valid, contactEmail: "bad" }, { ...valid, propertyType: "Industrial" },
    { ...valid, landArea: -1 }, { ...valid, parkingSpaces: -1 }, { ...valid, units: 0 }, { ...valid, askingPrice: "0" }, { ...valid, minimumDownPaymentPercent: 101 },
    { ...valid, facilities: ["Private Helipad"] }, { ...valid, ownerId: "spoof" },
  ]) assert.equal((await send(body)).status, 400);
  assert.equal((await send(valid, Buffer.from("fake"), "image/png")).status, 400);
  assert.equal((await send(valid, png, "image/png", Buffer.from("fake"), "application/pdf")).status, 400);
  assert.equal((await send(valid, Buffer.alloc(0), "image/png", null)).status, 400);
  assert.equal((await send({ ...valid, saleAuthorized: false })).status, 400);
  assert.equal((await send(valid, png, "image/png", pdf, "application/pdf", "https://evil.example")).status, 403);
  assert.equal((await fetch(base)).status, 404);
  assert.equal((await fetch(base, { method: "POST", headers: { Origin: config.webOrigin, "Content-Type": "application/json" }, body: "{}" })).status, 415);
  fail = true; const unavailable = await send(); assert.equal(unavailable.status, 503); assert.equal(JSON.stringify(await unavailable.json()).includes("private database detail"), false); fail = false;
  let limited = false; for (let index = 0; index < 25; index++) if ((await send()).status === 429) { limited = true; break; } assert.equal(limited, true);
  assert.equal(reservations.some(row => "listing_status" in row.input || "purchase" in row.input || "referral" in row.input), false);
});

test("Sell Assistance migration keeps requests and assets private with strict constraints", async t => {
  const db = new PGlite(); t.after(() => db.close()); await db.exec("create role anon; create role authenticated; create role service_role bypassrls;");
  await db.exec(await readFile(new URL("../supabase/migrations/202609260002_public_sell_assistance_requests.sql", import.meta.url), "utf8"));
  const grants = await db.query<{ request_rls: boolean; asset_rls: boolean; anon_read: boolean; auth_insert: boolean; service_request: boolean; service_asset: boolean }>("select (select relrowsecurity from pg_class where oid='public.public_sell_assistance_requests'::regclass) request_rls,(select relrowsecurity from pg_class where oid='public.public_sell_assistance_assets'::regclass) asset_rls,has_table_privilege('anon','public.public_sell_assistance_requests','SELECT') anon_read,has_table_privilege('authenticated','public.public_sell_assistance_requests','INSERT') auth_insert,has_table_privilege('service_role','public.public_sell_assistance_requests','INSERT,SELECT,UPDATE,DELETE') service_request,has_table_privilege('service_role','public.public_sell_assistance_assets','INSERT,SELECT,UPDATE,DELETE') service_asset");
  assert.deepEqual(grants.rows[0], { request_rls: true, asset_rls: true, anon_read: false, auth_insert: false, service_request: true, service_asset: true });
  const id = "10000000-0000-4000-8000-000000000001";
  await db.exec(`set role service_role; insert into public.public_sell_assistance_requests(id,contact_name,preferred_contact_method,contact_email,property_location,property_type,asking_price_minor) values('${id}','Ada Seller','Email','ada@example.com','Lekki','Residential',5000000000); insert into public.public_sell_assistance_assets(request_id,asset_kind,public_id,mime_type,size_bytes,sort_order) values('${id}','PROPERTY_IMAGE','private/image.png','image/png',9,0); update public.public_sell_assistance_requests set status='ACCEPTED',accepted_at=now() where id='${id}'; reset role;`);
  await assert.rejects(() => db.exec("insert into public.public_sell_assistance_requests(id,contact_name,preferred_contact_method,property_location,property_type,asking_price_minor) values(gen_random_uuid(),'No Contact','Phone','Lagos','Residential',1)"));
  await assert.rejects(() => db.exec(`insert into public.public_sell_assistance_assets(request_id,asset_kind,public_id,mime_type,size_bytes,sort_order) values('${id}','AUTHORIZATION_DOCUMENT','private/bad.webp','image/webp',10,0)`));
});
