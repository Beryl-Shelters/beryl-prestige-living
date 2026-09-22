import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function isMain(moduleUrl) {
  return !!process.argv[1] && resolve(process.argv[1]) === fileURLToPath(moduleUrl);
}

// Standalone and combined runs use exactly the same worker. Process isolation
// also resets imported mock state, media preferences, permissions and listeners.
export function runSuites(suites = ["auth", "dashboard", "listings", "analytics", "messages", "properties", "referrals", "settings", "kyc", "landing", "public-pages", "public-analytics", "public-referrals", "public-support", "public-buy", "public-header"]) {
  for (const suite of suites) {
    if (!["auth", "dashboard", "listings", "analytics", "messages", "properties", "referrals", "settings", "kyc", "landing", "public-pages", "public-analytics", "public-referrals", "public-support", "public-buy", "public-header"].includes(suite)) throw new Error(`Unknown suite: ${suite}`);
    console.log(`Running isolated ${suite} browser suite`);
    const result = spawnSync(process.execPath, [fileURLToPath(new URL("./auth-ui.browser.mjs", import.meta.url)), `--suite=${suite}`], { stdio: "inherit" });
    if (result.error) console.error(result.error);
    if (result.status !== 0) return result.status ?? 1;
  }
  return 0;
}

export function runIfMain(moduleUrl, suite) {
  if (isMain(moduleUrl)) process.exitCode = runSuites([suite]);
}

if (isMain(import.meta.url)) process.exitCode = runSuites();
