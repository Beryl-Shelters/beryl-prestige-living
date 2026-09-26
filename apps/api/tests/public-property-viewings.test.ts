import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { createApp } from "../src/app.js";
import { authConfigSchema } from "../src/auth/config.js";
import type { PropertyViewingInput } from "../src/public-viewings/model.js";
import type { PropertyViewingsRepository } from "../src/public-viewings/repository.js";

const config = authConfigSchema.parse({ webOrigin: "http://localhost:3000", apiOrigin: "http://localhost:4000", supabaseUrl: "https://example.supabase.co", anonKey: "test", serviceKey: "test", encryptionKey: randomBytes(32).toString("base64"), cookieSecure: false, production: false });
const future = new Date(Date.now() + 172800000).toISOString().slice(0, 10);
const valid = { propertyCode: "res-abc234", firstName: " Ada ", lastName: " Buyer ", email: " ADA@EXAMPLE.COM ", phone: " +234 801 234 5678 ", preferredDate: future, preferredTime: "14:30", flexibleDates: false };

test("public property viewings validate, normalize and create only a safe viewing acknowledgement", async t => {
  const submissions: PropertyViewingInput[] = []; let fail = false;
  const repository: PropertyViewingsRepository = { async submit(input) { if (fail) throw new Error("private database detail"); submissions.push(input); return input.propertyCode === "RES-ABC234"; } };
  const server = createApp({ webAppUrl: config.webOrigin, auth: config, propertyViewingsRepository: repository }).listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve)); t.after(() => new Promise<void>(resolve => { server.close(() => resolve()); server.closeAllConnections(); }));
  const address = server.address(); assert(address && typeof address !== "string"); const base = `http://127.0.0.1:${address.port}/api/v1/public/property-viewings`;
  const send = (body: unknown = valid, origin = config.webOrigin, contentType = "application/json") => fetch(base, { method: "POST", headers: { Origin: origin, "Content-Type": contentType }, body: JSON.stringify(body) });
  const response = await send(); assert.equal(response.status, 201); assert.deepEqual(await response.json(), { success: true, data: { recorded: true } });
  assert.deepEqual(submissions[0], { ...valid, propertyCode: "RES-ABC234", firstName: "Ada", lastName: "Buyer", email: "ada@example.com", phone: "+234 801 234 5678" });
  assert.equal(["purchase","payment","ownership","referral","savedProperty","mortgageApplication"].some(key => key in submissions[0]!), false);
  assert.equal((await send({ ...valid, propertyCode: "RES-MISSING" })).status, 404);
  assert.equal((await send({ ...valid, preferredDate: null, preferredTime: null, flexibleDates: true })).status, 201);
  for (const body of [{ ...valid, firstName: "A" }, { ...valid, email: "bad" }, { ...valid, phone: "letters" }, { ...valid, preferredDate: "2000-01-01" }, { ...valid, preferredTime: null }, { ...valid, ownerId: "private" }]) assert.equal((await send(body)).status, 400);
  assert.equal((await fetch(base)).status, 404); assert.equal((await send(valid, "https://evil.example")).status, 403); assert.equal((await send(valid, config.webOrigin, "text/plain")).status, 415);
  fail = true; const unavailable = await send(); assert.equal(unavailable.status, 503); assert.equal(JSON.stringify(await unavailable.json()).includes("private database detail"), false); fail = false;
  let limited = false; for (let index = 0; index < 25; index++) if ((await send()).status === 429) { limited = true; break; } assert.equal(limited, true);
});

test("viewing migration is private and records only LISTED property requests through its service-role RPC", async t => {
  const db = new PGlite(); t.after(() => db.close()); await db.exec("create role anon; create role authenticated; create role service_role bypassrls; create table public.customer_listings(id uuid primary key,listing_code text unique not null,listing_status text not null);");
  await db.exec(await readFile(new URL("../supabase/migrations/202609260004_public_property_viewings.sql", import.meta.url), "utf8"));
  const grants = await db.query<{ rls: boolean; anon_read: boolean; auth_insert: boolean; service_read: boolean; service_insert: boolean; service_execute: boolean }>("select relrowsecurity rls,has_table_privilege('anon','public.public_property_viewings','SELECT') anon_read,has_table_privilege('authenticated','public.public_property_viewings','INSERT') auth_insert,has_table_privilege('service_role','public.public_property_viewings','SELECT') service_read,has_table_privilege('service_role','public.public_property_viewings','INSERT') service_insert,has_function_privilege('service_role','public.record_public_property_viewing(text,text,text,text,text,date,time without time zone,boolean)','EXECUTE') service_execute from pg_class where oid='public.public_property_viewings'::regclass");
  assert.deepEqual(grants.rows[0], { rls: true, anon_read: false, auth_insert: false, service_read: false, service_insert: false, service_execute: true });
  const listed = "10000000-0000-4000-8000-000000000001", pending = "10000000-0000-4000-8000-000000000002";
  await db.exec(`insert into public.customer_listings values('${listed}','RES-ABC234','LISTED'),('${pending}','RES-PRIVATE','PENDING'); set role service_role; select public.record_public_property_viewing('RES-ABC234','Ada','Buyer','ada@example.com','07042055678','${future}','14:30',false); reset role;`);
  const rows = await db.query<{ listing_id: string; status: string; email: string }>("select listing_id,status,email from public.public_property_viewings"); assert.deepEqual(rows.rows, [{ listing_id: listed, status: "NEW", email: "ada@example.com" }]);
  await db.exec("set role service_role"); const hidden = await db.query<{ value: string | null }>("select public.record_public_property_viewing('RES-PRIVATE','Ada','Buyer','ada@example.com','07042055678',null,null,true) value"); await db.exec("reset role"); assert.equal(hidden.rows[0]?.value, null);
});
