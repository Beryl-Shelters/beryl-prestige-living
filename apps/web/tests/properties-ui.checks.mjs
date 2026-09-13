import assert from "node:assert/strict";
import { runIfMain } from "./run-ui-suite.mjs";
runIfMain(import.meta.url, "properties");

export const propertiesState = { items: [] };
const populated = Array.from({ length: 11 }, (_, index) => ({
  id: `purchase-${index + 1}`, propertyTitle: index === 0 ? "Ocean View Apartment" : `Purchased Home ${index + 1}`,
  propertyCode: `RES-BUY${String(index + 1).padStart(2, "0")}`, state: index % 2 ? "Abuja" : "Lagos",
  type: "Residential", subtype: index % 2 ? "Duplex" : "Apartment", price: `₦${(50000000 + index * 1000000).toLocaleString()}.00`,
  status: "Completed", closedAt: `${index + 1} Sep 2026`,
}));

export function propertiesResponse(url) {
  const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
  const page = Number(url.searchParams.get("page") ?? 1); const pageSize = 10;
  const matches = propertiesState.items.filter(item => [item.propertyTitle, item.propertyCode, item.state].some(value => value.toLowerCase().includes(q)));
  return { items: matches.slice((page - 1) * pageSize, page * pageSize), page, pageSize, total: matches.length, totalPages: matches.length ? Math.ceil(matches.length / pageSize) : 0 };
}

export async function checkProperties({ page, origin, calls, failures, screenshot, passed, pauseRequest, resume, toast }) {
  const endpoint = "/dashboard/properties";
  const ready = () => page.locator(".properties-table").waitFor();
  const open = async () => { await page.goto(origin + endpoint); await ready(); await page.evaluate(() => document.fonts.ready); };
  for (const width of [1440, 1280, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 }); propertiesState.items = []; await open();
    await page.getByRole("heading", { name: "Purchased Properties", exact: true }).waitFor();
    assert.equal(await page.getByRole("textbox", { name: "Search by Title, Code, State...", exact: true }).getAttribute("placeholder"), "Search by Title, Code, State...");
    assert.deepEqual(await page.locator(".properties-table th").allTextContents(), ["Property", "State", "Type", "Subtype", "Price", "Status", "Closed At"]);
    await page.getByText("No purchases made yet.", { exact: true }).waitFor();
    assert.equal(await page.locator(".properties-count").innerText(), "Displaying 1-0 of 0 Properties");
    assert.equal(await page.locator('.dashboard-navigation [aria-current="page"]').innerText(), "Properties");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `Properties overflow at ${width}`);
    await screenshot(`${width}-properties-zero`);
    propertiesState.items = structuredClone(populated); await open();
    assert.equal(await page.locator(".properties-table tbody tr").count(), 10);
    assert.deepEqual(await page.locator(".properties-table tbody tr").first().locator("td").allTextContents(), ["Ocean View ApartmentRES-BUY01", "Lagos", "Residential", "Apartment", "₦50,000,000.00", "Completed", "1 Sep 2026"]);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    const scroll = await page.locator(".properties-table-scroll").evaluate(el => ({ client: el.clientWidth, scroll: el.scrollWidth }));
    assert(width > 800 || scroll.scroll > scroll.client, `Table must retain all columns inside a scroll region at ${width}`);
    await screenshot(`${width}-properties-populated`);
  }
  await page.setViewportSize({ width: 1440, height: 900 }); await open();
  await page.getByRole("button", { name: "Next page", exact: true }).click();
  await page.getByText("Purchased Home 11", { exact: true }).waitFor();
  assert.equal(await page.locator(".properties-count").innerText(), "Displaying 11-11 of 11 Properties");
  assert.equal(new URL(calls.filter(call => call.endpoint === endpoint).at(-1).url).searchParams.get("page"), "2");
  const search = page.getByRole("textbox", { name: "Search by Title, Code, State...", exact: true });
  await search.fill("  ocean  "); await search.press("Enter"); await page.getByText("Ocean View Apartment", { exact: true }).waitFor();
  assert.equal(new URL(calls.filter(call => call.endpoint === endpoint).at(-1).url).searchParams.get("q"), "ocean");
  const observed = pauseRequest(endpoint); await page.goto(origin + endpoint); await observed;
  await page.locator(".properties-page .brand-loader").waitFor(); assert.equal(await page.locator(".properties-table").count(), 0); resume(); await ready();
  failures.set(endpoint, { status: 503, code: "PROPERTIES_UNAVAILABLE", message: "Purchased properties are temporarily unavailable. Please try again." });
  await page.goto(origin + endpoint); await toast("Purchased properties are temporarily unavailable. Please try again.");
  failures.delete(endpoint); await page.getByRole("button", { name: "Try again", exact: true }).click(); await ready();
  failures.set(endpoint, { status: 401, code: "SESSION_EXPIRED", message: "Please log in again." });
  await page.goto(origin + endpoint); await page.waitForURL("**/login"); failures.delete(endpoint);
  propertiesState.items = [];
  passed.push("Purchased Properties: exact empty copy and seven-column contract; existing palette at six widths; contained mobile table scroll; pagination; title/code/state search; active sidebar; loading, retry and session expiry");
}
