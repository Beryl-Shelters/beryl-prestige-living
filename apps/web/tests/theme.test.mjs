import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (path) => readFileSync(join(root, path), "utf8");

test("Web ThemeProvider handles system, light, dark and anti-flash script", () => {
  const provider = read("components/theme/theme-provider.tsx");
  assert.match(provider, /STORAGE_KEY = "beryl_theme"/);
  assert.match(provider, /useSyncExternalStore/);
  assert.match(provider, /document\.documentElement\.setAttribute\("data-theme", resolvedTheme\)/);
  assert.match(provider, /document\.documentElement\.style\.colorScheme = resolvedTheme/);
  assert.match(provider, /export const themeScript/);
});

test("Web ThemeToggle has accessible System, Light, and Dark options", () => {
  const toggle = read("components/theme/theme-toggle.tsx");
  assert.match(toggle, /role="radiogroup"/);
  assert.match(toggle, /role="radio"/);
  assert.match(toggle, /aria-checked=\{isSelected\}/);
  assert.match(toggle, /value: "system"/);
  assert.match(toggle, /value: "light"/);
  assert.match(toggle, /value: "dark"/);
});

test("Web globals.css satisfies Executive Update dark palette and token structure", () => {
  const css = read("app/globals.css");
  assert.match(css, /--surface:\s*#0d1117/);
  assert.match(css, /--panel:\s*#161f28/);
  assert.match(css, /--card-bg:\s*#1a232f/);
  assert.match(css, /--ink:\s*#f1f5f9/);
  assert.match(css, /--muted:\s*#94a3b8/);
  assert.match(css, /--line:\s*#283545/);
  assert.match(css, /--gold:\s*#c58b43/);
  assert.match(css, /\[data-theme="dark"\]/);
  assert.match(css, /@media \(prefers-color-scheme: dark\)/);
});

test("Web RootLayout embeds anti-flash script in head and wraps ThemeProvider", () => {
  const layout = read("app/layout.tsx");
  assert.match(layout, /<head>\s*<script dangerouslySetInnerHTML=\{\{ __html: themeScript \}\} \/>\s*<\/head>/);
  assert.match(layout, /<ThemeProvider>/);
});

test("Web PublicHeader and DashboardShell integrate ThemeToggle", () => {
  const header = read("components/auth/public-header.tsx");
  assert.match(header, /import { ThemeToggle } from "\.\.\/theme\/theme-toggle"/);
  assert.match(header, /<ThemeToggle \/>/);

  const dashboard = read("components/dashboard/dashboard-shell.tsx");
  assert.match(dashboard, /import { ThemeToggle } from "\.\.\/theme\/theme-toggle"/);
  assert.match(dashboard, /<ThemeToggle showLabels \/>/);
});
