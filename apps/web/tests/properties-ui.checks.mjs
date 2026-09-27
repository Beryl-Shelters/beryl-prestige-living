import assert from "node:assert/strict";
import { runIfMain } from "./run-ui-suite.mjs";
runIfMain(import.meta.url, "properties");

export const propertiesState = { items: [] };
const populated = Array.from({ length: 11 }, (_, index) => ({
  propertyCode: `RES-BUY${String(index + 1).padStart(2, "0")}`,
  title: index === 0 ? "Ocean View Apartment" : `Purchased Home ${index + 1}`,
  state: index % 2 ? "Federal Capital Territory (FCT)" : "Lagos",
  propertyType: index === 2 ? "Commercial" : "Residential",
  propertySubtype: index === 1 ? null : index % 2 ? "Detached Duplexes" : "Block of flats",
  priceMinor: 5_000_000_001 + index * 100_000_000,
  closedAt: new Date(Date.UTC(2026, 8, 12 + index, 14, 30)).toISOString(),
}));

export function propertiesResponse(url) {
  const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
  const page = Number(url.searchParams.get("page") ?? 1);
  const pageSize = 10;
  const matches = propertiesState.items.filter(item => [item.title, item.propertyCode, item.state].some(value => value.toLowerCase().includes(q)));
  return {
    items: matches.slice((page - 1) * pageSize, page * pageSize),
    page, pageSize, total: matches.length,
    totalPages: matches.length ? Math.ceil(matches.length / pageSize) : 0,
  };
}

