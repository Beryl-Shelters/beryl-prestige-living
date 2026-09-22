import assert from "node:assert/strict";
import { runIfMain } from "./run-ui-suite.mjs";

runIfMain(import.meta.url, "public-buy");

const baseProperty = { code: "RES-ABC234", title: "Verified Lagos Home", description: "A real-shaped approved listing description.",
  propertyType: "Residential", propertySubtype: "Bungalow", priceMinor: 8500000000, state: "Lagos", city: "Ikeja",
  bedrooms: 3, bathrooms: 2, parkingSpaces: 1, facilities: ["Wi-Fi"], listedAt: null,
  images: ["https://images.example.test/home.png"], user_id: "SECRET-OWNER", email: "private@example.test", documents: [{ public_id: "secret-document" }] };
export const buyState = { authenticated: false, items: [baseProperty, { ...baseProperty, code: "COM-XYZ789", title: "Commercial Lagos Building", propertyType: "Commercial", propertySubtype: "Semi-Detached House", priceMinor: 12500000000, bedrooms: 0, images: [] }] };

export function buyResponse(url) {
  const params = url.searchParams;
  let items = buyState.items.filter(item => {
    const q = params.get("q")?.toLowerCase();
    return (!q || [item.title,item.code,item.state,item.city].some(value => value.toLowerCase().includes(q)))
      && (!params.get("propertyType") || item.propertyType === params.get("propertyType"))
      && (!params.get("propertySubtype") || item.propertySubtype === params.get("propertySubtype"))
      && (!params.get("state") || item.state === params.get("state"))
      && (!params.get("city") || item.city === params.get("city"))
      && (!params.get("minPrice") || item.priceMinor >= Number(params.get("minPrice")))
      && (!params.get("maxPrice") || item.priceMinor <= Number(params.get("maxPrice")))
      && (!params.get("bedrooms") || item.bedrooms === Number(params.get("bedrooms")))
      && (!params.get("bathrooms") || item.bathrooms === Number(params.get("bathrooms")))
      && (!params.get("bedroomsMin") || item.bedrooms >= Number(params.get("bedroomsMin")))
      && (!params.get("bathroomsMin") || item.bathrooms >= Number(params.get("bathroomsMin")))
      && (!params.get("facility") || item.facilities.includes(params.get("facility")));
  });
  const sort = params.get("sort") || "latest";
  items.sort((a,b) => sort === "price_asc" ? a.priceMinor-b.priceMinor : sort === "price_desc" ? b.priceMinor-a.priceMinor
    : sort === "oldest" ? String(a.listedAt ?? "9999").localeCompare(String(b.listedAt ?? "9999")) || a.code.localeCompare(b.code)
    : String(b.listedAt ?? "").localeCompare(String(a.listedAt ?? "")) || a.code.localeCompare(b.code));
  const page = Number(params.get("page") || 1), pageSize = Number(params.get("pageSize") || 10), total = items.length;
  items = items.slice((page - 1) * pageSize, page * pageSize);
  return { items, page, pageSize, total, totalPages: Math.ceil(total / pageSize) };
}

