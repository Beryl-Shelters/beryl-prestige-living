import { randomBytes, scryptSync } from "node:crypto";
import { env } from "../config/env";
import { supabaseAdmin } from "../config/supabase";

const INITIAL_SUPER_ADMIN_EMAIL = "berylsshelter@gmail.com";

const hashPassword = (password: string) => {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `scrypt$16384$8$1$${salt.toString("base64")}$${hash.toString("base64")}`;
};

const seedInitialSuperAdmin = async () => {
  if (!env.initialSuperAdminPassword) {
    throw new Error("INITIAL_SUPER_ADMIN_PASSWORD is required to seed the Super Admin");
  }

  if (
    env.initialSuperAdminPassword.length < 8 ||
    !/[A-Za-z]/.test(env.initialSuperAdminPassword) ||
    !/\d/.test(env.initialSuperAdminPassword)
  ) {
    throw new Error(
      "INITIAL_SUPER_ADMIN_PASSWORD must contain at least 8 characters, one letter, and one number"
    );
  }

  const { data: existing, error: lookupError } = await supabaseAdmin
    .from("admins")
    .select("id")
    .eq("email", INITIAL_SUPER_ADMIN_EMAIL)
    .maybeSingle();

  if (lookupError) throw lookupError;
  if (existing) {
    console.log("Initial Super Admin already exists; no changes made");
    return;
  }

  const { error } = await supabaseAdmin.from("admins").insert({
    full_name: "Beryl Shelter Super Admin",
    email: INITIAL_SUPER_ADMIN_EMAIL,
    department: "MANAGEMENT",
    admin_role: "SUPER_ADMIN",
    status: "ACTIVE",
    password_hash: hashPassword(env.initialSuperAdminPassword),
    requires_password_change: true
  });

  if (error) {
    if (error.code === "23505") {
      console.log("Initial Super Admin already exists; no changes made");
      return;
    }
    throw error;
  }

  console.log("Initial Super Admin seeded and requires a password change");
};

seedInitialSuperAdmin().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown seed failure";
  console.error(`Initial Super Admin seed failed: ${message}`);
  process.exitCode = 1;
});
