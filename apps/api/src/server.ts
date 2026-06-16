import "dotenv/config";
import app from "./app";
import { env } from "./config/env";


app.listen(env.port, () => {
  console.log(`Beryl Prestige Living API running on port ${env.port}`);
});
