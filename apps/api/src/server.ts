import "dotenv/config";

import { createApp } from "./app.js";
import { loadEnvironment } from "./config/env.js";
import { loadAuthConfig } from "./auth/config.js";

const environment = loadEnvironment();
const trustProxyHops = Number(process.env.TRUST_PROXY_HOPS || 0);
if (!Number.isInteger(trustProxyHops) || trustProxyHops < 0 || trustProxyHops > 5) throw new Error("TRUST_PROXY_HOPS must be an integer from 0 to 5.");
const app = createApp({ webAppUrl: environment.webAppUrl, auth: loadAuthConfig(process.env), trustProxyHops });

app.listen(environment.port, () => {
  console.log(`Beryl Shelter API listening on port ${environment.port}`);
});
