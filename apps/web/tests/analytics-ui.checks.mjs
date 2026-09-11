import assert from "node:assert/strict";
import { runIfMain } from "./run-ui-suite.mjs";
runIfMain(import.meta.url, "analytics");

// Synthetic listing records are test-only, never shipped in production.
export const analyticsState = { items: [] };
const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const populated = ["UNLISTED", "LISTED", "PENDING", "REJECTED", "LISTED", "PENDING", "UNLISTED", "PENDING"].map((status, index) => ({
  title: index === 1 ? "Beta Villa" : `Alpha Home ${index}`, code: `RES-TEST0${index}`, status,
  bedrooms: index === 6 ? 0 : index === 7 ? 7 : index + 1,
  propertyType: [2, 4, 7].includes(index) ? "Commercial" : "Residential",
}));
export function analyticsResponse(url) {
  const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
  const items = analyticsState.items.filter(item => [item.title, item.code].some(value => value.toLowerCase().includes(q)));
  const metric = status => { const count = items.filter(item => item.status === status).length; return { count, percentage: items.length ? Math.round(count / items.length * 10000) / 100 : 0 }; };
  return {
    year: Number(url.searchParams.get("year") ?? new Date().getUTCFullYear()),
    categoryPerformance: months.map((label, index) => ({ month: index + 1, label, buy: 0, sell: 0, referral: 0 })),
    listingsOverview: { total: items.length, listed: metric("LISTED"), pending: metric("PENDING"), rejected: metric("REJECTED") },
    bedrooms: Object.fromEntries([1, 2, 3, 4, 5, 6].map(bedroom => [bedroom, items.filter(item => item.bedrooms === bedroom).length])),
    propertyTypes: { commercial: items.filter(item => item.propertyType === "Commercial").length, detachedHouses: 0, flats: 0, others: 0, residential: items.filter(item => item.propertyType === "Residential").length },
  };
}

