// Run against a local Web server only. All auth calls are intercepted; no live
// customer, email, cookie, Supabase, or Google operation is performed.
// Supply PLAYWRIGHT_MODULE (absolute index.mjs) and BROWSER_EXECUTABLE when
// using already-installed external browser tooling instead of local Playwright.
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { dashboardFixture, checkDashboard } from "./dashboard-ui.checks.mjs";
import { mockListings, checkListings, listingState } from "./listings-ui.checks.mjs";
import { analyticsResponse, analyticsState, checkAnalytics } from "./analytics-ui.checks.mjs";
import { messagesResponse, messagesState, checkMessages, messagesRequestBody, messagesOverview } from "./messages-ui.checks.mjs";
import { propertiesResponse, propertiesState, checkProperties } from "./properties-ui.checks.mjs";
import { referralsResponse, referralsState, checkReferrals } from "./referrals-ui.checks.mjs";
import { settingsResponse,settingsState,settingsRequestBody,checkSettings } from "./settings-ui.checks.mjs";
import { checkKyc,kycRequestBody,kycResponse } from "./kyc-ui.checks.mjs";
import { checkLanding } from "./landing-ui.checks.mjs";
import { checkPublicPages } from "./public-pages-ui.checks.mjs";
import { checkPublicAnalytics,publicAnalyticsState } from "./public-analytics-ui.checks.mjs";
import { checkPublicReferrals } from "./public-referrals-ui.checks.mjs";
import { checkPublicSupport, supportState } from "./public-support-ui.checks.mjs";
import { checkPublicBuy, buyResponse, buyState } from "./public-buy-ui.checks.mjs";
import { checkPublicHeader } from "./public-header-ui.checks.mjs";
import { checkSavedProperties, resetSavedPropertiesState, savedPropertiesResponse } from "./saved-properties-ui.checks.mjs";
import { checkCompareProperties } from "./compare-properties-ui.checks.mjs";
import { checkMortgageCalculator } from "./mortgage-calculator-ui.checks.mjs";
import { checkInquiry } from "./inquiry-ui.checks.mjs";
import { checkSellAssistance } from "./sell-assistance-ui.checks.mjs";
import { checkBuyAssistance } from "./buy-assistance-ui.checks.mjs";

import { isMain, runSuites } from "./run-ui-suite.mjs";

export async function runBrowserSuite(suite) {
assert(["auth", "dashboard", "listings", "analytics", "messages", "properties", "referrals", "settings", "kyc", "landing", "public-pages", "public-analytics", "public-referrals", "public-support", "public-buy", "public-header", "saved-properties", "compare-properties", "mortgage-calculator", "inquiry", "sell-assistance", "buy-assistance"].includes(suite));
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE
  ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : "playwright");
