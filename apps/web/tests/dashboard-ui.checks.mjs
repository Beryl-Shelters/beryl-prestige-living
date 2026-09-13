import assert from "node:assert/strict";
import { runIfMain } from "./run-ui-suite.mjs";
runIfMain(import.meta.url, "dashboard");

// Synthetic browser-only customer. No test identity or metric is shipped in UI.
export const dashboardFixture = {
  customer: { id: "browser-test-customer", first_name: "Ada", last_name: "Okafor", account_type: "PROPERTY_DEVELOPER", profile_type: "PERSONAL" },
  summary: { total_investments: 0, properties_owned: 0, referral_earnings: 0, new_messages: 0 },
  revenue: { monthly: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].map(label => ({ label, amount: 0 })), yearly: [] },
  recent_messages: [], recent_property_listings: [],
};

export async function checkDashboard({ page, origin, calls, failures, screenshot, passed, pauseRequest, resume, toast }) {
  const endpoint = "/dashboard/overview";
  const sections = ["Overview", "Listings", "Analytics", "Messages", "Properties", "Referrals", "Settings"];
  const ready = () => page.locator(".dashboard-greeting").waitFor();
  const open = async (path = "/dashboard") => { await page.goto(origin + path); await ready(); await page.evaluate(() => document.fonts.ready); };
  for (const width of [1440, 1280, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 }); await open();
    assert.equal(await page.locator(".dashboard-kpi").count(), 4);
    assert.deepEqual(await page.locator(".dashboard-kpi h2").allTextContents(), ["Total Investments", "Properties Owned", "Referral Earnings", "New Messages"]);
    assert.deepEqual(await page.locator(".dashboard-kpi p").allTextContents(), ["₦0.00", "0 Units", "₦0.00", "0 messages"]);
    const expected = await page.evaluate(() => { const hour = new Date().getHours(); return hour < 12 ? "Good Morning" : hour < 18 ? "Good Afternoon" : "Good Evening"; });
    assert.equal(await page.locator(".dashboard-greeting").innerText(), `${expected}, Ada Okafor!`);
    assert.equal(await page.locator("header, footer").count(), 0);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `Overflow at ${width}`);
    await page.getByText("No messages", { exact: true }).waitFor();
    await page.getByText("No properties listed", { exact: true }).waitFor();
    await screenshot(`dashboard-${width}`);
    if (width <= 800) {
      await page.getByRole("button", { name: "Menu", exact: true }).click();
      await page.getByRole("dialog", { name: "Dashboard navigation", exact: true }).waitFor();
      await screenshot(`dashboard-drawer-${width}`);
    } else {
      assert.equal(await page.locator(".dashboard-sidebar").evaluate(el => getComputedStyle(el).position), "fixed");
      const sidebar = await page.locator(".dashboard-sidebar").boundingBox();
      assert.equal(sidebar.height, 900); assert.equal(sidebar.width, width > 1100 ? 260 : 220);
      assert.equal(await page.locator(".dashboard-sidebar").evaluate(el => getComputedStyle(el).backgroundColor), "rgb(255, 255, 255)");
    }
    assert.deepEqual(await page.locator(".dashboard-navigation > *").allTextContents(), [...sections, "Log Out", "Back Home"]);
    assert.equal(await page.locator('.dashboard-navigation [aria-current="page"]').innerText(), "Overview");
    assert.equal(await page.locator(".dashboard-identity strong").innerText(), "Ada Okafor");
    assert.equal(await page.locator(".dashboard-identity > div > span").innerText(), "Property Developer");
    assert.equal(await page.locator(".dashboard-avatar").innerText(), "AO");
    assert.equal(await page.locator(".dashboard-brand .brand-name").innerText(), "Beryl Shelter");
    if (width <= 800) {
      await page.keyboard.press("Escape");
      assert.equal(await page.getByRole("dialog").count(), 0);
      assert(await page.getByRole("button", { name: "Menu", exact: true }).evaluate(el => el === document.activeElement));
    }
    console.log(`Dashboard layout checks passed at ${width}px`);
  }
  passed.push("Dashboard reference structure, dynamic identity, four zero KPIs, exact empty states, sidebar and drawer at 1440/1280/1024/768/390/320px");
  await page.setViewportSize({ width: 1440, height: 900 }); await open();
  assert.equal(await page.getByRole("button", { name: "Monthly", exact: true }).getAttribute("aria-pressed"), "true");
  assert.deepEqual(await page.locator(".revenue-labels span").allTextContents(), dashboardFixture.revenue.monthly.map(p => p.label.toUpperCase()));
  const coordinates = await page.locator(".revenue-plot polyline").getAttribute("points");
  assert(coordinates.split(" ").every(point => point.split(",")[1] === "100"), "Zero baseline must not invent a curve");
  await page.getByRole("button", { name: "Yearly", exact: true }).click();
  assert.equal(await page.getByRole("button", { name: "Yearly", exact: true }).getAttribute("aria-pressed"), "true");
  assert.equal(await page.locator(".revenue-labels span").count(), 0);
  assert.equal(await page.locator(".revenue-heading strong").innerText(), "₦0");
  await page.getByRole("button", { name: "Monthly", exact: true }).click();
  await page.getByRole("link", { name: "View Messages", exact: true }).click();
  await page.waitForURL("**/dashboard/messages");
  for (const name of sections.slice(1)) {
    await page.getByRole("link", { name, exact: true }).click();
    await page.getByRole("heading", { name: name === "Listings" ? "My Listings" : name === "Messages" ? "My Tickets" : name === "Properties" ? "Purchased Properties" : name, exact: true }).waitFor();
    assert.equal(await page.locator('.dashboard-navigation [aria-current="page"]').innerText(), name);
    if (name === "Listings") await page.getByText("No listings.", {exact:true}).waitFor();
    else if (name === "Analytics") await page.getByRole("heading", {name:"Category Performance",exact:true}).waitFor();
    else if (name === "Messages") await page.getByText("No messages found.", {exact:true}).waitFor();
    else if (name === "Properties") await page.getByText("No purchases made yet.", {exact:true}).waitFor();
    else assert.equal(await page.locator(".dashboard-placeholder p").innerText(), "Coming later in this rebuild");
  }
  const logouts = () => calls.filter(call => call.endpoint === "/logout").length;
  const beforeHome = logouts();
  await page.getByRole("link", { name: "Back Home", exact: true }).click();
  await page.waitForURL(origin + "/"); assert.equal(logouts(), beforeHome);
  await open("/account"); await page.waitForURL("**/dashboard");
  await page.getByRole("button", { name: "Log Out", exact: true }).click();
  await page.waitForURL("**/login"); assert.equal(logouts(), beforeHome + 1);
  passed.push("Zero-safe Monthly/Yearly chart; Listings/Analytics/Messages/Properties and two placeholder routes with active states; View Messages; Back Home without logout; /account alias; real logout endpoint");

  const observed = pauseRequest(endpoint);
  await page.goto(origin + "/dashboard"); await observed;
  await page.locator(".brand-loader").waitFor();
  assert.equal(await page.locator(".brand-loader").innerText(), "Beryl Shelter");
  assert.equal(await page.locator(".dashboard-sidebar, .dashboard-kpi").count(), 0);
  resume(); await ready();
  failures.set(endpoint, { status: 401, code: "SESSION_EXPIRED", message: "Please log in again." });
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await page.waitForURL("**/login");
  for (const path of ["/dashboard", ...sections.slice(1).map(name => `/dashboard/${name.toLowerCase()}`)]) {
    await page.goto(origin + path); await page.waitForURL("**/login");
    assert.equal(await page.locator(".dashboard-sidebar, .dashboard-kpi").count(), 0);
  }
  failures.set(endpoint, { status: 503, code: "DASHBOARD_UNAVAILABLE", message: "Dashboard is temporarily unavailable. Please try again." });
  await page.goto(origin + "/dashboard");
  await toast("Dashboard is temporarily unavailable. Please try again.");
  assert.equal(await page.locator(".dashboard-kpi").count(), 0);
  failures.delete(endpoint);
  await page.getByRole("button", { name: "Try again", exact: true }).click(); await ready();
  passed.push("Logo-only dashboard loading without content flash; session-expiry recheck; all dashboard routes reject anonymous sessions; fetch errors toast with working retry");
}