export async function checkPublicBuy({ page, origin, calls, failures, screenshot, passed }) {
  const properties = () => calls.filter(call => call.endpoint === "/public/properties");
  const events = () => calls.filter(call => call.endpoint === "/public/property-searches");
  for (const width of [1440,1280,768,430,390,360]) {
    await page.setViewportSize({ width, height: 920 });
    await page.goto(origin + "/buy");
    await page.getByRole("heading", { name: "Buy", exact: true }).waitFor();
    await page.getByText("2 Properties found for sale").waitFor();
    await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.locator(".public-nav a.active").innerText(), "Buy");
    assert.equal(await page.locator(".site-footer").count(), 1);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `Buy overflow at ${width}`);
    assert.equal(await page.locator(".buy-property-card").count(), 2);
    assert.equal(await page.getByText("SECRET-OWNER").count(), 0);
    assert.equal(await page.getByText("private@example.test").count(), 0);
    assert.equal(await page.getByText("Agent Assigned").count(), 0);
    if (width <= 430) {
      await page.getByRole("button", { name: "Advanced Filters" }).click();
      const dialog = page.getByRole("dialog", { name: "Advanced Filters" }); await dialog.waitFor();
      assert.equal(await dialog.evaluate(element => element.getBoundingClientRect().right <= innerWidth + 1), true);
      if (width === 390) await screenshot("public-buy-filters-390");
      await dialog.getByRole("button", { name: "Close Advanced Filters" }).click();
    }
    if (width === 1440 || width === 390) { await page.evaluate(() => scrollTo(0, 0)); await screenshot(`public-buy-${width}`); }
  }
  assert.equal(events().length, 0, "Initial/direct Buy loads must not record searches");
  assert.equal(await page.getByText("₦85,000,000").count(), 1);
  assert.equal(await page.getByText("Photo unavailable").count(), 1);
  assert.equal(await page.getByText("Dear Valued Client you are adviced to please visit a property before making a decision.").count(), 1);
  await page.getByRole("button", { name: "Sign Mandate" }).click();
  await page.getByText("No document has been signed.", { exact: false }).waitFor();
  assert.equal(calls.filter(call => call.method !== "GET").length, 0);
  assert.equal(await page.locator(".buy-sidebar label:has-text('Local Government') input[disabled]").count(), 1);
  await page.locator("#buy-q").fill("Verified"); await page.getByRole("button", { name: "Search", exact: true }).click();
  await page.getByText("1 Property found for sale").waitFor();
  assert.equal(new URL(properties().at(-1).url).searchParams.get("q"), "Verified");
  await page.waitForTimeout(100); assert.equal(events().length, 1);
  await page.reload(); await page.getByText("1 Property found for sale").waitFor(); assert.equal(events().length, 1);
  await page.getByRole("button", { name: "Advanced Filters" }).click();
  const dialog = page.getByRole("dialog", { name: "Advanced Filters" });
  await dialog.getByLabel("Property Code").fill("RES-ABC234");
  const beforeConflict = properties().length;
  await dialog.getByRole("button", { name: "Apply Filters" }).click();
  await dialog.getByText("Use either Search properties or Property Code", { exact: false }).waitFor();
  assert.equal(properties().length, beforeConflict);
  await dialog.getByRole("button", { name: "Reset" }).click();
  await page.getByText("2 Properties found for sale").waitFor();
  await page.waitForTimeout(100); assert.equal(events().length, 2);
  await page.getByRole("button", { name: "Advanced Filters" }).click();
  const advanced = page.getByRole("dialog", { name: "Advanced Filters" });
  await advanced.getByLabel("Select Property Type").selectOption("Residential");
  await advanced.getByLabel("State").selectOption("Lagos");
  await advanced.getByLabel("City").fill("Ikeja");
  await advanced.getByPlaceholder("Enter Amount here").fill("85,000,000.00");
  await advanced.getByRole("button", { name: "3", exact: true }).first().click();
  await advanced.getByRole("button", { name: "2", exact: true }).last().click();
  await advanced.getByLabel("Wi-Fi").check();
  await advanced.getByRole("button", { name: "Apply Filters" }).click();
  await page.getByText("1 Property found for sale").waitFor();
  const applied = new URL(properties().at(-1).url).searchParams;
  assert.deepEqual([applied.get("propertyType"),applied.get("state"),applied.get("city"),applied.get("maxPrice"),applied.get("bedrooms"),applied.get("bathrooms"),applied.get("facility")],
    ["Residential","Lagos","Ikeja","8500000000","3","2","Wi-Fi"]);
  await page.waitForTimeout(100); assert.equal(events().length, 3);
  failures.set("/public/properties", { status: 503, code: "UNAVAILABLE" });
  await page.locator("#buy-q").fill("missing"); await page.getByRole("button", { name: "Search", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "temporarily unavailable" }).waitFor();
  assert.equal(events().length, 3); failures.delete("/public/properties");
  await page.getByRole("button", { name: "Try again" }).click();
  await page.getByText("No properties match these filters yet.").waitFor(); assert.equal(events().length, 3);
  await page.getByRole("button", { name: "Clear filters" }).click(); await page.getByText("2 Properties found for sale").waitFor();
  await page.getByRole("button", { name: "Advanced Filters" }).click();
  await page.getByRole("dialog", { name: "Advanced Filters" }).getByLabel("Property Code").fill("RES-ABC234");
  await page.getByRole("dialog", { name: "Advanced Filters" }).getByRole("button", { name: "Apply Filters" }).click();
  await page.getByText("1 Property found for sale").waitFor();
  assert.equal(new URL(properties().at(-1).url).searchParams.get("q"), "RES-ABC234");
  await page.getByRole("button", { name: "Advanced Filters" }).click();
  await page.getByRole("dialog", { name: "Advanced Filters" }).getByRole("button", { name: "Reset" }).click();
  await page.getByText("2 Properties found for sale").waitFor();
  failures.set("/public/property-searches", { status: 503, code: "SEARCH_TRACKING_UNAVAILABLE" });
  const beforeFailedTracking = events().length;
  await page.getByRole("button", { name: "Bungalow", exact: true }).click();
  await page.getByText("1 Property found for sale").waitFor();
  await page.waitForTimeout(100);
  assert.equal(events().length, beforeFailedTracking + 1);
  assert.equal(new URL(properties().at(-1).url).searchParams.get("propertySubtype"), "Bungalow");
  assert.equal(await page.locator(".buy-property-card").count(), 1);
  failures.delete("/public/property-searches");
  buyState.items = Array.from({ length: 12 }, (_, index) => ({ ...baseProperty, code: `RES-TEST${index}`, title: `Listing ${index}` }));
  await page.goto(origin + "/buy"); await page.getByText("12 Properties found for sale").waitFor();
  const beforePage = events().length; await page.getByRole("button", { name: "Next page" }).click();
  await page.getByText("Page 2 of 2").waitFor(); assert.equal(await page.locator(".buy-property-card").count(), 2); assert.equal(events().length, beforePage);
  await page.goto(origin + "/buy?mode=refer&q=Listing&location=Lagos&propertyType=Residential&budget=100000000&bedrooms=3");
  await page.getByText("12 Properties found for sale").waitFor();
  await page.getByText("“Lagos” is not an available location filter yet", { exact: false }).waitFor();
  assert.equal(new URL(page.url()).searchParams.get("location"), "Lagos");
  const landing = new URL(properties().at(-1).url).searchParams;
  assert.deepEqual([landing.get("q"),landing.get("state"),landing.get("city"),landing.get("location"),landing.get("propertyType"),landing.get("maxPrice"),landing.get("bedrooms"),landing.get("mode")],
    ["Listing",null,null,null,"Residential","10000000000","3",null]);
  assert.equal(events().length, beforePage);
  await page.goto(origin + "/buy?location=Abuja"); await page.getByText("not an available location filter yet", { exact: false }).waitFor();
  await page.getByText("12 Properties found for sale").waitFor();
  assert.deepEqual(["q","state","city","location"].map(key => new URL(properties().at(-1).url).searchParams.get(key)), [null,null,null,null]);
  assert.equal(events().length, beforePage);
  assert.equal(await page.locator('.buy-referral a[href="/referrals"]').count() > 0, true);
  assert.equal(await page.locator('.buy-property-card a:has-text("Copy Referral Link")').count(), 10);
  assert.equal(await page.locator('.buy-property-card a:has-text("Copy Referral Link")').first().getAttribute("href"), "/login?next=%2Fbuy%3Fcode%3DRES-TEST0");
  assert.equal(calls.filter(call => call.endpoint === "/dashboard/referrals/public-property").length, 0);
  buyState.authenticated = true; await page.reload(); await page.getByRole("button", { name: "Toggle navigation" }).click();
  await page.locator(".public-account-trigger").waitFor();
  await page.locator(".public-account-trigger").click();
  for (const label of ["My Dashboard","List Property","Referrals"]) assert.equal(await page.locator(".public-account-dropdown").getByRole("link", { name: label }).count(), 1);
  for (const label of ["Saved Property","Compare Property","Mortgage Calculator"]) assert.equal(await page.locator(".public-account-dropdown").getByText(label, { exact: false }).count(), 1);
  assert.equal(await page.locator('.buy-property-card button:has-text("Copy Referral Link")').count(), 10);
  assert.equal(calls.filter(call => call.endpoint === "/dashboard/referrals/public-property").length, 0);
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"], { origin });
  await page.locator('.buy-property-card button:has-text("Copy Referral Link")').first().click();
  await page.getByText("Referral link copied to clipboard", { exact: true }).waitFor();
  const copied = calls.filter(call => call.endpoint === "/dashboard/referrals/public-property");
  assert.equal(copied.length, 1); assert.deepEqual(copied[0].body, { propertyCode: "RES-TEST0" });
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), `${origin}/buy?code=RES-TEST0&ref=REF-N4K7P9`);
  buyState.items = [
    { ...baseProperty, code: "RES-A11111", title: "Older home", listedAt: "2025-01-01T00:00:00Z", priceMinor: 200, bedrooms: 7, bathrooms: 7, propertySubtype: "Block of flats", state: "Rivers", facilities: ["Tennis Court", "Children Play Area"] },
    { ...baseProperty, code: "RES-B22222", title: "Newer home", listedAt: "2026-01-01T00:00:00Z", priceMinor: 300, bedrooms: 8, bathrooms: 9, propertySubtype: "Detached Duplexes", state: "Rivers", facilities: ["Basketball Court"] },
    { ...baseProperty, code: "RES-C33333", title: "Legacy home", listedAt: null, priceMinor: 100, bedrooms: 3, bathrooms: 2, propertySubtype: "Bungalow", state: "Federal Capital Territory (FCT)" },
  ];
  await page.setViewportSize({ width: 1440, height: 920 }); await page.goto(origin + "/buy");
  await page.getByText("3 Properties found for sale").waitFor();
  const codes = () => page.locator(".buy-card-bottom > span").allTextContents();
  assert.deepEqual(await codes(), ["Property Code: RES-B22222", "Property Code: RES-A11111", "Property Code: RES-C33333"]);
  const stateOptions = await page.locator(".buy-sidebar label:has-text('State') select option").allTextContents();
  assert.equal(stateOptions.length, 38); assert(stateOptions.includes("Federal Capital Territory (FCT)"));
  assert.equal(await page.locator(".buy-quick-chips button:disabled").count(), 0);
  for (const facility of ["Children Play Area", "Tennis Court", "Basketball Court"]) assert.equal(await page.locator(".buy-sidebar").getByLabel(facility, { exact: true }).isEnabled(), true);
  for (const [sort, expected] of [["oldest",["RES-A11111","RES-B22222","RES-C33333"]],["price_asc",["RES-C33333","RES-A11111","RES-B22222"]],["price_desc",["RES-B22222","RES-A11111","RES-C33333"]],["latest",["RES-B22222","RES-A11111","RES-C33333"]]]) {
    const before = events().length;
    await page.getByRole("combobox", { name: "Sort properties" }).selectOption(sort);
    await page.waitForURL(url => url.searchParams.get("sort") === sort);
    await page.waitForFunction(expectedCodes => [...document.querySelectorAll(".buy-card-bottom > span")].map(element => element.textContent?.replace("Property Code: ", "")).join(",") === expectedCodes.join(","), expected);
    assert.equal(new URL(properties().at(-1).url).searchParams.get("sort"), sort);
    await page.waitForTimeout(100); assert.equal(events().length, before + 1);
  }
  const beforeDirect = events().length; await page.reload(); await page.getByText("3 Properties found for sale").waitFor(); assert.equal(events().length, beforeDirect);
  await page.getByRole("button", { name: "7+ Bedrooms" }).click(); await page.getByText("2 Properties found for sale").waitFor();
  assert.equal(new URL(properties().at(-1).url).searchParams.get("bedroomsMin"), "7");
  assert.equal(new URL(properties().at(-1).url).searchParams.has("bedrooms"), false);
  await page.locator(".buy-sidebar").getByRole("button", { name: "7+" }).last().click();
  await page.locator(".buy-sidebar").getByLabel("State").selectOption("Rivers");
  await page.locator(".buy-sidebar").getByLabel("Tennis Court", { exact: true }).check();
  await page.locator(".buy-sidebar").getByRole("button", { name: "Apply Filters" }).click();
  await page.getByText("1 Property found for sale").waitFor();
  const seven = new URL(properties().at(-1).url).searchParams;
  assert.deepEqual([seven.get("bedroomsMin"), seven.get("bathroomsMin"), seven.get("state"), seven.get("facility"), seven.get("sort")], ["7","7","Rivers","Tennis Court","latest"]);
  assert.equal(await page.locator(".buy-sidebar label:has-text('Local Government') input[disabled]").count(), 1);
  const subtypeResponse = page.waitForResponse(response => response.url().includes("/api/v1/public/properties?") && new URL(response.url()).searchParams.get("propertySubtype") === "Block of flats");
  await page.getByRole("button", { name: "Block of flats", exact: true }).click();
  await subtypeResponse;
  await page.getByText("1 Property found for sale").waitFor();
  assert.equal(new URL(properties().at(-1).url).searchParams.get("propertySubtype"), "Block of flats");
  buyState.items = Array.from({ length: 12 }, (_, index) => ({ ...baseProperty, code: `RES-PAGE${index}`, title: `River home ${index}`, propertySubtype: "Block of flats", state: "Rivers", bedrooms: 7, bathrooms: 8, facilities: ["Tennis Court"], priceMinor: index + 1 }));
  await page.goto(origin + "/buy?sort=price_asc&state=Rivers&propertySubtype=Block%20of%20flats&bedrooms=7%2B&bathrooms=7%2B&facility=Tennis%20Court");
  await page.getByText("12 Properties found for sale").waitFor();
  const beforePagination = events().length;
  await page.getByRole("button", { name: "Next page" }).click(); await page.getByText("Page 2 of 2").waitFor();
  const preserved = new URL(properties().at(-1).url).searchParams;
  assert.deepEqual(["sort","state","propertySubtype","bedroomsMin","bathroomsMin","facility","page"].map(key => preserved.get(key)), ["price_asc","Rivers","Block of flats","7","7","Tennis Court","2"]);
  assert.equal(events().length, beforePagination);
  passed.push("Buy uses the public results DTO, real count and Naira prices, six responsive widths, neutral missing-image/agent treatments and truthful mandate/referral actions");
  passed.push("Filters, Landing parameters, mobile panel, search-event timing, failures, pagination and authenticated header behave without invented purchase flows");
}