const origin = process.env.AUTH_UI_ORIGIN || "http://localhost:3000";
assert(["localhost", "127.0.0.1"].includes(new URL(origin).hostname), "Local server required");
const artifacts = await mkdtemp(join(tmpdir(), "beryl-auth-ui-"));
const browser = await chromium.launch({ executablePath: process.env.BROWSER_EXECUTABLE, headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: "block", reducedMotion: "no-preference" });
const calls = [];
const failures = new Map();
let pausedEndpoint;
let release;
let pauseObserved;
let pauseTimeout;
const pendingReleases = new Set();
const resume = () => {
  pausedEndpoint = undefined;
  for (const resolve of pendingReleases) resolve();
  pendingReleases.clear();
};
let pauseGate = Promise.resolve();
let allowInterception;
const pauseRequest = (endpoint, gate = Promise.resolve()) => {
  assert.equal(pausedEndpoint, undefined, "Previous request pause must be resumed");
  pauseGate = gate;
  pausedEndpoint = endpoint; release = undefined;
  return new Promise((resolve, reject) => {
    pauseTimeout = setTimeout(() => reject(new Error(`No intercepted request for ${endpoint}`)), 15000);
    pauseObserved = () => { clearTimeout(pauseTimeout); resolve(); };
  });
};
await context.route("**/*", async (route) => {
  const request = route.request();
  const url = new URL(request.url());
  if(url.pathname.startsWith("/api/v1/public/")){
    if(request.method()==="OPTIONS")return route.fulfill({status:204,headers:{"access-control-allow-origin":origin,"access-control-allow-methods":"GET,POST","access-control-allow-headers":"content-type"}});
    const endpoint=url.pathname.replace("/api/v1","");calls.push({endpoint,method:request.method(),body:endpoint==="/public/careers/applications"||endpoint==="/public/sell-assistance"||endpoint==="/public/buy-assistance"?request.postDataBuffer():request.postDataJSON(),url:url.href});
    if(endpoint==="/public/careers/applications"){
      if(endpoint===pausedEndpoint){await pauseGate;if(endpoint===pausedEndpoint)await new Promise(resolve=>{pendingReleases.add(resolve);release=resume;pauseObserved?.();pauseObserved=undefined;});}
      const error=failures.get(endpoint);
      return route.fulfill({status:error?error.status??503:201,contentType:"application/json",headers:{"access-control-allow-origin":origin},body:JSON.stringify(error?{success:false,error}:{success:true,data:{recorded:true}})});
    }
    if(endpoint==="/public/support/reports"){
      if(endpoint===pausedEndpoint){await pauseGate;if(endpoint===pausedEndpoint)await new Promise(resolve=>{pendingReleases.add(resolve);release=resume;pauseObserved?.();pauseObserved=undefined;});}
      const error=failures.get(endpoint);
      if(!error)supportState.submissions.push(request.postDataJSON());
      return route.fulfill({status:error?error.status??503:201,contentType:"application/json",headers:{"access-control-allow-origin":origin},body:JSON.stringify(error?{success:false,error}:{success:true,data:{recorded:true}})});
    }
    if(endpoint==="/public/inquiries"){
      if(endpoint===pausedEndpoint){await pauseGate;if(endpoint===pausedEndpoint)await new Promise(resolve=>{pendingReleases.add(resolve);release=resume;pauseObserved?.();pauseObserved=undefined;});}
      const error=failures.get(endpoint);return route.fulfill({status:error?error.status??503:201,contentType:"application/json",headers:{"access-control-allow-origin":origin},body:JSON.stringify(error?{success:false,error}:{success:true,data:{recorded:true}})});
    }
    if(endpoint==="/public/sell-assistance"){
      if(endpoint===pausedEndpoint){await pauseGate;if(endpoint===pausedEndpoint)await new Promise(resolve=>{pendingReleases.add(resolve);release=resume;pauseObserved?.();pauseObserved=undefined;});}
      const error=failures.get(endpoint);return route.fulfill({status:error?error.status??503:201,contentType:"application/json",headers:{"access-control-allow-origin":origin},body:JSON.stringify(error?{success:false,error}:{success:true,data:{recorded:true}})});
    }
    if(endpoint==="/public/buy-assistance"){
      if(endpoint===pausedEndpoint){await pauseGate;if(endpoint===pausedEndpoint)await new Promise(resolve=>{pendingReleases.add(resolve);release=resume;pauseObserved?.();pauseObserved=undefined;});}
      const error=failures.get(endpoint);return route.fulfill({status:error?error.status??503:201,contentType:"application/json",headers:{"access-control-allow-origin":origin},body:JSON.stringify(error?{success:false,error}:{success:true,data:{recorded:true}})});
    }
    if(endpoint==="/public/properties"){
      if(endpoint===pausedEndpoint){await pauseGate;if(endpoint===pausedEndpoint)await new Promise(resolve=>{pendingReleases.add(resolve);release=resume;pauseObserved?.();pauseObserved=undefined;});}
      const error=failures.get(endpoint);
      return route.fulfill({status:error?error.status??503:200,contentType:"application/json",headers:{"access-control-allow-origin":origin},body:JSON.stringify(error?{success:false,error}:{success:true,data:buyResponse(url)})});
    }
    const error=failures.get(endpoint);
    const monthly=Array.from({length:12},(_,index)=>({label:["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"][index],valueMinor:index===0?25000000000:index===1?null:index===2?50000000000:null}));
    const data=endpoint==="/public/analytics"?{period:url.searchParams.get("period")??"monthly",priceSeries:url.searchParams.get("period")==="annually"?(publicAnalyticsState.zero?[]:[{label:"2025",valueMinor:30000000000},{label:"2026",valueMinor:50000000000}]):publicAnalyticsState.zero?monthly.map(item=>({...item,valueMinor:null})):monthly,propertyPercentage:publicAnalyticsState.zero?{totalListedProperties:0,residentialListedProperties:0,residentialPercentage:0}:{totalListedProperties:4,residentialListedProperties:1,residentialPercentage:25},searchesPerDay:Array.from({length:7},(_,index)=>({date:`2026-09-${String(index+10).padStart(2,"0")}`,count:publicAnalyticsState.zero?0:index===2?3:0}))}:{recorded:true};
    return route.fulfill({status:error?error.status??503:endpoint==="/public/property-searches"?201:200,contentType:"application/json",headers:{"access-control-allow-origin":origin},body:JSON.stringify(error?{success:false,error}:{success:true,data})});
  }
  if (url.pathname.startsWith("/api/v1/listings")) return mockListings(route, origin);
  if (url.pathname.startsWith("/api/v1/auth/") || url.pathname.startsWith("/api/v1/messages/") || url.pathname.startsWith("/api/v1/saved-properties") || url.pathname.startsWith("/api/v1/dashboard/kyc") || ["/api/v1/dashboard/overview", "/api/v1/dashboard/analytics", "/api/v1/dashboard/properties", "/api/v1/dashboard/referrals", "/api/v1/dashboard/referrals/public-property", "/api/v1/dashboard/settings/profile", "/api/v1/dashboard/settings/password", "/api/v1/dashboard/settings/business"].includes(url.pathname)) {
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: {
      "access-control-allow-origin": origin, "access-control-allow-credentials": "true",
      "access-control-allow-headers": "content-type", "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
    } });
    const endpoint = url.pathname.startsWith("/api/v1/auth/") ? url.pathname.replace("/api/v1/auth", "") : url.pathname.replace("/api/v1", "");
    const requestBody=endpoint.startsWith("/messages/")?messagesRequestBody(request):endpoint==="/dashboard/kyc"&&request.method()==="POST"?kycRequestBody(request):endpoint.startsWith("/dashboard/settings/")&&endpoint!=="/dashboard/settings/password"?settingsRequestBody(request):request.postDataJSON();
    calls.push({ endpoint, body: requestBody, method: request.method(), url: url.href });
    if (endpoint === pausedEndpoint) {
      await pauseGate;
      if (endpoint === pausedEndpoint) await new Promise((resolve) => {
        pendingReleases.add(resolve);
        release = resume; pauseObserved?.(); pauseObserved = undefined;
      });
    }
    const error = failures.get(endpoint);
    if(endpoint.startsWith("/saved-properties")){
      const result=savedPropertiesResponse(url,request.method(),requestBody,buyState.items);
      return route.fulfill({status:error?error.status??503:result.status,contentType:"application/json",headers:{"access-control-allow-origin":origin,"access-control-allow-credentials":"true"},body:JSON.stringify(error?{success:false,error}:result.error?{success:false,error:result.error}:{success:true,data:result.data})});
    }
    if(!error&&endpoint.startsWith("/messages/")&&endpoint.includes("/attachments/"))return route.fulfill({status:200,contentType:"application/pdf",headers:{"access-control-allow-origin":origin,"access-control-allow-credentials":"true","content-disposition":"attachment"},body:"%PDF-1.4\nbrowser attachment"});
    const ticketOverview=messagesOverview();
    const publicReferral = endpoint === "/dashboard/referrals/public-property" ? {id:"REF-N4K7P9",referralType:"PROPERTY",propertyCode:requestBody.propertyCode,referralUrl:`${origin}/buy?code=${requestBody.propertyCode}&ref=REF-N4K7P9`} : null;
    return route.fulfill({ status: error ? error.status ?? 400 : publicReferral ? 201 : 200, contentType: "application/json",
      headers: { "access-control-allow-origin": origin, "access-control-allow-credentials": "true" },
      body: JSON.stringify(error ? { success: false, error } : { success: true, data: publicReferral ?? (endpoint === "/me" && (suite === "public-header" || suite === "public-referrals" || suite === "saved-properties" || suite === "compare-properties" || suite === "mortgage-calculator" || suite === "inquiry" || suite === "sell-assistance" || suite === "buy-assistance" || suite === "public-buy" && buyState.authenticated) ? {customer:dashboardFixture.customer} : endpoint.startsWith("/messages/") ? messagesResponse(url,request.method(),requestBody) : endpoint === "/dashboard/kyc" ? kycResponse(request.method(),requestBody) : endpoint === "/dashboard/analytics" ? analyticsResponse(url) : endpoint === "/dashboard/properties" ? propertiesResponse(url) : endpoint === "/dashboard/referrals" ? referralsResponse(url,request.method(),requestBody,listingState.items,origin) : endpoint === "/dashboard/settings/profile" ? settingsResponse(request.method(),requestBody) : endpoint === "/dashboard/settings/business" ? settingsResponse(request.method(),requestBody,"business") : endpoint === "/dashboard/settings/password" ? {reauthenticate:true} : endpoint === "/dashboard/overview" ? {...dashboardFixture,recent_messages:ticketOverview.recent,summary:{...dashboardFixture.summary,new_messages:ticketOverview.unread}} : { maskedEmail: "t***@example.test" }) }) });
  }
  if (url.origin === origin) return route.continue();
  if (url.hostname === "www.google.com" && url.pathname === "/maps") return route.fulfill({status:200,contentType:"text/html",body:"<!doctype html><title>Map embed test stub</title>"});
  if (url.hostname === "images.example.test") return route.fulfill({status:200,contentType:"image/png",body:Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=","base64")});
  return route.abort();
});
const page = await context.newPage();
page.setDefaultTimeout(15000);
const pageErrors = [];
const networkErrors = [];
const requestPages = new WeakMap();
page.on("pageerror", (error) => pageErrors.push(error.message));
page.on("request", request => requestPages.set(request, page.url()));
page.on("requestfailed", request => {
  const url = new URL(request.url());
  networkErrors.push({ path: url.pathname + url.search, error: request.failure()?.errorText,
    resourceType: request.resourceType(), navigation: request.isNavigationRequest(), page: page.url(),
    startedOn: requestPages.get(request),
    mocked: url.pathname.startsWith("/api/v1/") });
});
const routes = ["/login", "/register", "/verify-email", "/forgot-password", "/forgot-password/verify", "/reset-password", "/reset-password/success"];
const screenshot = (name) => page.screenshot({ path: join(artifacts, `${name}.png`), fullPage: true });
const goto = async (path) => {
  await page.goto(origin + path);
  await page.locator(".auth-card").waitFor();
  await page.evaluate(() => document.fonts.ready);
};
const submit = () => page.getByRole("button", { name: "Submit", exact: true }).click();
const typeCode = async (code) => {
  for (let index = 0; index < code.length; index++) {
    await page.getByLabel(`Verification digit ${index + 1}`, { exact: true }).fill(code[index]);
  }
};
const pasteCode = (code) => page.locator(".otp-input").evaluate((el, text) => {
  const clipboardData = new DataTransfer(); clipboardData.setData("text/plain", text);
  el.dispatchEvent(new ClipboardEvent("paste", { bubbles: true, clipboardData }));
}, code);
const toast = async (text) => {
  const notification = page.locator(".Toastify__toast").filter({ hasText: text }).last();
  await notification.waitFor();
  // Wait for the entrance animation, not the nested auto-dismiss progress bar.
  await notification.evaluate((el) => Promise.all(el.getAnimations().map((animation) => animation.finished.catch(() => {}))));
};
const passed = [];
try {
  assert.equal(page.url(), "about:blank");
  assert.equal(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches), false);
  assert.deepEqual(listingState, { items: [], calls: [] });
  if (suite === "auth") {
  const preHydrationContext = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1440, height: 900 } });
  const preHydrationPage = await preHydrationContext.newPage();
  const preHydrationNavigations = [];
  preHydrationPage.on("request", request => {
    if (request.isNavigationRequest() && request.frame() === preHydrationPage.mainFrame()) {
      preHydrationNavigations.push({ method: request.method(), url: request.url() });
    }
  });
  for (const path of ["/login", "/register", "/forgot-password", "/forgot-password/verify"]) {
    await preHydrationPage.goto(origin + path);
    const form = preHydrationPage.locator("form.auth-card");
    await form.waitFor();
    assert.equal(await form.getAttribute("method"), "post", `${path} must not default to GET`);
    assert.equal(await form.getAttribute("action"), null, `${path} must not add a native auth endpoint`);
    assert.equal(await form.getAttribute("inert"), "", `${path} must be inert before hydration`);
    assert.equal(await form.getAttribute("aria-busy"), "true", `${path} must expose its temporary unavailable state`);
  }
  for (const path of ["/verify-email", "/reset-password"]) {
    await preHydrationPage.goto(origin + path);
    await preHydrationPage.locator(".brand-loader").waitFor();
    assert.equal(await preHydrationPage.locator("form").count(), 0, `${path} must render no form before hydration`);
  }
  await preHydrationPage.goto(origin + "/register");
  await preHydrationPage.locator("#register-password").evaluate((input) => { input.value = "NeverInAUrl1!"; });
  await preHydrationPage.locator("#register-confirm-password").evaluate((input) => { input.value = "NeverInAUrl1!"; });
  const navigationCount = preHydrationNavigations.length;
  await preHydrationPage.getByRole("button", { name: "Create Account", exact: true }).click({ force: true }).catch(() => {});
  await preHydrationPage.keyboard.press("Enter");
  await preHydrationPage.waitForTimeout(250);
  assert.equal(preHydrationNavigations.length, navigationCount, "Pre-hydration registration interaction must not navigate");
  assert.equal(new URL(preHydrationPage.url()).search, "", "Registration credentials must not enter the query string");
  await preHydrationContext.close();
  passed.push("All auth forms use POST semantics and block native interaction before hydration; registration credentials cannot enter a URL");

  for (const width of [1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of routes) {
      await goto(path);
      const layout = await page.evaluate(() => {
        const header = document.querySelector(".public-header");
        const card = document.querySelector(".auth-card").getBoundingClientRect();
        const picture = document.querySelector(".auth-image-column").getBoundingClientRect();
        return { overflow: document.documentElement.scrollWidth > innerWidth, fixed: getComputedStyle(header).position,
          white: getComputedStyle(header).backgroundColor, background: getComputedStyle(document.body).backgroundColor,
          font: getComputedStyle(document.body).fontFamily, belowHeader: card.top >= header.getBoundingClientRect().bottom,
          right: picture.left >= card.right, stacked: picture.top >= card.bottom, footer: !!document.querySelector("footer"),
          logo: document.querySelector(".brand img")?.getAttribute("alt") };
      });
      assert.equal(layout.overflow, false, `${path} overflows at ${width}`);
      assert.equal(layout.fixed, "fixed");
      assert.equal(layout.white, "rgb(255, 255, 255)");
      assert.equal(layout.background, "rgb(247, 247, 250)");
      assert.match(layout.font, /jakarta/i);
      assert(layout.belowHeader && !layout.footer && layout.logo === "Beryl Shelter");
      assert.equal(await page.locator(".brand .brand-name").innerText(), "Beryl Shelter");
      const brand = await page.locator(".brand-lockup").boundingBox();
      const mark = await page.locator(".brand-logo").boundingBox();
      const name = await page.locator(".brand-name").boundingBox();
      assert(width > 700 ? (name.y >= mark.y + mark.height && Math.abs(name.x + name.width / 2 - (mark.x + mark.width / 2)) < 1) : name.x >= mark.x);
      assert(brand.y >= 0 && brand.y + brand.height <= (await page.locator("header").boundingBox()).height);
      if (width <= 700) {
        assert.equal(await page.getByRole("button", { name: "Toggle navigation" }).isVisible(), true, `${path} mobile menu button at ${width}`);
      }
      assert(width > 700 ? layout.right : layout.stacked, `${path} column layout at ${width}`);
      if (width === 1440 || width === 320) await screenshot(`${width}-${path.replaceAll("/", "-")}`);
    }
    passed.push(`All seven layouts at ${width}px`);
    console.log(`Layout checks passed at ${width}px`);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await goto("/register");
  await page.locator("#first-name").fill("Test"); await page.locator("#last-name").fill("Customer");
  await page.locator("#register-email").fill("test@example.test"); await page.locator("#phone-number").fill("08012345678");
  await page.getByRole("button", { name: "Show create password" }).click();
  assert.equal(await page.locator("#register-password").getAttribute("type"), "text");
  assert.equal(await page.getByRole("button", { name: "Hide create password" }).locator("svg").count(), 1);
  await page.getByRole("button", { name: "Hide create password" }).click();
  await page.getByRole("button", { name: "Show confirm password" }).click();
  assert.equal(await page.locator("#register-confirm-password").getAttribute("type"), "text");
  await page.getByRole("button", { name: "Hide confirm password" }).click();
  await page.locator("#register-password").fill("TestingPass1!"); await page.locator("#register-confirm-password").fill("TestingPass1!");
  const registrationCallsBefore = calls.filter((call) => call.endpoint === "/register").length;
  await page.locator("#register-confirm-password").press("Enter");
  await page.waitForURL("**/verify-email"); await toast("Verification code sent to your email");
  assert.equal(calls.filter((call) => call.endpoint === "/register").length, registrationCallsBefore + 1);
  assert.equal(new URL(page.url()).search, "");
  assert.equal(calls.find((c) => c.endpoint === "/register").body.accountType, "INVESTOR");
  assert.equal(calls.find((c) => c.endpoint === "/register").body.profileType, "PERSONAL");
  const verificationCount = () => calls.filter((c) => c.endpoint === "/verify-email").length;
  const beforeVerify = verificationCount();
  console.log("Checking six-box automatic verification");
  assert.equal(await page.locator('.otp-input input[type="text"]').count(), 6);
  await page.getByLabel("Verification digit 1", { exact: true }).fill("a");
  assert.equal(await page.getByLabel("Verification digit 1", { exact: true }).inputValue(), "");
  await typeCode("12345");
  assert.equal(verificationCount(), beforeVerify);
  const verificationPaused = pauseRequest("/verify-email");
  await page.getByLabel("Verification digit 6", { exact: true }).fill("6");
  await verificationPaused;
  assert.equal(verificationCount(), beforeVerify + 1);
  console.log("Sixth digit triggered the verification request");
  assert(await page.getByRole("button", { name: "Submit", exact: true }).isDisabled());
  assert(await page.getByLabel("Verification digit 6", { exact: true }).isDisabled());
  assert.equal(calls.filter((c) => c.endpoint === "/verify-email").at(-1).body.code, "123456");
  assert(release); pausedEndpoint = undefined; release(); await page.waitForURL("**/dashboard");
  await page.getByRole("button", { name: "Log Out", exact: true }).click(); await page.waitForURL("**/login");
  passed.push("Hydrated keyboard registration, password-free navigation, six-box auto verification on final digit, pending lock, account and logout");

  await goto("/login");
  await page.locator("#login-identity").fill("test@example.test"); await page.locator("#login-password").fill("TestingPass1!");
  await page.getByRole("button", { name: "Show password" }).click();
  assert.equal(await page.locator("#login-password").getAttribute("type"), "text");
  assert.equal(await page.getByRole("button", { name: "Hide password" }).locator("svg").count(), 1);
  await page.getByRole("button", { name: "Hide password" }).click();
  failures.set("/login", { code: "INVALID_CREDENTIALS", message: "Invalid credentials." });
  const loginPaused = pauseRequest("/login");
  await submit();
  await loginPaused;
  assert(await page.getByRole("button", { name: "Submit", exact: true }).isDisabled());
  await page.waitForFunction(() => document.querySelector("form").getAttribute("aria-busy") === "true");
  assert(release); pausedEndpoint = undefined; release();
  await toast("Invalid credentials.");
  assert.equal(await page.locator(".auth-card").getByText("Invalid credentials.").count(), 0);
  const toastRect = await page.locator(".Toastify__toast").last().boundingBox();
  assert(toastRect.y >= (await page.locator("header").boundingBox()).height);
  assert(toastRect.x >= 0 && toastRect.x + toastRect.width <= 1440);
  await screenshot("login-error-toast");
  failures.delete("/login"); await submit(); await page.waitForURL("**/dashboard");
  passed.push("Login, Show/Hide, disabled pending submit and toast-only errors below header");

  const loginThrough = async (path) => {
    await goto(path); await page.locator("#login-identity").fill("test@example.test");
    await page.locator("#login-password").fill("TestingPass1!"); await submit();
  };
  const safeNext = "/dashboard/referrals?source=landing#share";
  await loginThrough(`/login?next=${encodeURIComponent(safeNext)}`);
  await page.waitForURL(url => `${url.pathname}${url.search}${url.hash}` === safeNext);
  for (const buyNext of ["/buy", "/buy?code=RES-ABC234", "/saved-properties", "/compare-properties", "/compare-properties/compare?codes=RES-SAVE01%2CRES-SAVE02"]) {
    await loginThrough(`/login?next=${encodeURIComponent(buyNext)}`);
    await page.waitForURL(url => `${url.pathname}${url.search}` === buyNext);
  }
  await loginThrough("/login?next=%2Fbuying"); await page.waitForURL("**/dashboard");
  for (const unsafeNext of ["https://evil.example/steal","//evil.example/steal","javascript:alert(1)","data:text/html,evil","\\\\evil.example\\steal","/login","/%E0%A4%A"]) {
    await loginThrough(`/login?next=${encodeURIComponent(unsafeNext)}`); await page.waitForURL("**/dashboard");
    assert.equal(new URL(page.url()).origin,origin); assert.equal(new URL(page.url()).pathname,"/dashboard");
  }
  passed.push("Login honors allowlisted internal next paths and ignores absolute, protocol-relative, scheme, backslash, auth-loop and malformed redirects");

  await goto("/forgot-password"); await page.locator("#recovery-identity").fill("test@example.test");
  await submit(); await page.waitForURL("**/forgot-password/verify"); await toast("Password reset code sent to your email.");
  assert.equal(await page.locator('.otp-input input[type="text"]').count(), 6);
  await page.getByLabel("Verification digit 1", { exact: true }).fill("1");
  assert(await page.getByLabel("Verification digit 2", { exact: true }).evaluate((el) => el === document.activeElement));
  await page.keyboard.press("Backspace");
  assert(await page.getByLabel("Verification digit 1", { exact: true }).evaluate((el) => el === document.activeElement));
  await page.locator(".otp-input").evaluate((el) => {
    const clipboardData = new DataTransfer(); clipboardData.setData("text/plain", "12-34 56");
    el.dispatchEvent(new ClipboardEvent("paste", { bubbles: true, clipboardData }));
  });
  assert.equal(await page.locator('input[name="code"]').inputValue(), "123456");
  await submit(); await page.waitForURL("**/reset-password");
  await page.locator("#new-password").fill("AnotherPass2!"); await page.locator("#confirm-new-password").fill("AnotherPass2!");
  await submit(); await page.waitForURL("**/reset-password/success");
  await page.getByRole("link", { name: "Back To Log In" }).click(); await page.waitForURL("**/login");
  passed.push("Recovery, six-box input/paste/focus, reset and dedicated success route");

  const invalidCode = "The verification code is invalid or expired. Request a new code.";
  await goto("/verify-email");
  failures.set("/verify-email", { code: "INVALID_OTP", message: invalidCode });
  const beforeInvalid = verificationCount();
  await pasteCode("00-00 00"); await toast(invalidCode);
  assert.equal(verificationCount(), beforeInvalid + 1);
  assert.equal(await page.locator(".auth-card").getByText(invalidCode).count(), 0);
  await submit();
  await page.waitForFunction(() => document.querySelector('form').getAttribute('aria-busy') === 'false');
  assert.equal(verificationCount(), beforeInvalid + 2);
  failures.delete("/verify-email");
  await page.getByLabel("Verification digit 6", { exact: true }).fill("");
  await page.getByLabel("Verification digit 6", { exact: true }).fill("1");
  await page.waitForURL("**/dashboard");
  assert.equal(verificationCount(), beforeInvalid + 3);
  await goto("/verify-email"); await pasteCode("12 34-56"); await page.waitForURL("**/dashboard");
  passed.push("Pasted code auto-submit, no invalid-code retry loop, manual retry and edited-code retry");
  failures.delete("/verify-email");
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 750 });
    await goto("/verify-email");
    failures.set("/verify-email", { code: "INVALID_OTP", message: invalidCode });
    await typeCode("000000"); await toast(invalidCode);
    const rect = await page.locator(".Toastify__toast").last().boundingBox();
    assert(rect.y >= (await page.locator("header").boundingBox()).height);
    assert(rect.x >= 0 && rect.x + rect.width <= width);
    await screenshot(`${width}-invalid-otp-toast`);
    failures.delete("/verify-email");
  }
  passed.push("Invalid verification code uses toast only, including narrow mobile viewports");
  await page.setViewportSize({ width: 1440, height: 900 });

  for (const path of ["/verify-email", "/reset-password", "/account"]) {
    const endpoint = path === "/verify-email" ? "/verification-context" : path === "/reset-password" ? "/recovery-context" : "/dashboard/overview";
    // Exercise the race deterministically: render the loader before allowing
    // the route handler to assign release. Seeing a loader is not an API latch.
    const gate = new Promise(resolve => { allowInterception = resolve; });
    const requestPaused = pauseRequest(endpoint, gate);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(origin + path);
    // /account intentionally redirects. A visible route loader can precede the
    // destination's API request, so observe that request before releasing it.
    await page.locator(".brand-loader img").waitFor();
    assert.equal(release, undefined, `Pre-interception loader coverage: ${path}`);
    allowInterception(); allowInterception = undefined;
    await requestPaused;
    if (path === "/account") await page.waitForURL("**/dashboard");
    assert.equal(await page.locator(".brand-loader").innerText(), "Beryl Shelter");
    assert.equal(await page.locator(".brand-loader .brand-lockup").evaluate((el) => getComputedStyle(el).animationName), "none");
    await screenshot(`loader-${path.slice(1)}`);
    assert(release, `Loader visible before request interception: ${path} -> ${endpoint}; current URL ${page.url()}`); pausedEndpoint = undefined; release();
    await page.locator(".brand-loader").waitFor({ state: "detached" });
    console.log(`Loader race coverage passed: ${path} -> ${endpoint}`);
  }
  passed.push("Logo-only initialization and reduced-motion support");
  await goto("/login");
  failures.set("/login", { code: "INVALID_CREDENTIALS", message: "Reduced-motion notification" });
  await page.locator("#login-identity").fill("test@example.test");
  await page.locator("#login-password").fill("TestingPass1!");
  await page.mouse.move(0, 0);
  await submit(); await toast("Reduced-motion notification");
  const reducedToast = page.locator(".Toastify__toast").filter({ hasText: "Reduced-motion notification" });
  assert.equal(await reducedToast.locator('[role="progressbar"]').evaluate(el => getComputedStyle(el).animationName), "toast-no-motion");
  await reducedToast.waitFor({ state: "detached", timeout: 7000 });
  await submit(); await toast("Reduced-motion notification");
  await reducedToast.getByRole("button", { name: "close", exact: true }).click();
  await reducedToast.waitFor({ state: "detached" });
  failures.delete("/login");
  passed.push("Reduced-motion toasts auto-dismiss and close manually without movement; logo remains motion-free");
  const alreadyVerified = { code: "EMAIL_ALREADY_VERIFIED", message: "Your email is already verified. Please log in." };
  failures.set("/resend-verification", alreadyVerified);
  for (const identifier of ["test@example.test", "08012345678"]) {
    await goto("/login");
    await page.locator("#login-identity").fill(identifier);
    const contextsBefore = calls.filter((call) => call.endpoint === "/verification-context").length;
    await page.getByRole("link", { name: "Verify Email", exact: true }).click();
    await toast(alreadyVerified.message);
    assert.equal(new URL(page.url()).pathname, "/login");
    assert.equal(calls.filter((call) => call.endpoint === "/verification-context").length, contextsBefore);
    assert.equal(await page.locator(".Toastify__toast--info").count(), 1);
    assert.equal(await page.getByText("Verification code sent to your email", { exact: true }).count(), 0);
  }
  failures.delete("/resend-verification");
  await goto("/login"); await page.locator("#login-identity").fill("test@example.test");
  await page.getByRole("link", { name: "Verify Email", exact: true }).click();
  await page.waitForURL("**/verify-email"); await toast("Verification code sent to your email");
  assert.equal(await page.locator('.otp-input input[type="text"]').count(), 6);
  failures.set("/resend-verification", alreadyVerified);
  await page.getByRole("button", { name: "Resend Code", exact: true }).click();
  await page.waitForURL("**/login"); await toast(alreadyVerified.message);
  failures.delete("/resend-verification");
  failures.set("/verification-context", alreadyVerified);
  await page.goto(origin + "/verify-email");
  await page.waitForURL("**/login"); await toast(alreadyVerified.message);
  failures.delete("/verification-context");
  await goto("/verify-email"); failures.set("/verify-email", alreadyVerified);
  await pasteCode("123456"); await page.waitForURL("**/login"); await toast(alreadyVerified.message);
  failures.delete("/verify-email");
  passed.push("Verified email/phone stay on Login; only unverified accounts proceed; stale verification screens return to Login");
  await goto("/login");
  const icon = await page.locator('link[rel="icon"]').getAttribute("href");
  assert(icon.startsWith("/icon.png"));
  const iconResponse = await page.request.get(origin + icon); assert(iconResponse.ok());
  assert.match(iconResponse.headers()["content-type"], /image\/png/);
  failures.set("/google", { code: "GOOGLE_NOT_CONFIGURED", message: "Internal configuration detail" });
  await page.getByRole("button", { name: "Continue to sign in with Google" }).click();
  await toast("Google sign-in is not available yet.");
  await page.goto(origin + "/auth/callback");
  await toast("Google sign-in was cancelled or could not be completed.");
  assert.equal(await page.locator("main [role=alert]").count(), 0);
  await page.evaluate(() => sessionStorage.setItem("beryl-google-next", "/buy"));
  await page.goto(origin + "/auth/callback?code=test-code&state=test-state");
  await page.waitForURL(url => url.pathname === "/buy");
  assert.equal(await page.evaluate(() => sessionStorage.getItem("beryl-google-next")), null);
  passed.push("Brand favicon and friendly toast-only Google errors");
  }
  if (suite === "dashboard") {
  await checkDashboard({ page, origin, calls, failures, screenshot, passed, pauseRequest,
    resume, toast });
  }
  if (suite === "listings") {
  await checkListings({page,origin,screenshot,toast,passed,context});
  }
  if (suite === "analytics") {
    await checkAnalytics({ page, origin, calls, failures, screenshot, passed, pauseRequest, resume, toast });
  }
  if (suite === "messages") {
    await checkMessages({ page, origin, calls, failures, screenshot, passed, pauseRequest, resume, toast });
  }
  if (suite === "properties") {
    await checkProperties({ page, origin, calls, failures, screenshot, passed, pauseRequest, resume, toast });
  }
  if (suite === "referrals") {
    await checkReferrals({ page, origin, calls, failures, screenshot, passed, pauseRequest, resume, toast, context });
  }
  if (suite === "settings") await checkSettings({page,origin,calls,failures,screenshot,passed,pauseRequest,resume,toast});
  if (suite === "kyc") await checkKyc({page,origin,calls,failures,screenshot,passed,pauseRequest,resume,toast});
  if (suite === "landing") await checkLanding({page,origin,calls,screenshot,passed});
  if (suite === "public-pages") await checkPublicPages({page,origin,calls,failures,screenshot,passed,pauseRequest,resume});
  if (suite === "public-analytics") await checkPublicAnalytics({page,origin,calls,failures,screenshot,passed});
  if (suite === "public-referrals") await checkPublicReferrals({page,origin,calls,failures,screenshot,passed});
  if (suite === "public-support") await checkPublicSupport({page,origin,calls,failures,screenshot,passed,pauseRequest,resume});
  if (suite === "public-buy") await checkPublicBuy({page,origin,calls,failures,screenshot,passed,pauseRequest,resume});
  if (suite === "public-header") await checkPublicHeader({page,origin,calls,failures,screenshot,passed});
  if (suite === "saved-properties") await checkSavedProperties({page,origin,calls,failures,screenshot,passed});
  if (suite === "compare-properties") await checkCompareProperties({page,origin,calls,failures,screenshot,passed});
  if (suite === "mortgage-calculator") await checkMortgageCalculator({page,origin,calls,failures,screenshot,passed});
  if (suite === "inquiry") await checkInquiry({page,origin,calls,failures,screenshot,passed,pauseRequest,resume});
  if (suite === "sell-assistance") await checkSellAssistance({page,origin,calls,failures,screenshot,passed,pauseRequest,resume});
  if (suite === "buy-assistance") await checkBuyAssistance({page,origin,calls,failures,screenshot,passed,pauseRequest,resume});
  assert.deepEqual(pageErrors, []);
  await writeFile(join(artifacts, "results.json"), JSON.stringify({ suite, passed, authCalls: calls.length, pageErrors, networkErrors }, null, 2));
  // Keep complete request diagnostics in results.json, including expected
  // navigation/unmount cancellations; cancellations alone are not page errors.
  console.log(JSON.stringify({ suite, passed, artifacts, authCalls: calls.length, pageErrors,
    abortedRequests: networkErrors.filter(request => request.error === "net::ERR_ABORTED").length,
    otherRequestFailures: networkErrors.filter(request => request.error !== "net::ERR_ABORTED") }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ url: page.url(), pageErrors, networkErrors, pausedEndpoint, failures: [...failures.keys()], recentCalls: calls.slice(-8).map(call => call.endpoint), body: await page.locator("body").innerText().catch(() => "unavailable"), artifacts }, null, 2));
  await screenshot("failure").catch(() => {});
  console.error(error);
  throw error;
} finally {
  clearTimeout(pauseTimeout);
  pauseObserved = undefined;
  allowInterception?.();
  resume();
  try {
    // Stop page timers/fetches before draining already-entered route handlers.
    await page.close();
    await context.unrouteAll({ behavior: "wait" });
    await context.close();
  } finally {
    await browser.close();
    failures.clear();
    calls.length = 0;
    listingState.items = [];
    listingState.calls.length = 0;
    analyticsState.items = [];
    messagesState.items = [];
    propertiesState.items = [];
    referralsState.links = [];
    referralsState.next = 2;
    supportState.submissions = [];
    buyState.authenticated = false;
    resetSavedPropertiesState();
    Object.assign(settingsState.profile,{firstName:"Ada",lastName:"Okafor",profileImageUrl:null});
    dashboardFixture.customer.profile_image_url=null;
  }
}
}

if (isMain(import.meta.url)) {
  const suite = process.argv.find(arg => arg.startsWith("--suite="))?.slice(8) ?? "all";
  if (suite === "all") process.exitCode = runSuites();
  else await runBrowserSuite(suite);
}
