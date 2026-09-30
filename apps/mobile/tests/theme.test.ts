import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { test } from "node:test";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

test("Theme tokens satisfy Executive Update palette requirements", () => {
  const tokens = read("src/theme/tokens.ts");
  // Dark mode canvas must be near-black charcoal, not pure black
  assert.match(tokens, /background:\s*"#0D1117"/);
  // Elevated card surfaces
  assert.match(tokens, /surface:\s*"#161F28"/);
  assert.match(tokens, /surfaceMuted:\s*"#1A232F"/);
  // Off-white primary text and muted secondary text
  assert.match(tokens, /text:\s*"#F1F5F9"/);
  assert.match(tokens, /textMuted:\s*"#94A3B8"/);
  // Restrained borders
  assert.match(tokens, /border:\s*"#283545"/);
  // Warm Beryl bronze accent
  assert.match(tokens, /brand:\s*"#C58B43"/);
  // Semantic colors
  assert.match(tokens, /success:\s*"#22C55E"/);
  assert.match(tokens, /warning:\s*"#F59E0B"/);
  assert.match(tokens, /danger:\s*"#EF4444"/);
  // getColors function present
  assert.match(tokens, /function getColors/);
});

test("Mobile Root Layout embeds ThemeProvider and dynamic StatusBar", () => {
  const layout = read("app/_layout.tsx");
  assert.match(layout, /ThemeProvider/);
  assert.match(layout, /useTheme/);
  assert.match(layout, /StatusBar style=\{effectiveTheme === "dark" \? "light" : "dark"\}/);
  assert.match(layout, /backgroundColor: colors\.background/);
  assert.match(layout, /backgroundColor: colors\.surface/);
});

test("Mobile Tabs Layout consumes dynamic theme tokens", () => {
  const layout = read("app/(tabs)/_layout.tsx");
  assert.match(layout, /useTheme/);
  assert.match(layout, /tabBarActiveTintColor: colors\.brandDark/);
  assert.match(layout, /backgroundColor: colors\.surface/);
  assert.match(layout, /borderTopColor: colors\.border/);
});

test("Mobile Account screen provides System, Light, and Dark appearance selection", () => {
  const account = read("app/(tabs)/account.tsx");
  assert.match(account, /Appearance/);
  assert.match(account, /setThemePreference/);
  assert.match(account, /"system"/);
  assert.match(account, /"light"/);
  assert.match(account, /"dark"/);
  assert.match(account, /ThemeCard/);
});

test("Mobile ThemeProvider handles system, light, dark and local persistence", () => {
  const appConfig = JSON.parse(read("app.json"));
  assert.equal(appConfig.expo.userInterfaceStyle, "automatic");
  const provider = read("src/providers/theme-provider.tsx");
  assert.match(provider, /STORAGE_KEY = "beryl_mobile_theme"/);
  assert.match(provider, /LEGACY_STORAGE_KEY = "beryl\.v2\.customer\.theme_preference"/);
  assert.match(provider, /useColorScheme/);
  assert.match(provider, /SecureStore/);
  assert.match(provider, /effectiveTheme/);
  assert.match(provider, /setThemePreference/);
});

test("UI components integrate useTheme for dynamic styling and accessible contrast", () => {
  const ui = read("src/components/ui.tsx");
  assert.match(ui, /useTheme/);
  assert.match(ui, /backgroundColor: themeColors\.background/);
  assert.match(ui, /backgroundColor: themeColors\.surface/);
  assert.match(ui, /borderColor: themeColors\.border/);
  assert.match(ui, /color: themeColors\.text/);
});

test("Mobile app screens and components do not import static colors from tokens", () => {
  function scan(dir: string): string[] {
    const results: string[] = [];
    for (const item of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, item.name);
      if (item.isDirectory() && !["node_modules", ".expo", "dist", "tests"].includes(item.name)) {
        results.push(...scan(full));
      } else if (item.isFile() && /\.(tsx|ts)$/.test(item.name) && !item.name.endsWith(".d.ts") && !full.includes("tokens.ts")) {
        results.push(full);
      }
    }
    return results;
  }
  const files = scan(join(root, "app")).concat(scan(join(root, "src")));
  const offenders: string[] = [];
  for (const f of files) {
    const content = readFileSync(f, "utf8");
    if (/from\s+["']@\/theme\/tokens["']/.test(content)) {
      const importMatch = content.match(/import\s+\{([^}]+)\}\s+from\s+["']@\/theme\/tokens["']/);
      if (importMatch && importMatch[1] && /\bcolors\b/.test(importMatch[1])) {
        offenders.push(relative(root, f));
      }
    }
  }
  assert.deepEqual(offenders, [], `Found files importing static colors: ${offenders.join(", ")}`);
});
