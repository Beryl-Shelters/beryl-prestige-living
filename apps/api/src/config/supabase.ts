import { createClient } from "@supabase/supabase-js";
import { env } from "./env";
import { validateSupabaseEnvironment } from "./supabase-environment";

const supabaseUrl = env.supabaseUrl;
const supabaseAnonKey = env.supabaseAnonKey;
const supabaseServiceRoleKey = env.supabaseServiceRoleKey;

if (!supabaseUrl) {
  throw new Error("Missing SUPABASE_URL in .env");
}

if (!supabaseAnonKey) {
  throw new Error("Missing SUPABASE_ANON_KEY in .env");
}

if (!supabaseServiceRoleKey) {
  throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY in .env");
}

validateSupabaseEnvironment({
  deploymentEnvironment:
    env.deploymentEnvironment || (process.env.VITEST ? "test" : undefined),
  supabaseUrl,
  expectedProjectRef: env.expectedSupabaseProjectRef
});

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

export const supabaseAdmin = createClient(
  supabaseUrl,
  supabaseServiceRoleKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

const decodeJwtRole = (token?: string) => {
  if (!token) return "missing";

  const payload = JSON.parse(
    Buffer.from(token.split(".")[1], "base64").toString()
  );

  return payload.role;
};
