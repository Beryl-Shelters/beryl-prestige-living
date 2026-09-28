import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { chromium } from "playwright";

const origin = "http://127.0.0.1:3023";
const require = createRequire(import.meta.url);
const next = require.resolve("next/dist/bin/next");
const cwd = resolve(import.meta.dirname, "..");
const server = spawn(process.execPath, [next, "dev", "-H", "127.0.0.1", "-p", "3023"], {
  cwd,
  env: { ...process.env, NEXT_PUBLIC_API_BASE_URL: origin, NEXT_PUBLIC_WEB_APP_URL: origin },
  stdio: ["ignore", "pipe", "pipe"],
});
let output = "";
server.stdout.on("data", (chunk) => (output += chunk));
server.stderr.on("data", (chunk) => (output += chunk));

async function ready() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try { if ((await fetch(origin)).ok) return; } catch {}
    await delay(500);
  }
  throw new Error(`Admin Next server did not start. ${output}`);
}

const ids = Array.from({ length: 8 }, (_, index) => `${String(index + 1).padStart(8, "0")}-1111-4111-8111-111111111111`);
const baseCustomers = [
  { id: ids[0], fullName: "Ada Multi", email: "ada@example.test", phone: "+2348011111111", joinedAt: "2026-09-08T09:00:00.000Z", accountType: "INVESTOR", profileType: "PERSONAL", hasPropertyActivity: true, hasListingActivity: true, hasReferralActivity: true, referralCode: "REF-ADA234", kycStatus: "APPROVED" },
  { id: ids[1], fullName: "Bisi Business", email: "bisi@example.test", phone: "+2348022222222", joinedAt: "2026-09-07T09:00:00.000Z", accountType: "PROPERTY_DEVELOPER", profileType: "BUSINESS", hasPropertyActivity: true, hasListingActivity: true, hasReferralActivity: false, referralCode: null, kycStatus: "APPROVED" },
  { id: ids[2], fullName: "Chidi Empty", email: "chidi@example.test", phone: "+2348033333333", joinedAt: "2026-09-06T09:00:00.000Z", accountType: "LANDLORD", profileType: "PERSONAL", hasPropertyActivity: false, hasListingActivity: false, hasReferralActivity: false, referralCode: null, kycStatus: "PENDING_REVIEW" },
  { id: ids[3], fullName: "Dayo Property", email: "dayo@example.test", phone: "+2348044444444", joinedAt: "2026-09-05T09:00:00.000Z", accountType: "INVESTOR", profileType: "PERSONAL", hasPropertyActivity: true, hasListingActivity: false, hasReferralActivity: false, referralCode: null, kycStatus: "NOT_SUBMITTED" },
  { id: ids[4], fullName: "Efe Referral", email: "efe@example.test", phone: "+2348055555555", joinedAt: "2026-09-04T09:00:00.000Z", accountType: "REGISTERED_AGENT", profileType: "BUSINESS", hasPropertyActivity: false, hasListingActivity: false, hasReferralActivity: true, referralCode: "REF-EFE234", kycStatus: "REJECTED" },
  { id: ids[5], fullName: "Femi Property", email: "femi@example.test", phone: "+2348066666666", joinedAt: "2026-09-03T09:00:00.000Z", accountType: "INVESTOR", profileType: "PERSONAL", hasPropertyActivity: true, hasListingActivity: false, hasReferralActivity: false, referralCode: null, kycStatus: "APPROVED" },
  { id: ids[6], fullName: "Grace Empty", email: "grace@example.test", phone: "+2348077777777", joinedAt: "2026-09-02T09:00:00.000Z", accountType: "FREELANCE_AGENT", profileType: "PERSONAL", hasPropertyActivity: false, hasListingActivity: false, hasReferralActivity: false, referralCode: null, kycStatus: "NOT_SUBMITTED" },
  { id: ids[7], fullName: "Hauwa Referral", email: "hauwa@example.test", phone: "+2348088888888", joinedAt: "2026-09-01T09:00:00.000Z", accountType: "FREELANCE_AGENT", profileType: "PERSONAL", hasPropertyActivity: false, hasListingActivity: false, hasReferralActivity: true, referralCode: "REF-HAU234", kycStatus: "APPROVED" },
];
const details = new Map([
  [ids[0], { ...baseCustomers[0], propertyActivity: { hasActivity: true, firstActivityAt: "2026-09-09T00:00:00.000Z", savedProperties: 2, completedPurchases: 1 }, listingActivity: { hasActivity: true, firstListingAt: "2026-09-10T00:00:00.000Z", listingCount: 2 }, referralActivity: { hasActivity: true, firstReferralLinkAt: "2026-09-11T00:00:00.000Z", referralLinkCount: 2, referralCode: "REF-ADA234" }, businessInformation: { exists: false, companyName: null, companyAddress: null } }],
  [ids[1], { ...baseCustomers[1], propertyActivity: { hasActivity: true, firstActivityAt: "2026-09-08T00:00:00.000Z", savedProperties: 0, completedPurchases: 1 }, listingActivity: { hasActivity: true, firstListingAt: "2026-09-08T00:00:00.000Z", listingCount: 1 }, referralActivity: { hasActivity: false, firstReferralLinkAt: null, referralLinkCount: 0, referralCode: null }, businessInformation: { exists: true, companyName: "Bisi Developments Ltd.", companyAddress: "7 Adeola Odeku Street, Lagos, Nigeria" } }],
  [ids[2], { ...baseCustomers[2], propertyActivity: { hasActivity: false, firstActivityAt: null, savedProperties: 0, completedPurchases: 0 }, listingActivity: { hasActivity: false, firstListingAt: null, listingCount: 0 }, referralActivity: { hasActivity: false, firstReferralLinkAt: null, referralLinkCount: 0, referralCode: null }, businessInformation: { exists: false, companyName: null, companyAddress: null } }],
]);

