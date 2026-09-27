import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";

const origin = "http://127.0.0.1:3021";
const api = origin;
const require = createRequire(import.meta.url);
const next = require.resolve("next/dist/bin/next");
const cwd = resolve(import.meta.dirname, "..");
const server = spawn(process.execPath, [next, "dev", "-H", "127.0.0.1", "-p", "3021"], {
  cwd,
  env: { ...process.env, NEXT_PUBLIC_API_BASE_URL: api, NEXT_PUBLIC_WEB_APP_URL: origin },
  stdio: ["ignore", "pipe", "pipe"],
});

let output = "";
server.stdout.on("data", (chunk) => (output += chunk));
server.stderr.on("data", (chunk) => (output += chunk));

async function ready() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      if ((await fetch(origin)).ok) return;
    } catch {}
    await delay(500);
  }
  throw new Error(`Admin Next server did not start. ${output}`);
}

async function assertViewportSidePanel(page, label, shouldScroll) {
  const beforeScroll = await page.evaluate(() => {
    const visual = document.querySelector(".admin-auth-visual");
    const intro = document.querySelector(".admin-auth-intro");
    if (!(visual instanceof HTMLElement) || !(intro instanceof HTMLElement)) return null;
    const visualRect = visual.getBoundingClientRect();
    const introRect = intro.getBoundingClientRect();
    return {
      visualTop: visualRect.top,
      visualHeight: visualRect.height,
      introTop: introRect.top,
      introBottom: introRect.bottom,
      viewportHeight: window.innerHeight,
    };
  });
  assert.ok(beforeScroll, `${label} side panel was not rendered`);
  assert.equal(Math.abs(beforeScroll.visualTop) < 2, true, `${label} side panel did not start at the viewport top`);
  assert.equal(Math.abs(beforeScroll.visualHeight - beforeScroll.viewportHeight) < 2, true, `${label} side panel did not match viewport height`);
  assert.equal(beforeScroll.introTop >= 0, true, `${label} side-panel copy started outside the viewport`);
  assert.equal(beforeScroll.introBottom <= beforeScroll.viewportHeight, true, `${label} side-panel copy ended outside the viewport`);

  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(50);
  const afterScroll = await page.evaluate(() => {
    const visual = document.querySelector(".admin-auth-visual");
    if (!(visual instanceof HTMLElement)) return null;
    return { top: visual.getBoundingClientRect().top, scrollY: window.scrollY };
  });
  assert.ok(afterScroll, `${label} side panel disappeared after scrolling`);
  if (shouldScroll) assert.equal(afterScroll.scrollY > 0, true, `${label} page did not provide the expected form scroll`);
  assert.equal(Math.abs(afterScroll.top) < 2, true, `${label} side panel did not remain fixed while scrolling`);
}

const jsonHeaders = {
  "access-control-allow-origin": origin,
  "access-control-allow-credentials": "true",
  "content-type": "application/json",
};

