import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { createApp } from "../src/app.js";
import { authConfigSchema } from "../src/auth/config.js";
import type { MediaStorage } from "../src/listings/media.js";
import { careerApplicationInput, careerPositions } from "../src/public-careers/model.js";
import type { CareerApplicationsRepository } from "../src/public-careers/repository.js";
import { CareerApplicationsService } from "../src/public-careers/service.js";
import { CAREER_RESUME_BYTES } from "../src/public-careers/uploads.js";

const config = authConfigSchema.parse({ webOrigin: "http://localhost:3000", apiOrigin: "http://localhost:4000", supabaseUrl: "https://example.supabase.co", anonKey: "test", serviceKey: "test", encryptionKey: randomBytes(32).toString("base64"), cookieSecure: false, production: false });
const pdf = Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF");

test("public Careers accepts each exact position without a session and never reports a failed upload/DB write as success", async t => {
  const rows = new Map<string, { accepted: boolean; input?: unknown }>();
  let uploadFails = false, acceptFails = false, uploaded = 0, removed = 0;
  const repository: CareerApplicationsRepository = {
    async reserve(id) { rows.set(id, { accepted: false }); },
    async accept(id, input) { if (acceptFails) throw new Error("private SQL detail"); rows.set(id, { accepted: true, input }); },
    async abandoned() { return [...rows].filter(([, row]) => !row.accepted).map(([id]) => id); },
    async forget(id) { rows.delete(id); },
  };
  const storage: MediaStorage = {
    async upload(file, asset) { uploaded++; if (uploadFails) throw new Error("private provider detail"); return { ...asset, url: "", mime_type: file.mime, size_bytes: file.bytes.length }; },
    async remove() { removed++; },
    async download() { throw new Error("Not supported"); },
  };
  const server = createApp({ webAppUrl: config.webOrigin, auth: config, careerApplicationsRepository: repository, mediaStorage: storage }).listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  t.after(() => new Promise<void>(resolve => { server.close(() => resolve()); server.closeAllConnections(); }));
  const address = server.address(); assert(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}/api/v1/public/careers/applications`;
  const send = (position: string, overrides: Record<string, unknown> = {}, file = pdf, mime = "application/pdf", origin = config.webOrigin) => {
    const input = { fullName: "Ada Okafor", email: "ada@example.test", phone: "08012345678", position, coverLetter: "Please consider me.", ...overrides };
    const form = new FormData(); form.set("data", JSON.stringify(input)); form.set("resume", new Blob([new Uint8Array(file)], { type: mime }), "resume.pdf");
    return fetch(base, { method: "POST", headers: { Origin: origin }, body: form });
  };
  for (const position of careerPositions) {
    const response = await send(position);
    assert.equal(response.status, 201, await response.clone().text());
    assert.deepEqual(await response.json(), { success: true, data: { recorded: true } });
  }
  assert.equal([...rows.values()].filter(row => row.accepted).length, 5);
  assert.equal(uploaded, 5);
  for (const position of ["", "Select a role", "CEO"]) assert.equal((await send(position)).status, 400);
  for (const overrides of [{ fullName: "" }, { email: "bad" }, { phone: "123" }, { fullName: "a".repeat(121) }, { coverLetter: "x".repeat(3001) }, { ownerId: "spoof" }]) assert.equal((await send(careerPositions[0], overrides)).status, 400);
  assert.equal((await send(careerPositions[0], {}, Buffer.alloc(0))).status, 400);
  assert.equal((await send(careerPositions[0], {}, Buffer.from("not a pdf"))).status, 400);
  assert.equal((await send(careerPositions[0], {}, pdf, "application/msword")).status, 400);
  assert.equal((await send(careerPositions[0], {}, Buffer.alloc(CAREER_RESUME_BYTES + 1, 65))).status, 400);
  assert.equal((await send(careerPositions[0], {}, pdf, "application/pdf", "https://evil.example")).status, 403);
  assert.equal((await fetch(base, { method: "GET" })).status, 404);
  assert.equal((await fetch(base, { method: "POST", headers: { Origin: config.webOrigin, "Content-Type": "application/json" }, body: "{}" })).status, 415);
  uploadFails = true;
  const failedUpload = await send(careerPositions[0]); assert.equal(failedUpload.status, 503); assert(!JSON.stringify(await failedUpload.json()).includes("private provider"));
  uploadFails = false; acceptFails = true;
  const failedDb = await send(careerPositions[0]); assert.equal(failedDb.status, 503); assert(!JSON.stringify(await failedDb.json()).includes("private SQL"));
  assert.equal([...rows.values()].filter(row => row.accepted).length, 5);
  assert.equal(removed, 1); // the earlier failed upload was reclaimed on the next request
  assert.equal([...rows.values()].filter(row => !row.accepted).length, 1); // failed DB write remains reserved
  acceptFails = false;
  let limited = false;
  for (let index = 0; index < 45; index++) if ((await send(careerPositions[0])).status === 429) { limited = true; break; }
  assert.equal(limited, true);
});

test("abandoned private resume reservations are removed but accepted applications are untouched", async () => {
  const calls: string[] = [];
  const repository: CareerApplicationsRepository = {
    async reserve() { throw new Error("unused"); }, async accept() { throw new Error("unused"); },
    async abandoned() { return ["beryl-v2/careers/abandoned.pdf"]; },
    async forget(id) { calls.push(`forget:${id}`); },
  };
  const storage: MediaStorage = {
    async upload() { throw new Error("unused"); },
    async remove(asset) { calls.push(`remove:${asset.public_id}:${asset.delivery_type}`); },
    async download() { throw new Error("unused"); },
  };
  await new CareerApplicationsService(repository, storage).cleanup();
  assert.deepEqual(calls, ["remove:beryl-v2/careers/abandoned.pdf:authenticated", "forget:beryl-v2/careers/abandoned.pdf"]);
});

test("career input and migration keep pending rows private and accepted rows complete", async t => {
  const browserSource = await readFile(new URL("../../web/lib/career-positions.ts", import.meta.url), "utf8");
  const browserOptions = browserSource.match(/careerPositions = (\[[^\]]+\]) as const/);
  assert(browserOptions);
  assert.deepEqual(JSON.parse(browserOptions[1]!), careerPositions);
  assert.equal(careerApplicationInput.safeParse({ fullName: "Ada Okafor", email: "ada@example.test", phone: "+234 801 234 5678", position: careerPositions[0] }).success, true);
  const db = new PGlite(); t.after(() => db.close());
  await db.exec("create role anon; create role authenticated; create role service_role bypassrls;");
  await db.exec(await readFile(new URL("../supabase/migrations/202609180003_public_career_applications.sql", import.meta.url), "utf8"));
  const result = await db.query<{ relrowsecurity: boolean; anon_read: boolean; auth_insert: boolean; service_insert: boolean; service_select: boolean }>("select relrowsecurity, has_table_privilege('anon','public.public_career_applications','SELECT') anon_read,has_table_privilege('authenticated','public.public_career_applications','INSERT') auth_insert,has_table_privilege('service_role','public.public_career_applications','INSERT') service_insert,has_table_privilege('service_role','public.public_career_applications','SELECT') service_select from pg_class where oid='public.public_career_applications'::regclass");
  assert.deepEqual(result.rows[0], { relrowsecurity: true, anon_read: false, auth_insert: false, service_insert: true, service_select: true });
  await db.exec("set role service_role; insert into public.public_career_applications(resume_public_id) values('private/resume.pdf'); reset role;");
  await assert.rejects(() => db.exec("update public.public_career_applications set status='ACCEPTED' where resume_public_id='private/resume.pdf'"));
  await db.exec("update public.public_career_applications set status='ACCEPTED',resume_mime_type='application/pdf',resume_size_bytes=32,full_name='Ada Okafor',email='ada@example.test',phone='08012345678',position='Frontend Developer',accepted_at=now() where resume_public_id='private/resume.pdf'");
  await assert.rejects(() => db.exec("insert into public.public_career_applications(resume_public_id,position) values('other/resume.pdf','CEO')"));
});