try {
  await ready();
  const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE });
  const context = await browser.newContext({ serviceWorkers: "block" });
  const requests = [];
  let emptyDirectory = false;
  await context.route(`${origin}/api/v1/admin/**`, async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace("/api/v1/admin", "");
    requests.push(`${path}${url.search}`);
    const reply = (data, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(status < 400 ? { success: true, data } : { success: false, error: data }) });
    if (path === "/auth/me") return reply({ admin: { userId: "admin-1", fullName: "Abimbola Johnson", email: "admin@example.test", phone: "+2348000000000", department: "MANAGEMENT", role: "SUPER_ADMIN", active: true } });
    if (path === "/customers") {
      if (emptyDirectory) return reply({ summary: { totalUsers: 0, propertyActivityCustomers: 0, listingActivityCustomers: 0, referralActivityCustomers: 0 }, items: [], page: 1, pageSize: 6, total: 0, totalPages: 0 });
      const search = (url.searchParams.get("search") ?? "").toLowerCase();
      const accountType = url.searchParams.get("accountType") ?? "ALL";
      const profileType = url.searchParams.get("profileType") ?? "ALL";
      const sort = url.searchParams.get("sort") ?? "NEWEST";
      const page = Number(url.searchParams.get("page") ?? "1");
      let rows = baseCustomers.filter((customer) => (!search || `${customer.fullName} ${customer.email} ${customer.phone}`.toLowerCase().includes(search)) && (accountType === "ALL" || customer.accountType === accountType) && (profileType === "ALL" || customer.profileType === profileType));
      rows = [...rows].sort((a, b) => sort === "OLDEST" ? a.joinedAt.localeCompare(b.joinedAt) : sort === "NAME_ASC" ? a.fullName.localeCompare(b.fullName) : sort === "NAME_DESC" ? b.fullName.localeCompare(a.fullName) : b.joinedAt.localeCompare(a.joinedAt));
      const total = rows.length;
      return reply({ summary: { totalUsers: 8, propertyActivityCustomers: 4, listingActivityCustomers: 2, referralActivityCustomers: 3 }, items: rows.slice((page - 1) * 6, page * 6), page, pageSize: 6, total, totalPages: total ? Math.ceil(total / 6) : 0 });
    }
    if (path.startsWith("/customers/")) {
      const customer = details.get(path.slice("/customers/".length));
      return customer ? reply({ customer }) : reply({ code: "CUSTOMER_NOT_FOUND", message: "Customer not found." }, 404);
    }
    return route.abort();
  });

  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.setDefaultNavigationTimeout(60000);

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(origin);
  await page.getByRole("heading", { name: "Admin Portal" }).waitFor();
  const navigation = page.getByRole("navigation", { name: "Admin navigation" });
  for (const name of ["Dashboard", "Users", "Properties", "Leads"]) assert.equal(await navigation.getByText(name, { exact: true }).count(), 1);
  for (const obsolete of ["My Listings", "Payments", "Subaccounts", "Save-as-you-earn", "Invest", "Refer & earn", "Support", "Settings"]) assert.equal(await navigation.getByText(obsolete, { exact: true }).count(), 0);
  assert.equal(await navigation.getByRole("link", { name: "Properties" }).getAttribute("href"), "/dashboard/properties");
  assert.equal(await page.getByRole("button", { name: "Invite Admin" }).isVisible(), true);

  await navigation.getByRole("link", { name: "Users" }).click();
  await page.getByRole("heading", { name: "Users", exact: true }).waitFor();
  await page.getByText("Customer directory. View only — no changes can be made here.").waitFor();
  assert.equal(await page.getByText("8", { exact: true }).first().isVisible(), true);
  assert.equal(await page.locator("tbody tr").count(), 6);
  assert.equal(await page.getByLabel("Property Activity, Listing Activity, Referral Activity").count(), 1);
  for (const label of ["Property Activity", "Listing Activity", "Referral Activity"]) assert.equal(await page.getByText(label, { exact: true }).count() > 0, true);
  assert.equal(await page.getByText("Verified", { exact: true }).count() > 0, true);
  assert.equal(await page.getByText("Unverified", { exact: true }).count() > 0, true);

  await page.getByLabel("Search customers").fill("Bisi");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await page.waitForURL(/search=Bisi/);
  await page.getByText("Bisi Business", { exact: true }).waitFor();
  await page.waitForFunction(() => document.querySelectorAll("tbody tr").length === 1);
  assert.equal(await page.locator("tbody tr").count(), 1);
  assert.equal(requests.some((request) => request.includes("search=Bisi")), true);

  await page.goto(`${origin}/dashboard/users`);
  await page.getByLabel("Filter by account type").selectOption("PROPERTY_DEVELOPER");
  await page.waitForURL(/accountType=PROPERTY_DEVELOPER/);
  await page.waitForFunction(() => document.querySelectorAll("tbody tr").length === 1);
  assert.equal(await page.locator("tbody tr").count(), 1);
  await page.getByLabel("Filter by profile type").selectOption("BUSINESS");
  await page.waitForURL(/profileType=BUSINESS/);
  await page.getByLabel("Sort customers").selectOption("NAME_DESC");
  await page.waitForURL(/sort=NAME_DESC/);
  await page.locator("tbody tr").first().getByText("Bisi Business", { exact: true }).waitFor();

  await page.goto(`${origin}/dashboard/users`);
  await page.getByRole("button", { name: "Next ›" }).click();
  await page.waitForURL(/page=2/);
  await page.waitForFunction(() => document.querySelectorAll("tbody tr").length === 2);
  assert.equal(await page.locator("tbody tr").count(), 2);

  await page.goto(`${origin}/dashboard/users`);
  await page.getByRole("link", { name: "View Ada Multi" }).click();
  await page.getByRole("heading", { name: "Ada Multi" }).waitFor();
  assert.equal(await page.getByRole("link", { name: "Back to users" }).isVisible(), true);
  await page.getByText("Investor", { exact: true }).first().waitFor();
  await page.getByText("Personal", { exact: true }).first().waitFor();
  assert.equal(await page.getByText("REF-ADA234", { exact: true }).count() >= 1, true);
  assert.equal(await page.getByText("Verified Completed Purchases", { exact: true }).isVisible(), true);

  await page.goto(`${origin}/dashboard/users/${ids[1]}`);
  await page.getByRole("heading", { name: "Bisi Business" }).waitFor();
  await page.getByText("Bisi Developments Ltd.", { exact: true }).waitFor();
  await page.getByText("7 Adeola Odeku Street, Lagos, Nigeria", { exact: true }).waitFor();

  await page.goto(`${origin}/dashboard/users/${ids[2]}`);
  await page.getByRole("heading", { name: "Chidi Empty" }).waitFor();
  assert.equal(await page.getByText("No customer listings have been recorded.", { exact: true }).isVisible(), true);
  assert.equal(await page.getByText("No referral links have been generated.", { exact: true }).isVisible(), true);
  assert.equal(await page.getByText("Unverified", { exact: true }).isVisible(), true);

  emptyDirectory = true;
  await page.goto(`${origin}/dashboard/users`);
  await page.getByRole("heading", { name: "No customers yet" }).waitFor();
  await page.getByText("Registered customers will appear here.", { exact: true }).waitFor();
  assert.equal(await page.locator("table").count(), 0);
  assert.equal(await page.getByLabel("Customer activity summary").count(), 0);
  assert.equal(await page.getByRole("search").count(), 0);
  emptyDirectory = false;

  for (const width of [1440, 1280, 1024, 768, 430, 390, 360]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${origin}/dashboard/users`);
    await page.getByRole("heading", { name: "Users", exact: true }).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `whole-page overflow at ${width}`);
    if (width <= 900) {
      const menu = page.getByRole("button", { name: "Open navigation" });
      assert.equal(await menu.isVisible(), true);
      await menu.click();
      assert.equal(await page.locator(".admin-sidebar.is-open").count(), 1);
      await page.getByRole("button", { name: "Close navigation" }).click();
    }
  }

  assert.deepEqual(pageErrors, []);
  await browser.close();
  console.log("Admin Users UI: directory, empty/detail states, shell navigation, actions, queries and responsive widths passed");
} finally {
  server.kill();
}
