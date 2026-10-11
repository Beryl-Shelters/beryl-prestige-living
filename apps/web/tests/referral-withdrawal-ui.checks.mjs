import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";
import { dashboardFixture } from "./dashboard-ui.checks.mjs";

const origin = "http://127.0.0.1:3027";
const require = createRequire(import.meta.url);
const next = require.resolve("next/dist/bin/next");
const cwd = resolve(import.meta.dirname, "..");
const server = spawn(
  process.execPath,
  [next, "dev", "-H", "127.0.0.1", "-p", "3027"],
  {
    cwd,
    env: { ...process.env, NEXT_PUBLIC_API_BASE_URL: origin },
    stdio: ["ignore", "pipe", "pipe"],
  },
);
let output = "";
server.stdout.on("data", (chunk) => (output += chunk));
server.stderr.on("data", (chunk) => (output += chunk));

async function ready() {
  for (let index = 0; index < 60; index++) {
    try {
      if ((await fetch(origin)).ok) return;
    } catch {}
    await delay(500);
  }
  throw new Error(`Web server did not start. ${output}`);
}

try {
  await ready();
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.BROWSER_EXECUTABLE,
  });
  const context = await browser.newContext({ serviceWorkers: "block" });
  const calls = [];
  await context.route(`${origin}/api/v1/**`, async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace("/api/v1", "");
    calls.push(`${route.request().method()} ${path}`);
    if (path === "/dashboard/overview")
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: dashboardFixture }),
      });
    return route.abort();
  });

  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.setDefaultNavigationTimeout(60000);

  const retired = await page.goto(
    `${origin}/dashboard/referrals/withdraw`,
  );
  assert.equal(retired?.status(), 404);
  assert.equal(await page.getByRole("heading", { name: "Withdraw Earnings" }).count(), 0);

  await page.goto(`${origin}/dashboard`);
  await page.locator(".dashboard-greeting").waitFor();
  assert.equal(
    await page.getByRole("link", { name: "Withdraw Earnings" }).count(),
    0,
  );
  assert.equal(calls.some((call) => call.includes("/withdrawals")), false);
  assert.deepEqual(errors, []);
  await browser.close();
  console.log(
    "Customer withdrawal retirement UI: direct route is 404, navigation is absent, and no withdrawal API is called",
  );
} finally {
  server.kill();
}