try {
  await ready();
  const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE });
  const context = await browser.newContext({ serviceWorkers: "block" });
  const invitationCalls = [];
  const loginCalls = [];
  const validationCalls = [];
  const acceptanceCalls = [];
  const requestedAdminPaths = [];
  let failInvitation = false;
  let pauseInvitation = false;
  let releaseInvitation;

  await context.route(`${api}/api/v1/admin/**`, async (route) => {
    const request = route.request();
    const requestUrl = new URL(request.url());
    const path = requestUrl.pathname.replace("/api/v1/admin", "");
    requestedAdminPaths.push(requestUrl.pathname);

    if (path === "/auth/me") {
      return route.fulfill({
        status: 200,
        headers: jsonHeaders,
        body: JSON.stringify({ success: true, data: { admin: { userId: "1", fullName: "Amina Yusuf", email: "amina@example.test", phone: "+2348031234567", department: "MANAGEMENT", role: "SUPER_ADMIN", active: true } } }),
      });
    }
    if (path === "/auth/login") {
      loginCalls.push(request.postDataJSON());
      return route.fulfill({
        status: 200,
        headers: { ...jsonHeaders, "set-cookie": "admin-session=test; Path=/; HttpOnly" },
        body: JSON.stringify({ success: true, data: { admin: {} } }),
      });
    }
    if (path === "/invitations") {
      invitationCalls.push(request.postDataJSON());
      if (pauseInvitation) await new Promise((resolvePause) => (releaseInvitation = resolvePause));
      return route.fulfill({
        status: failInvitation ? 503 : 201,
        headers: jsonHeaders,
        body: JSON.stringify(failInvitation ? { success: false, error: { code: "AUTH_UNAVAILABLE", message: "Invitation delivery is temporarily unavailable." } } : { success: true, data: { invitation: { fullName: "Ada Okafor", email: "ada@example.test", expiresAt: new Date(Date.now() + 172800000).toISOString() } } }),
      });
    }
    if (path === "/invitations/validate") {
      const payload = request.postDataJSON();
      validationCalls.push(payload);
      if (payload.token.startsWith("b")) {
        return route.fulfill({
          status: 410,
          headers: jsonHeaders,
          body: JSON.stringify({ success: false, error: { code: "INVITATION_INVALID", message: "This invitation is invalid or expired." } }),
        });
      }
      return route.fulfill({
        status: 200,
        headers: jsonHeaders,
        body: JSON.stringify({ success: true, data: { invitation: { fullName: "Ada Okafor", email: "ada@example.test", department: "TECH", role: "ADMIN", expiresAt: new Date(Date.now() + 172800000).toISOString() } } }),
      });
    }
    if (path === "/invitations/accept") {
      acceptanceCalls.push(request.postDataJSON());
      return route.fulfill({ status: 200, headers: jsonHeaders, body: JSON.stringify({ success: true, data: { admin: {} } }) });
    }
    return route.abort();
  });

  const page = await context.newPage();
  page.setDefaultNavigationTimeout(60000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));

  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(origin);
    await page.getByRole("button", { name: "Invite Admin" }).click();
    await page.getByRole("dialog").waitFor();
    assert.equal(await page.getByLabel("Full Name").isVisible(), true);
    assert.equal(await page.getByLabel("Email Address").isVisible(), true);
    assert.equal(await page.getByLabel("Nigerian phone number").isVisible(), true);
    assert.equal(await page.getByRole("radio", { name: "Tech", exact: true }).isChecked(), true);
    assert.equal(await page.getByRole("radio", { name: "Admin", exact: true }).isChecked(), true);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `invitation dialog horizontal overflow at ${width}`);
    await page.getByRole("button", { name: "Cancel" }).click();
  }

  await page.getByRole("button", { name: "Invite Admin" }).focus();
  await page.getByRole("button", { name: "Invite Admin" }).click();
  assert.equal(await page.evaluate(() => document.body.style.overflow), "hidden");
  await page.keyboard.press("Escape");
  assert.equal(await page.getByRole("button", { name: "Invite Admin" }).evaluate((element) => element === document.activeElement), true);
  await page.getByRole("button", { name: "Invite Admin" }).click();
  await page.getByRole("button", { name: "Close invite admin dialog" }).click();
  await page.getByRole("button", { name: "Invite Admin" }).click();
  await page.getByRole("button", { name: "Send Invitation" }).click();
  assert.equal(await page.getByLabel("Full Name").evaluate((input) => input.validationMessage.length > 0), true);

  await page.getByLabel("Full Name").fill("Ada Okafor");
  await page.getByLabel("Email Address").fill("ada@example.test");
  await page.getByLabel("Nigerian phone number").fill("08031234567");
  await page.getByRole("radio", { name: "Management", exact: true }).check();
  await page.getByRole("radio", { name: "Super Admin", exact: true }).check();
  pauseInvitation = true;
  await page.getByRole("button", { name: "Send Invitation" }).click();
  await page.getByRole("button", { name: "Sending…" }).waitFor();
  assert.equal(await page.getByRole("button", { name: "Sending…" }).isDisabled(), true);
  assert.equal(invitationCalls.length, 1);
  releaseInvitation();
  pauseInvitation = false;
  await page.getByRole("heading", { name: "Invitation Sent" }).waitFor();
  assert.match(await page.getByRole("dialog").innerText(), /Ada Okafor.*ada@example\.test/s);
  assert.equal(invitationCalls[0].department, "MANAGEMENT");
  assert.equal(invitationCalls[0].role, "SUPER_ADMIN");
  await page.getByRole("button", { name: "Close invitation confirmation" }).click();

  await page.getByRole("button", { name: "Invite Admin" }).click();
  await page.getByLabel("Full Name").fill("Ada Okafor");
  await page.getByLabel("Email Address").fill("ada@example.test");
  await page.getByLabel("Nigerian phone number").fill("08031234567");
  failInvitation = true;
  await page.getByRole("button", { name: "Send Invitation" }).click();
  await page.getByText("Invitation delivery is temporarily unavailable.").waitFor();
  assert.equal(await page.getByRole("heading", { name: "Invitation Sent" }).count(), 0);
  assert.equal(await page.getByLabel("Full Name").inputValue(), "Ada Okafor");

  for (const width of [1440, 1280, 768, 430, 390, 360]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${origin}/login`);
    await page.getByRole("heading", { name: "Login to your admin account" }).waitFor();
    assert.equal(await page.getByText(/OTP|temporary password/i).count(), 0);
    assert.equal(await page.getByText(/Forgot Password/i).count(), 0);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `login horizontal overflow at ${width}`);
  }

  await page.setViewportSize({ width: 1440, height: 667 });
  await page.goto(`${origin}/login`);
  await page.getByRole("heading", { name: "Login to your admin account" }).waitFor();
  await assertViewportSidePanel(page, "login", false);

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${origin}/login`);
  await page.getByLabel("Email Address").fill("amina@example.test");
  await page.getByLabel("Password", { exact: true }).fill("ControlledPassword!9");
  await page.getByRole("button", { name: "Show password" }).click();
  assert.equal(await page.getByLabel("Password", { exact: true }).getAttribute("type"), "text");
  await page.getByRole("button", { name: "Hide password" }).click();
  await page.getByRole("button", { name: "Log In" }).click();
  await page.getByRole("heading", { name: "Admin Portal" }).waitFor();
  assert.equal(loginCalls.length, 1);
  assert.deepEqual(Object.keys(loginCalls[0]).sort(), ["email", "password"]);
  assert.equal(requestedAdminPaths.includes("/api/v1/admin/auth/login"), true);
  assert.equal(requestedAdminPaths.some((path) => path.includes("/api/v1/api/v1")), false);

  const validToken = "a".repeat(43);
  for (const width of [1440, 1280, 768, 430, 390, 360]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("about:blank");
    await page.goto(`${origin}/accept-invitation#token=${validToken}`);
    await page.getByText("ada@example.test").waitFor();
    assert.equal(await page.evaluate(() => window.location.hash), "");
    assert.equal(await page.getByText("Tech", { exact: true }).isVisible(), true);
    assert.equal(await page.getByText("Admin", { exact: true }).isVisible(), true);
    assert.equal(await page.locator("select").count(), 0);
    assert.equal(await page.getByRole("radio").count(), 0);
    assert.equal(await page.getByText(/OTP|temporary password/i).count(), 0);
    assert.equal(await page.getByText("This invitation is invalid or expired.", { exact: true }).count(), 0);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `invitation acceptance horizontal overflow at ${width}`);
  }

  await page.setViewportSize({ width: 1440, height: 667 });
  await page.goto("about:blank");
  await page.goto(`${origin}/accept-invitation#token=${validToken}`);
  await page.getByText("ada@example.test").waitFor();
  await assertViewportSidePanel(page, "invitation acceptance", true);

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("about:blank");
  await page.goto(`${origin}/accept-invitation#token=${validToken}`);
  await page.getByLabel("New Password", { exact: true }).fill("StrongPass!9");
  await page.getByLabel("Confirm New Password").fill("StrongPass!9");
  await page.getByRole("button", { name: "Show new password" }).click();
  assert.equal(await page.getByLabel("New Password", { exact: true }).getAttribute("type"), "text");
  await page.getByRole("button", { name: "Save new password" }).click();
  await page.getByText("Your Admin account is ready.").waitFor();
  assert.equal(acceptanceCalls.length, 1);
  assert.deepEqual(Object.keys(acceptanceCalls[0]).sort(), ["confirmPassword", "password", "token"]);

  await page.goto("about:blank");
  await page.goto(`${origin}/accept-invitation#token=${"b".repeat(43)}`);
  const invalidInvitationMessage = page.getByText("This invitation is invalid or expired.", { exact: true });
  await invalidInvitationMessage.waitFor();
  assert.equal(await invalidInvitationMessage.getAttribute("role"), "alert");
  assert.equal(validationCalls.length >= 7, true);
  assert.deepEqual(errors, []);
  await browser.close();
  console.log("Admin invitation/auth UI: focused invite, login, secure acceptance, API-path, and responsive checks passed at 1440/1280/768/430/390/360 (dialog also 320)");
} finally {
  server.kill();
}
