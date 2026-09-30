import assert from "node:assert/strict";
import { messagesState } from "./messages-ui.checks.mjs";
import { runIfMain } from "./run-ui-suite.mjs";
runIfMain(import.meta.url, "dashboard");

// Synthetic browser-only customer. No test identity or metric is shipped in UI.
export const dashboardFixture = {
  customer: { id: "browser-test-customer", first_name: "Ada", last_name: "Okafor", email: "ada@example.test", account_type: "PROPERTY_DEVELOPER", profile_type: "PERSONAL", profile_image_url: null },
  summary: { total_investments: 0, properties_owned: 0, referral_earnings: 0, new_messages: 0 },
  revenue: { monthly: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].map(label => ({ label, amount: 0 })), yearly: [] },
  recent_messages: [], recent_property_listings: [],
};

export async function checkDashboard({ page, origin, calls, failures, screenshot, passed, pauseRequest, resume, toast }) {
  const endpoint = "/dashboard/overview";
  const sections = ["Overview", "Listings", "Analytics", "Messages", "Properties", "Referrals", "Withdraw Earnings", "Settings"];
  const ready = () => page.locator(".dashboard-greeting").waitFor();
  const open = async (path = "/dashboard") => { await page.goto(origin + path); await ready(); await page.evaluate(() => document.fonts.ready); };
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 }); await open();
    assert.equal(await page.locator(".dashboard-kpi").count(), 4);
    assert.deepEqual(await page.locator(".dashboard-kpi h2").allTextContents(), ["Total Investments", "Properties Owned", "Referral Earnings", "New Messages"]);
    assert.deepEqual(await page.locator(".dashboard-kpi p").allTextContents(), ["₦0.00", "0 Units", "₦0.00", "0 messages"]);
    const expected = await page.evaluate(() => { const hour = new Date().getHours(); return hour < 12 ? "Good Morning" : hour < 18 ? "Good Afternoon" : "Good Evening"; });
    assert.equal(await page.locator(".dashboard-greeting").innerText(), `${expected}, Ada Okafor!`);
    assert.equal(await page.locator(".public-site-header, .public-site-footer").count(), 0);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `Overflow at ${width}`);
    await page.getByText("No messages yet", { exact: true }).waitFor();
    assert.equal(await page.getByRole("link", { name: "Go to messages", exact: true }).getAttribute("href"), "/dashboard/messages");
    await page.getByText("No properties listed yet", { exact: true }).waitFor();
    assert.equal(await page.getByRole("link", { name: "List a property", exact: true }).getAttribute("href"), "/dashboard/listings/new");
    const hierarchy = await page.locator(".dashboard-greeting, .dashboard-kpis, .dashboard-upper, .recent-listings").evaluateAll(elements => elements.map(element => element.getBoundingClientRect().top));
    assert(hierarchy.every((top, index) => index === 0 || top > hierarchy[index - 1]), `Overview hierarchy at ${width}`);
    const columns = await page.locator(".dashboard-kpi").evaluateAll(cards => new Set(cards.map(card => Math.round(card.getBoundingClientRect().left))).size);
    assert.equal(columns, width === 1440 ? 4 : 2, `Summary-card columns at ${width}`);
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
  dashboardFixture.customer.profile_image_url="https://images.example.test/profile.webp";await open();assert.equal(await page.locator(".dashboard-avatar img").count(),1);assert.equal(await page.locator(".dashboard-avatar").evaluate(element=>getComputedStyle(element).backgroundColor),"rgba(0, 0, 0, 0)");assert.equal(await page.locator(".dashboard-avatar img").evaluate(element=>getComputedStyle(element).objectFit),"cover");dashboardFixture.customer.profile_image_url=null;await open();assert.equal(await page.locator(".dashboard-avatar img").count(),0);assert.equal(await page.locator(".dashboard-avatar").innerText(),"AO");
  passed.push("Dashboard reference structure, dynamic identity, image/initials sidebar avatar, four zero KPIs, exact empty states/actions, hierarchy and no overflow at 1440/768/390/320px");
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
  await page.getByRole("link", { name: "Go to messages", exact: true }).click();
  await page.waitForURL("**/dashboard/messages");
  for (const name of sections.slice(1)) {
    await page.getByRole("link", { name, exact: true }).click();
    await page.getByRole("heading", { name: name === "Messages" ? "My Tickets" : name === "Properties" ? "Purchased Properties" : name === "Settings" ? "Account Settings" : name, exact: true, level: 1 }).waitFor();
    assert.equal(await page.locator('.dashboard-navigation [aria-current="page"]').innerText(), name);
    if (name === "Listings") await page.getByRole("heading", { name: "No listings yet", exact: true }).waitFor();
    else if (name === "Analytics") await page.getByRole("heading", {name:"Category Performance",exact:true}).waitFor();
    else if (name === "Messages") await page.getByRole("heading", { name: "No messages yet", exact: true }).waitFor();
    else if (name === "Properties") await page.getByRole("heading", { name: "No purchased properties yet", exact: true }).waitFor();
    else if (name === "Referrals") await page.getByText("No referrals yet", {exact:true}).waitFor();
    else if(name === "Settings") await page.getByRole("heading",{name:"Personal Information",exact:true}).waitFor();
  }
  const logouts = () => calls.filter(call => call.endpoint === "/logout").length;
  const beforeHome = logouts();
  await page.getByRole("link", { name: "Back Home", exact: true }).click();
  await page.waitForURL(origin + "/"); assert.equal(logouts(), beforeHome);
  await open("/account"); await page.waitForURL("**/dashboard");
  await page.getByRole("button", { name: "Log Out", exact: true }).click();
  await page.waitForURL("**/login"); assert.equal(logouts(), beforeHome + 1);
  passed.push("Zero-safe Monthly/Yearly chart; Listings/Analytics/Messages/Properties/Referrals and Settings profile with active states; empty-state routes; Back Home without logout; /account alias; real logout endpoint");

  dashboardFixture.summary = { total_investments: 125000000, properties_owned: 3, referral_earnings: 750000, new_messages: 2 };
  dashboardFixture.revenue = {
    monthly: [
      { label: "Jan", amount: 0 }, { label: "Feb", amount: 250000 }, { label: "Mar", amount: 500000 },
      { label: "Apr", amount: 300000 }, { label: "May", amount: 700000 }, { label: "Jun", amount: 900000 },
    ],
    yearly: [{ label: "2025", amount: 2500000 }, { label: "2026", amount: 4650000 }],
  };
  messagesState.items = [
    { id: "message-1", ticketNumber: "41", subject: "Viewing confirmation", createdAt: "2026-09-26T08:00:00.000Z", lastActivityAt: "2026-09-26T08:00:00.000Z", messages: [{ id: "reply-1", body: "Your viewing is confirmed.", senderType: "SUPPORT", createdAt: "2026-09-26T08:00:00.000Z", readByCustomerAt: null }] },
    { id: "message-2", ticketNumber: "40", subject: "Mandate review update", createdAt: "2026-09-25T08:00:00.000Z", lastActivityAt: "2026-09-25T08:00:00.000Z", messages: [{ id: "reply-2", body: "Your mandate is being reviewed.", senderType: "SUPPORT", createdAt: "2026-09-25T08:00:00.000Z", readByCustomerAt: null }] },
  ];
  dashboardFixture.recent_property_listings = [
    { id: "listing-1", title: "Lekki Garden Residence", status: "LISTED", priceMinor: 12500000000, imageUrl: "https://images.example.test/listing-1.webp", updatedAt: "2026-09-26T08:00:00.000Z" },
    { id: "listing-2", title: "Ikoyi Waterfront Apartment", status: "PENDING", priceMinor: 8750000000, imageUrl: null, updatedAt: "2026-09-25T08:00:00.000Z" },
    { id: "listing-3", title: "Abuja Family Home", status: "REJECTED", priceMinor: 6400000000, imageUrl: null, updatedAt: "2026-09-24T08:00:00.000Z" },
    { id: "listing-4", title: "Victoria Island Studio", status: "UNLISTED", priceMinor: 3900000000, imageUrl: null, updatedAt: "2026-09-23T08:00:00.000Z" },
  ];
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 }); await open();
    assert.deepEqual(await page.locator(".dashboard-kpi p").allTextContents(), ["₦125,000,000.00", "3 Units", "₦750,000.00", "2 messages"]);
    assert.deepEqual(await page.locator(".recent-message-link span:nth-child(2)").allTextContents(), ["Viewing confirmation", "Mandate review update"]);
    assert.equal(await page.locator(".recent-listings li").count(), 4);
    assert.deepEqual(await page.locator(".listing-status").allTextContents(), ["LISTED", "PENDING", "REJECTED", "UNLISTED"]);
    assert.equal(await page.getByText("DRAFT", { exact: true }).count(), 0);
    assert.equal(await page.locator('.recent-listings a[href="/dashboard/listings/listing-1"]').count(), 1);
    assert.equal(await page.locator(".recent-listing-image img").count(), 1);
    assert.equal(await page.getByRole("link", { name: "See all listings", exact: true }).getAttribute("href"), "/dashboard/listings");
    await screenshot(`dashboard-populated-${width}`);
  }
  dashboardFixture.summary = { total_investments: 0, properties_owned: 0, referral_earnings: 0, new_messages: 0 };
  dashboardFixture.revenue = { monthly: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].map(label => ({ label, amount: 0 })), yearly: [] };
  messagesState.items = [];
  dashboardFixture.recent_property_listings = [];
  passed.push("Populated Overview renders real summary values, chart data, messages, bounded listings, images and UNLISTED/PENDING/LISTED/REJECTED statuses at desktop and mobile widths without a DRAFT mapping");

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
