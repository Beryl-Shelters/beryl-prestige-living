import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";
const origin = "http://127.0.0.1:3026",
  require = createRequire(import.meta.url),
  next = require.resolve("next/dist/bin/next"),
  cwd = resolve(import.meta.dirname, "..");
const server = spawn(
  process.execPath,
  [next, "dev", "-H", "127.0.0.1", "-p", "3026"],
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
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(origin)).ok) return;
    } catch {}
    await delay(500);
  }
  throw new Error(`Admin server did not start. ${output}`);
}
const id = "33333333-3333-4333-8333-333333333333",
  rows = Array.from({ length: 7 }, (_, index) => ({
    id: index ? id.replace(/^33333333/, String(index + 4).repeat(8)) : id,
    fullName: index ? `Referrer ${index + 1}` : "Controlled Referrer",
    phone: `+23480333333${index}`,
    referrals: index + 1,
    completed: index ? 0 : 1,
    earnedMinor: index ? 0 : 1000000,
    paidMinor: 0,
    outstandingMinor: index ? 0 : 1000000,
    bankStatus: index ? "NOT_NEEDED" : "ON_FILE",
  }));
let empty = false,
  paid = false;
function detail() {
  return {
    referrer: {
      id,
      fullName: "Controlled Referrer",
      email: "referrer@example.test",
      phone: "+2348033333330",
    },
    summary: {
      referrals: 1,
      completed: 1,
      earnedMinor: 1000000,
      paidMinor: paid ? 1000000 : 0,
      outstandingMinor: paid ? 0 : 1000000,
    },
    bank: {
      status: "ON_FILE",
      accountName: "Controlled Referrer",
      bankName: "Test Bank",
      maskedAccountNumber: "••••••6789",
    },
    items: [
      {
        commissionId: "COM-ABC234",
        referralCode: "REF-ABC234",
        referredName: "Controlled Buyer",
        referralType: "PROPERTY",
        propertyCode: "RES-ABC234",
        earnedAt: "2026-09-20T12:00:00Z",
        status: "COMPLETED",
        rewardMinor: 1000000,
        paymentState: paid ? "PAID" : "OUTSTANDING",
        paymentId: paid ? "PAY-ABC234" : null,
        paidAt: paid ? "2026-09-28T12:00:00Z" : null,
      },
    ],
    page: 1,
    pageSize: 10,
    total: 1,
    totalPages: 1,
  };
}
try {
  await ready();
  const browser = await chromium.launch({
      headless: true,
      executablePath: process.env.BROWSER_EXECUTABLE,
    }),
    context = await browser.newContext({ serviceWorkers: "block" }),
    requests = [];
  await context.route(`${origin}/api/v1/admin/**`, async (route) => {
    const url = new URL(route.request().url()),
      path = url.pathname.replace("/api/v1/admin", "");
    requests.push(`${route.request().method()} ${path}${url.search}`);
    const reply = (data, status = 200, contentType = "application/json") =>
      route.fulfill({
        status,
        contentType,
        body:
          contentType === "application/json"
            ? JSON.stringify(
                status < 400
                  ? { success: true, data }
                  : { success: false, error: data },
              )
            : "%PDF-test",
      });
    if (path === "/auth/me")
      return reply({
        admin: {
          userId: "admin-1",
          fullName: "Finance Admin",
          email: "admin@example.test",
          phone: "+2348000000000",
          department: "MANAGEMENT",
          role: "ADMIN",
          active: true,
        },
      });
    if (path === "/referrers") {
      if (empty)
        return reply({
          summary: {
            referrers: 0,
            referrals: 0,
            completed: 0,
            outstandingMinor: 0,
          },
          counts: { all: 0, owed: 0, paid: 0 },
          items: [],
          page: 1,
          pageSize: 6,
          total: 0,
          totalPages: 0,
        });
      const search = (url.searchParams.get("search") ?? "").toLowerCase(),
        filter = url.searchParams.get("filter") ?? "ALL",
        page = Number(url.searchParams.get("page") ?? 1);
      let found = rows.filter(
        (row) =>
          (!search ||
            `${row.fullName} ${row.phone}`.toLowerCase().includes(search)) &&
          (filter !== "OWED" || row.outstandingMinor > 0) &&
          (filter !== "PAID" ||
            (row.earnedMinor > 0 && row.outstandingMinor === 0)),
      );
      const total = found.length;
      found = found.slice((page - 1) * 6, page * 6);
      return reply({
        summary: {
          referrers: 7,
          referrals: 28,
          completed: 1,
          outstandingMinor: 1000000,
        },
        counts: { all: 7, owed: 1, paid: 0 },
        items: found,
        page,
        pageSize: 6,
        total,
        totalPages: total ? Math.ceil(total / 6) : 0,
      });
    }
    if (path === `/referrers/${id}`) return reply({ referrer: detail() });
    if (
      path === "/referrers/commissions/COM-ABC234/payment" &&
      route.request().method() === "GET"
    )
      return reply({
        payment: {
          commissionId: "COM-ABC234",
          referrerId: id,
          referrerName: "Controlled Referrer",
          referralCode: "REF-ABC234",
          amountMinor: 1000000,
          accountName: "Controlled Referrer",
          bankName: "Test Bank",
          accountNumber: "0123456789",
        },
      });
    if (
      path === "/referrers/commissions/COM-ABC234/payment" &&
      route.request().method() === "POST"
    ) {
      paid = true;
      return reply({ payment: { paymentId: "PAY-ABC234" } }, 201);
    }
    if (path === "/referrers/payments/PAY-ABC234/receipt")
      return reply({}, 200, "application/pdf");
    return route.abort();
  });
  const page = await context.newPage(),
    errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.setDefaultNavigationTimeout(60000);
  await page.setViewportSize({ width: 1440, height: 950 });
  await page.goto(`${origin}/dashboard/referrers`);
  await page.getByRole("heading", { name: "Referrers" }).waitFor();
  assert.equal(
    await page
      .getByText(
        "Everyone who has sent Beryl a referral, and what they're owed.",
      )
      .count(),
    1,
  );
  assert.equal(await page.locator("tbody tr").count(), 6);
  assert.equal(
    await page
      .getByRole("navigation", { name: "Admin navigation" })
      .getByRole("link", { name: "Referrers" })
      .getAttribute("href"),
    "/dashboard/referrers",
  );
  await page.getByRole("button", { name: "Next ›" }).click();
  await page.waitForURL(/page=2/);
  await page.waitForFunction(
    () => document.querySelectorAll("tbody tr").length === 1,
  );
  assert.equal(await page.locator("tbody tr").count(), 1);
  await page.getByLabel("Search referrers").fill("Controlled");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await page.waitForURL(/search=Controlled/);
  await page.getByText("Controlled Referrer", { exact: true }).waitFor();
  await page.getByRole("link", { name: "View Controlled Referrer" }).click();
  await page.getByRole("heading", { name: "Controlled Referrer" }).waitFor();
  assert.equal(await page.getByText("••••••6789").count(), 1);
  assert.equal(await page.getByText("0123456789").count(), 0);
  await page.getByRole("button", { name: "Mark as paid" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByText("0123456789").waitFor();
  assert.equal(
    await dialog.getByRole("button", { name: "Confirm Payment" }).isDisabled(),
    true,
  );
  await dialog
    .locator('input[type="file"]')
    .setInputFiles({
      name: "receipt.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-test"),
    });
  await dialog.getByRole("button", { name: "Confirm Payment" }).click();
  await page.getByRole("heading", { name: "Payment Recorded" }).waitFor();
  await page.getByText("We have saved this payment successfully.").waitFor();
  await page.getByRole("button", { name: "Done" }).click();
  await page.getByText("Paid", { exact: true }).waitFor();
  assert.equal(
    requests.some(
      (value) => value === "POST /referrers/commissions/COM-ABC234/payment",
    ),
    true,
  );
  empty = true;
  await page.goto(`${origin}/dashboard/referrers`);
  await page.getByRole("heading", { name: "No referrers yet" }).waitFor();
  for (const width of [1440, 1280, 1024, 768, 430, 390, 360]) {
    empty = false;
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${origin}/dashboard/referrers`);
    await page.getByRole("heading", { name: "Referrers" }).waitFor();
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
      `whole-page overflow at ${width}`,
    );
    if (width <= 900)
      assert.equal(
        await page.getByRole("button", { name: "Open navigation" }).isVisible(),
        true,
      );
  }
  assert.deepEqual(errors, []);
  await browser.close();
  console.log(
    "Admin Referrers UI: directory, detail, payment, empty state and responsive widths passed",
  );
} finally {
  server.kill();
}