export async function checkProperties({ page, origin, calls, failures, screenshot, passed, pauseRequest, resume, toast }) {
  const endpoint = "/dashboard/properties";
  const waitForResult = () => page.locator(".properties-table, .properties-zero-state, .properties-request-state").first().waitFor();
  const open = async () => {
    await page.goto(origin + endpoint);
    await waitForResult();
    await page.evaluate(() => document.fonts.ready);
  };

  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    propertiesState.items = [];
    await open();
    await page.getByRole("heading", { name: "Purchased Properties", exact: true }).waitFor();
    await page.getByRole("heading", { name: "No purchased properties yet", exact: true }).waitFor();
    await page.getByText("Purchased properties will appear here", { exact: true }).waitFor();
    const emptyCta = page.getByRole("link", { name: "View Properties for sale", exact: true });
    assert.equal(await emptyCta.getAttribute("href"), "/buy");
    assert.equal(await page.locator(".properties-header form").count(), 0, "True empty state should not show a redundant search");
    assert.equal(await page.locator('.dashboard-navigation [aria-current="page"]').innerText(), "Properties");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `Empty state overflows at ${width}`);
    await screenshot(`${width}-properties-zero`);

    propertiesState.items = structuredClone(populated);
    await open();
    const search = page.getByRole("textbox", { name: "Search by Title, Code, State...", exact: true });
    assert.equal(await search.getAttribute("placeholder"), "Search by Title, Code, State...");
    assert.deepEqual(await page.locator(".properties-table th").allTextContents(), ["Property", "State", "Type", "Subtype", "Price", "Status", "Closed At"]);
    assert.equal(await page.locator(".properties-table tbody tr").count(), 10);
    const firstCells = await page.locator(".properties-table tbody tr").first().locator("td").allTextContents();
    assert.deepEqual(firstCells, ["Ocean View ApartmentRES-BUY01", "Lagos", "Residential", "Block of flats", "₦50,000,000.01", "Approved", "12 Sept 2026"]);
    assert.equal(await page.locator(".properties-image-placeholder").count(), 10, "Every purchase without persisted media needs a placeholder");
    assert.equal(await page.getByText("—", { exact: true }).count(), 1, "Null subtype must use an em dash");
    assert.equal(await page.locator(".properties-count").innerText(), "Showing 1-10 of 11");
    assert.equal(await page.getByRole("button", { name: "Previous page", exact: true }).isDisabled(), true);
    assert.equal(await page.getByRole("button", { name: "Next page", exact: true }).isDisabled(), false);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `Populated state overflows at ${width}`);
    const scroll = await page.locator(".properties-table-scroll").evaluate(el => ({ client: el.clientWidth, scroll: el.scrollWidth, tabIndex: el.tabIndex }));
    assert.equal(scroll.tabIndex, 0, "Scrollable table region must be keyboard accessible");
    if (width <= 768) assert(scroll.scroll > scroll.client, `Table must scroll locally at ${width}`);
    if (width <= 768) await page.getByText("Page 1 of 2", { exact: true }).waitFor();
    await screenshot(`${width}-properties-populated`);
  }

  await page.setViewportSize({ width: 390, height: 900 });
  propertiesState.items = [];
  await open();
  await page.getByRole("link", { name: "View Properties for sale", exact: true }).click();
  await page.waitForURL(url => url.pathname === "/buy");
  assert.equal(await page.locator(".assistance-decision-dialog").count(), 0, "Dashboard CTA must not trigger Buy Assistance");

  await page.setViewportSize({ width: 1440, height: 900 });
  propertiesState.items = structuredClone(populated);
  await open();
  const previous = page.getByRole("button", { name: "Previous page", exact: true });
  const next = page.getByRole("button", { name: "Next page", exact: true });
  assert.equal(await previous.isDisabled(), true);
  await next.click();
  await page.getByText("Purchased Home 11", { exact: true }).waitFor();
  assert.equal(await page.locator(".properties-count").innerText(), "Showing 11-11 of 11");
  assert.equal(await previous.isDisabled(), false);
  assert.equal(await next.isDisabled(), true);
  assert.equal(new URL(calls.filter(call => call.endpoint === endpoint).at(-1).url).searchParams.get("page"), "2");

  const search = page.getByRole("textbox", { name: "Search by Title, Code, State...", exact: true });
  await search.fill("  ocean  ");
  await search.press("Enter");
  await page.getByText("Ocean View Apartment", { exact: true }).waitFor();
  assert.equal(new URL(calls.filter(call => call.endpoint === endpoint).at(-1).url).searchParams.get("q"), "ocean");
  assert.equal(new URL(calls.filter(call => call.endpoint === endpoint).at(-1).url).searchParams.get("page"), "1");

  await search.fill("RES-BUY02");
  await search.press("Enter");
  await page.getByText("Purchased Home 2", { exact: true }).waitFor();
  await search.fill("federal capital");
  await search.press("Enter");
  await page.locator(".properties-table tbody tr").first().waitFor();
  assert.equal(await page.locator(".properties-table tbody tr").count(), 5);

  await search.fill("no-such-purchase");
  await search.press("Enter");
  await page.getByRole("heading", { name: "No purchased properties matched your search", exact: true }).waitFor();
  assert.equal(await page.getByRole("link", { name: "View Properties for sale", exact: true }).count(), 0, "No-results must not reuse the true-empty CTA");
  await page.getByRole("button", { name: "Clear search", exact: true }).click();
  await page.getByText("Ocean View Apartment", { exact: true }).waitFor();
  assert.equal(await search.inputValue(), "");

  await search.fill("Ocean");
  await search.press("Enter");
  await page.getByText("Ocean View Apartment", { exact: true }).waitFor();
  await search.fill("   ");
  await search.press("Enter");
  await page.locator(".properties-table tbody tr").first().waitFor();
  assert.equal(await page.locator(".properties-table tbody tr").count(), 10, "Blank search must restore the owner-scoped result");

  const observed = pauseRequest(endpoint);
  await page.goto(origin + endpoint);
  await observed;
  await page.locator(".properties-page .brand-loader").waitFor();
  assert.equal(await page.locator(".properties-table").count(), 0);
  resume();
  await page.locator(".properties-table").waitFor();

  failures.set(endpoint, { status: 503, code: "PROPERTIES_UNAVAILABLE", message: "Purchased properties are temporarily unavailable. Please try again." });
  await page.goto(origin + endpoint);
  await toast("Purchased properties are temporarily unavailable. Please try again.");
  await page.getByRole("heading", { name: "Unable to load purchased properties", exact: true }).waitFor();
  failures.delete(endpoint);
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await page.locator(".properties-table").waitFor();

  const readOnlyLabels = [/create purchase/i, /edit purchase/i, /delete purchase/i, /change price/i, /payment/i, /checkout/i, /mortgage/i, /transfer ownership/i];
  for (const label of readOnlyLabels) assert.equal(await page.getByRole("button", { name: label }).count(), 0);
  const propertyCalls = calls.filter(call => call.endpoint === endpoint);
  assert(propertyCalls.length > 0);
  assert(propertyCalls.every(call => call.method === "GET"), "Purchased Properties must issue GET requests only");
  assert.equal(calls.some(call => /payment|checkout|ownership/i.test(call.endpoint)), false, "No purchase, payment or ownership side effects are allowed");

  failures.set(endpoint, { status: 401, code: "SESSION_EXPIRED", message: "Please log in again." });
  await page.goto(origin + endpoint);
  await page.waitForURL("**/login");
  failures.delete(endpoint);
  propertiesState.items = [];
  passed.push("Purchased Properties: true empty and distinct no-results states; direct /buy CTA without assistance; realistic historical DTO; seven-column read-only table; placeholder media; exact minor-unit Naira; closedAt; null subtype; owner-scoped server search and pagination; responsive local scroll at 1440/768/390/320; loading, retry and session expiry");
}