export async function checkAnalytics({ page, origin, calls, failures, screenshot, passed, pauseRequest, resume, toast }) {
  const endpoint = "/dashboard/analytics";
  const ready = () => page.locator(".analytics-total strong").waitFor();
  const open = async () => { await page.goto(origin + "/dashboard/analytics"); await ready(); await page.evaluate(() => document.fonts.ready); };
  const search = page.getByRole("textbox", { name: "Search your listings by title or code", exact: true });
  const total = () => page.locator(".analytics-total strong").innerText();
  const waitTotal = count => page.waitForFunction(value => document.querySelector(".analytics-total strong")?.textContent === String(value), count);
  const assertChart = async () => {
    assert.deepEqual(await page.locator(".analytics-months span").allTextContents(), months);
    assert.deepEqual(await page.locator(".analytics-legend li").allTextContents(), ["Buy", "Sell", "Referral"]);
    assert.deepEqual(await page.locator(".analytics-axis span").allTextContents(), ["2", "1.5", "1", "0.5", "0"]);
    assert.equal(await page.locator(".analytics-gridline").count(), 5);
    assert.equal(await page.locator(".analytics-plot polyline").count(), 0, "Zero performance must not invent a curve");
    assert.match(await page.locator(".analytics-chart figcaption").innerText(), /Jan: Buy 0, Sell 0, Referral 0/);
  };
  for (const width of [1440, 1280, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 }); analyticsState.items = []; await open();
    assert.equal(await total(), "0");
    assert.equal(await search.getAttribute("placeholder"), "Search your listings by title or code");
    assert.deepEqual(await page.locator(".analytics-status progress").evaluateAll(elements => elements.map(el => el.value)), [0, 0, 0]);
    assert.deepEqual(await page.locator(".analytics-bedrooms dt").allTextContents(), [1, 2, 3, 4, 5, 6].map(value => `${value} bedroom(s)`));
    assert.deepEqual(await page.locator(".analytics-property-types dt").allTextContents(), ["Commercial(s)", "Detached Houses(s)", "Flats(s)", "Others(s)", "Residential(s)"]);
    assert((await page.locator(".analytics-breakdown dd").allTextContents()).every(value => value === "0")); await assertChart();
    const layout = await page.evaluate(() => {
      const rect = selector => document.querySelector(selector).getBoundingClientRect().toJSON();
      return { overflow: document.documentElement.scrollWidth > innerWidth, chart: rect(".analytics-performance"), overview: rect(".analytics-overview"), bedrooms: rect(".analytics-breakdown"), types: rect(".analytics-breakdown:last-child"),
        background: getComputedStyle(document.querySelector(".dashboard-card")).backgroundColor, gold: getComputedStyle(document.querySelector(".analytics-search button")).backgroundColor, font: getComputedStyle(document.body).fontFamily };
    });
    assert.equal(layout.overflow, false, `Analytics overflow at ${width}`);
    assert.equal(layout.background, "rgb(255, 255, 255)"); assert.equal(layout.gold, "rgb(183, 134, 75)"); assert.match(layout.font, /jakarta/i);
    assert(width > 1000 ? layout.overview.left >= layout.chart.right : layout.overview.top >= layout.chart.bottom);
    assert(width > 600 ? layout.types.left >= layout.bedrooms.right : layout.types.top >= layout.bedrooms.bottom);
    await screenshot(`${width}-analytics-zero`);
    analyticsState.items = structuredClone(populated); await open(); assert.equal(await total(), "8");
    assert.deepEqual(await page.locator(".analytics-status progress").evaluateAll(elements => elements.map(el => el.value)), [25, 37.5, 12.5]);
    assert.deepEqual(await page.locator(".analytics-bedrooms dd").allTextContents(), Array(6).fill("1"));
    assert.deepEqual(await page.locator(".analytics-property-types dd").allTextContents(), ["3", "0", "0", "0", "5"]);
    assert.equal(await page.locator(".analytics-status").count(), 3); await assertChart();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await screenshot(`${width}-analytics-populated`); console.log(`Analytics zero/populated layouts passed at ${width}px`);
  }
  await page.setViewportSize({ width: 1440, height: 900 }); await open();
  assert.equal(await page.locator('.dashboard-navigation [aria-current="page"]').innerText(), "Analytics");
  const beforeTyping = calls.filter(call => call.endpoint === endpoint).length;
  await search.fill("  bEtA  "); assert.equal(calls.filter(call => call.endpoint === endpoint).length, beforeTyping, "Typing alone must not submit search");
  await page.getByRole("button", { name: "Search", exact: true }).click(); await waitTotal(1);
  assert.equal(new URL(calls.filter(call => call.endpoint === endpoint).at(-1).url).searchParams.get("q"), "bEtA");
  assert.deepEqual(await page.locator(".analytics-bedrooms dd").allTextContents(), ["0", "1", "0", "0", "0", "0"]);
  await search.fill("res-test02"); await search.press("Enter");
  await page.waitForFunction(() => document.querySelector(".analytics-property-types dd")?.textContent === "1");
  await search.fill("No matching listing"); await search.press("Enter"); await waitTotal(0);
  await search.fill("   "); await search.press("Enter"); await waitTotal(8);
  const currentYear = Number(new URL(calls.filter(call => call.endpoint === endpoint).at(-1).url).searchParams.get("year"));
  await page.getByRole("button", { name: "Previous year", exact: true }).click();
  await page.getByText(`Jan 1 - Dec 31, ${currentYear - 1}`, { exact: true }).waitFor(); await assertChart();
  await page.getByRole("button", { name: "Next year", exact: true }).click();
  await page.getByText(`Jan 1 - Dec 31, ${currentYear}`, { exact: true }).waitFor(); await assertChart();
  assert.equal(await total(), "8", "Year controls affect category performance, not listing totals");
  const observed = pauseRequest(endpoint); await page.goto(origin + "/dashboard/analytics"); await observed;
  await page.locator(".analytics-page .brand-loader").waitFor(); assert.equal(await page.locator(".analytics-results").count(), 0, "No invented analytics while loading"); resume(); await ready();
  failures.set(endpoint, { status: 503, code: "ANALYTICS_UNAVAILABLE", message: "Analytics is temporarily unavailable. Please try again." });
  await page.goto(origin + "/dashboard/analytics"); await toast("Analytics is temporarily unavailable. Please try again.");
  assert.equal(await page.locator(".analytics-results").count(), 0, "Errors must not become successful zeros");
  failures.delete(endpoint); await page.getByRole("button", { name: "Try again", exact: true }).click(); await waitTotal(8);
  failures.set(endpoint, { status: 401, code: "SESSION_EXPIRED", message: "Please log in again." });
  await page.goto(origin + "/dashboard/analytics"); await page.waitForURL("**/login"); failures.delete(endpoint);
  passed.push("Analytics: reference layout and existing palette at six widths; zero and listing-derived populated counts; title/code search by button/Enter; blank reset; twelve zero performance months; year arrows; active sidebar; loading without data flash; safe error/retry and session expiry");
  analyticsState.items = [];
}
