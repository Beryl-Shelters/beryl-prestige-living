import assert from "node:assert/strict";
import { test } from "node:test";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { createApp } from "../src/app.js";
import { authConfigSchema } from "../src/auth/config.js";
import type { AgentReport, PublicSupportRepository, SupportReport } from "../src/public-support/repository.js";

const config = authConfigSchema.parse({ webOrigin: "http://localhost:3000", apiOrigin: "http://localhost:4000", supabaseUrl: "https://example.supabase.co", anonKey: "test", serviceKey: "test", encryptionKey: randomBytes(32).toString("base64"), cookieSecure: false, production: false });

test("public support reports validate and persist only the supported Agent fields without a session", async t => {
  const saved: AgentReport[] = [];
  let fail = false;
  const repository: PublicSupportRepository = { async submit(report) { if (fail) throw new Error("private SQL detail"); assert.equal(report.reportType, "AGENT"); if (report.reportType === "AGENT") saved.push(report); } };
  const server = createApp({ webAppUrl: config.webOrigin, auth: config, publicSupportRepository: repository }).listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  t.after(() => new Promise<void>(resolve => { server.close(() => resolve()); server.closeAllConnections(); }));
  const address = server.address(); assert(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}/api/v1/public/support/reports`;
  const valid = { reportType: "AGENT", agentId: "  AG-101  ", agentName: "  Ada Agent  ", reason: "Suspicious listing\nPlease review." };
  const send = (body: unknown, origin = config.webOrigin, contentType = "application/json") => fetch(base, { method: "POST", headers: { Origin: origin, "Content-Type": contentType }, body: typeof body === "string" ? body : JSON.stringify(body) });
  const response = await send(valid);
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { success: true, data: { recorded: true } });
  assert.deepEqual(saved, [{ reportType: "AGENT", agentId: "AG-101", agentName: "Ada Agent", reason: valid.reason }]);
  assert.equal((await send({ ...valid, agentName: "" })).status, 201);
  assert.equal(saved.at(-1)?.agentName, null);
  const { agentName: _unused, ...withoutName } = valid;
  void _unused;
  assert.equal((await send(withoutName)).status, 201);
  assert.equal(saved.at(-1)?.agentName, null);
  for (const invalid of [
    { ...valid, reportType: undefined }, { ...valid, reportType: "PROPERTY" }, { ...valid, agentId: "" },
    { ...valid, agentId: "  " }, { ...valid, reason: undefined }, { ...valid, reason: " \n " }, { ...valid, agentId: "x".repeat(81) },
    { ...valid, agentName: "x".repeat(121) }, { ...valid, reason: "x".repeat(3001) },
    { ...valid, agentId: "A\u0001B" }, { ...valid, agentName: "A\u007fB" }, { ...valid, reason: "A\u0000B" },
    { ...valid, ownerId: "private" },
  ]) assert.equal((await send(invalid)).status, 400);
  assert.equal(saved.length, 3);
  assert.equal((await send(valid, "https://attacker.example")).status, 403);
  assert.equal((await send(valid, config.webOrigin, "text/plain")).status, 415);
  assert.equal((await fetch(base, { method: "GET" })).status, 404);
  assert.equal((await fetch(base + "?owner=private", { method: "POST", headers: { Origin: config.webOrigin, "Content-Type": "application/json" }, body: JSON.stringify(valid) })).status, 400);
  fail = true;
  const unavailable = await send(valid);
  assert.equal(unavailable.status, 503);
  assert(!JSON.stringify(await unavailable.json()).includes("private SQL"));
  let limited = false;
  for (let index = 0; index < 30; index++) { if ((await send(valid)).status === 429) { limited = true; break; } }
  assert(limited);
});

test("public support migration is a separate insert-only table with no browser access", async t => {
  const db = new PGlite(); t.after(() => db.close());
  await db.exec("create role anon; create role authenticated; create role service_role bypassrls;");
  await db.exec(await readFile(new URL("../supabase/migrations/202609170001_public_support_reports.sql", import.meta.url), "utf8"));
  const grants = await db.query<{ public_read: boolean; anon_read: boolean; anon_insert: boolean; authenticated_read: boolean; authenticated_update: boolean; service_insert: boolean; service_read: boolean; service_update: boolean; service_delete: boolean }>("select exists(select 1 from aclexplode((select relacl from pg_class where oid='public.public_support_reports'::regclass)) where grantee=0 and privilege_type='SELECT') public_read,has_table_privilege('anon','public.public_support_reports','SELECT') anon_read,has_table_privilege('anon','public.public_support_reports','INSERT') anon_insert,has_table_privilege('authenticated','public.public_support_reports','SELECT') authenticated_read,has_table_privilege('authenticated','public.public_support_reports','UPDATE') authenticated_update,has_table_privilege('service_role','public.public_support_reports','INSERT') service_insert,has_table_privilege('service_role','public.public_support_reports','SELECT') service_read,has_table_privilege('service_role','public.public_support_reports','UPDATE') service_update,has_table_privilege('service_role','public.public_support_reports','DELETE') service_delete");
  assert.deepEqual(grants.rows[0], { public_read: false, anon_read: false, anon_insert: false, authenticated_read: false, authenticated_update: false, service_insert: true, service_read: false, service_update: false, service_delete: false });
  const rls = await db.query<{ relrowsecurity: boolean }>("select relrowsecurity from pg_class where oid='public.public_support_reports'::regclass");
  assert.equal(rls.rows[0]?.relrowsecurity, true);
  await db.exec("set role service_role; insert into public.public_support_reports(report_type,agent_identifier,reason) values('AGENT','AG-1','A real concern'); reset role;");
  const rows = await db.query<{ report_type: string; agent_identifier: string; agent_name: string | null; created_at: string }>("select report_type,agent_identifier,agent_name,created_at from public.public_support_reports");
  assert.equal(rows.rows.length, 1);
  assert.deepEqual({ report_type: rows.rows[0]?.report_type, agent_identifier: rows.rows[0]?.agent_identifier, agent_name: rows.rows[0]?.agent_name }, { report_type: "AGENT", agent_identifier: "AG-1", agent_name: null });
  assert(Date.parse(rows.rows[0]!.created_at) > Date.now() - 60000);
  await assert.rejects(() => db.exec("insert into public.public_support_reports(report_type,agent_identifier,reason) values('PROPERTY','AG-1','A concern')"));
  await assert.rejects(() => db.exec("insert into public.public_support_reports(report_type,agent_identifier,reason) values('AGENT','','A concern')"));
});

test("Property reports use the same public endpoint with strict, separate subject fields", async t => {
  const saved: SupportReport[] = [];
  const repository: PublicSupportRepository = { async submit(report) { saved.push(report); } };
  const server = createApp({ webAppUrl: config.webOrigin, auth: config, publicSupportRepository: repository }).listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  t.after(() => new Promise<void>(resolve => { server.close(() => resolve()); server.closeAllConnections(); }));
  const address = server.address(); assert(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}/api/v1/public/support/reports`;
  const send = (body: unknown) => fetch(base, { method: "POST", headers: { Origin: config.webOrigin, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const valid = { reportType: "PROPERTY", propertyCode: "  RES-ABC  ", propertyName: "  Example home  ", reason: "Potentially misleading offer." };
  const response = await send(valid);
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { success: true, data: { recorded: true } });
  assert.deepEqual(saved[0], { reportType: "PROPERTY", propertyCode: "RES-ABC", propertyName: "Example home", reason: valid.reason });
  assert.equal((await send({ reportType: "PROPERTY", propertyCode: "OLD-UNLISTED", reason: "An old advert." })).status, 201);
  assert.deepEqual(saved[1], { reportType: "PROPERTY", propertyCode: "OLD-UNLISTED", propertyName: null, reason: "An old advert." });
  for (const invalid of [
    { ...valid, reportType: "" }, { ...valid, reportType: "HOUSE" }, { ...valid, propertyCode: "" },
    { ...valid, propertyCode: "x".repeat(81) }, { ...valid, propertyName: "x".repeat(121) },
    { ...valid, propertyCode: "A\u0001B" }, { ...valid, propertyName: "A\u007fB" },
    { ...valid, reason: " " }, { ...valid, reason: "x".repeat(3001) },
    { ...valid, agentId: "AG-1" }, { ...valid, agentName: "Stale" },
    { reportType: "PROPERTY", agentId: "AG-1", reason: "Missing code" },
    { reportType: "AGENT", propertyCode: "RES-1", reason: "Missing ID" },
  ]) assert.equal((await send(invalid)).status, 400);
  assert.equal(saved.length, 2);
  assert.equal((await fetch(base, { method: "GET" })).status, 404);
});

test("additive Property migration preserves Agent rows, blocks mixed rows and retains insert-only security", async t => {
  const db = new PGlite(); t.after(() => db.close());
  await db.exec("create role anon; create role authenticated; create role service_role bypassrls;");
  await db.exec(await readFile(new URL("../supabase/migrations/202609170001_public_support_reports.sql", import.meta.url), "utf8"));
  await db.exec("set role service_role; insert into public.public_support_reports(report_type,agent_identifier,reason) values('AGENT','AG-OLD','Existing report'); reset role;");
  await db.exec(await readFile(new URL("../supabase/migrations/202609180004_public_support_property_reports.sql", import.meta.url), "utf8"));
  const before = await db.query<{ report_type: string; agent_identifier: string }>("select report_type,agent_identifier from public.public_support_reports where agent_identifier='AG-OLD'");
  assert.deepEqual(before.rows, [{ report_type: "AGENT", agent_identifier: "AG-OLD" }]);
  const grants = await db.query<{ rls: boolean; anon_read: boolean; anon_insert: boolean; auth_read: boolean; auth_insert: boolean; service_insert: boolean; service_read: boolean }>("select relrowsecurity rls,has_table_privilege('anon','public.public_support_reports','SELECT') anon_read,has_table_privilege('anon','public.public_support_reports','INSERT') anon_insert,has_table_privilege('authenticated','public.public_support_reports','SELECT') auth_read,has_table_privilege('authenticated','public.public_support_reports','INSERT') auth_insert,has_table_privilege('service_role','public.public_support_reports','INSERT') service_insert,has_table_privilege('service_role','public.public_support_reports','SELECT') service_read from pg_class where oid='public.public_support_reports'::regclass");
  assert.deepEqual(grants.rows[0], { rls: true, anon_read: false, anon_insert: false, auth_read: false, auth_insert: false, service_insert: true, service_read: false });
  await db.exec("set role service_role; insert into public.public_support_reports(report_type,property_code,reason) values('PROPERTY','OLD-UNLISTED','Concern'); reset role;");
  await assert.rejects(() => db.exec("insert into public.public_support_reports(report_type,agent_identifier,property_code,reason) values('PROPERTY','AG-1','RES-1','Mixed')"));
  await assert.rejects(() => db.exec("insert into public.public_support_reports(report_type,agent_identifier,property_code,reason) values('AGENT','AG-1','RES-1','Mixed')"));
  await assert.rejects(() => db.exec("insert into public.public_support_reports(report_type,reason) values('PROPERTY','Missing code')"));
});
