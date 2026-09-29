import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (path) => readFileSync(join(root, path), "utf8");

test("AdminThemeProvider handles system, light, dark and anti-flash script", () => {
  const provider = read("components/theme-provider.tsx");
  assert.match(provider, /STORAGE_KEY = "beryl_admin_theme"/);
  assert.match(provider, /useSyncExternalStore/);
  assert.match(provider, /document\.documentElement\.setAttribute\("data-theme", resolvedTheme\)/);
  assert.match(provider, /document\.documentElement\.style\.colorScheme = resolvedTheme/);
  assert.match(provider, /export const adminThemeScript/);
});

test("AdminThemeToggle has accessible System, Light, and Dark options", () => {
  const toggle = read("components/theme-toggle.tsx");
  assert.match(toggle, /role="radiogroup"/);
  assert.match(toggle, /role="radio"/);
  assert.match(toggle, /aria-checked=\{isSelected\}/);
  assert.match(toggle, /value: "system"/);
  assert.match(toggle, /value: "light"/);
  assert.match(toggle, /value: "dark"/);
});

test("AdminAppShell embeds AdminThemeToggle in topbar", () => {
  const shell = read("components/admin-app-shell.tsx");
  assert.match(shell, /import { AdminThemeToggle } from "\.\/theme-toggle"/);
  assert.match(shell, /<AdminThemeToggle \/>/);
});

test("Admin Property Review Reject button hover defect is definitively resolved", () => {
  const css = read("app/admin-app.css");
  // Ensure property-reject has an explicit hover state and does NOT fall back to brown button:hover
  assert.match(css, /\.property-reject:hover\s*\{[^}]*background:\s*#fee2e2/);
  assert.match(css, /\.property-reject:hover\s*\{[^}]*color:\s*#991b1b/);
  assert.match(css, /\.property-reject:active\s*\{[^}]*background:\s*#fecaca/);
  assert.match(css, /\.property-reject:focus-visible\s*\{[^}]*outline:\s*3px solid #dc2626/);

  // Dark mode hover state
  assert.match(css, /\[data-theme="dark"\] \.property-reject:hover/);

  // Approve button hover state
  assert.match(css, /\.property-approve:hover\s*\{[^}]*background:\s*#116938/);

  // Withdrawal reject button hover state
  assert.match(css, /\.withdrawal-admin-actions \.reject-withdrawal:hover\s*\{[^}]*background:\s*#fee2e2/);
});

test("Admin Dark mode styles satisfy Executive Update palette", () => {
  const globals = read("app/globals.css");
  assert.match(globals, /\[data-theme="dark"\]/);
  assert.match(globals, /--surface:\s*#0d1117/);
  assert.match(globals, /--panel:\s*#161f28/);
  assert.match(globals, /--card-bg:\s*#1a232f/);
  assert.match(globals, /--ink:\s*#f1f5f9/);
  assert.match(globals, /--muted:\s*#94a3b8/);

  const adminApp = read("app/admin-app.css");
  assert.match(adminApp, /\[data-theme="dark"\] \.admin-app-shell/);
  assert.match(adminApp, /\[data-theme="dark"\] \.admin-sidebar/);
  assert.match(adminApp, /\[data-theme="dark"\] \.admin-topbar/);
  assert.match(adminApp, /\[data-theme="dark"\] \.customer-table-card/);
});
