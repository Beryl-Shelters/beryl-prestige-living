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

import { isMain, runSuites } from "./run-ui-suite.mjs";

export async function runBrowserSuite(suite) {
assert(["auth", "dashboard", "listings", "analytics"].includes(suite));
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
  if (url.pathname.startsWith("/api/v1/listings")) return mockListings(route, origin);
  if (url.pathname.startsWith("/api/v1/auth/") || ["/api/v1/dashboard/overview", "/api/v1/dashboard/analytics"].includes(url.pathname)) {
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: {
      "access-control-allow-origin": origin, "access-control-allow-credentials": "true",
      "access-control-allow-headers": "content-type", "access-control-allow-methods": "GET, POST, OPTIONS",
    } });
    const endpoint = url.pathname.startsWith("/api/v1/dashboard/") ? url.pathname.replace("/api/v1", "") : url.pathname.replace("/api/v1/auth", "");
    calls.push({ endpoint, body: request.postDataJSON(), method: request.method(), url: url.href });
    if (endpoint === pausedEndpoint) {
      await pauseGate;
      if (endpoint === pausedEndpoint) await new Promise((resolve) => {
        pendingReleases.add(resolve);
        release = resume; pauseObserved?.(); pauseObserved = undefined;
      });
    }
    const error = failures.get(endpoint);
    return route.fulfill({ status: error ? error.status ?? 400 : 200, contentType: "application/json",
      headers: { "access-control-allow-origin": origin, "access-control-allow-credentials": "true" },
      body: JSON.stringify(error ? { success: false, error } : { success: true, data: endpoint === "/dashboard/analytics" ? analyticsResponse(url) : endpoint === "/dashboard/overview" ? dashboardFixture : { maskedEmail: "t***@example.test" } }) });
  }
  if (url.origin === origin) return route.continue();
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
      assert(name.y >= mark.y + mark.height && Math.abs(name.x + name.width / 2 - (mark.x + mark.width / 2)) < 1);
      assert(brand.y >= 0 && brand.y + brand.height <= (await page.locator("header").boundingBox()).height);
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
  await page.locator("#register-password").fill("TestingPass1!"); await page.locator("#register-confirm-password").fill("TestingPass1!");
  await page.getByRole("button", { name: "Create Account", exact: true }).click();
  await page.waitForURL("**/verify-email"); await toast("Verification code sent to your email");
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
  passed.push("Registration, six-box auto verification on final digit, pending lock, account and logout");

  await goto("/login");
  await page.locator("#login-identity").fill("test@example.test"); await page.locator("#login-password").fill("TestingPass1!");
  await page.getByRole("button", { name: "Show password" }).click();
  assert.equal(await page.locator("#login-password").getAttribute("type"), "text");
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
  }
}
}

if (isMain(import.meta.url)) {
  const suite = process.argv.find(arg => arg.startsWith("--suite="))?.slice(8) ?? "all";
  if (suite === "all") process.exitCode = runSuites();
  else await runBrowserSuite(suite);
}
