import { supabaseAdmin } from "../../config/supabase";
import { AppError } from "../../utils/AppError";
import type { AdminUserListInput } from "./admin-users.validators";

const unavailable = () => new AppError("Customer directory is temporarily unavailable", 503, "USERS_UNAVAILABLE");
type CustomerPersonaRow = {
  id: string;
  persona_type: "BUYER" | "SELLER_DEVELOPER";
  onboarding_status: string;
  activated_at: string | null;
  onboarding_completed_at: string | null;
};
const persona = (rows: CustomerPersonaRow[], type: CustomerPersonaRow["persona_type"]) =>
  rows.find((row) => row.persona_type === type);

export const listUsers = async (input: AdminUserListInput) => {
  const { data, error } = await supabaseAdmin.rpc("list_admin_customer_users", {
    p_query: input.q ?? null,
    p_role: input.role ?? null,
    p_verification: input.verification ?? null,
    p_sort: input.sort,
    p_page: input.page,
    p_limit: input.limit
  });
  if (error || !data) throw unavailable();
  return data;
};

export const getUserDetail = async (userId: string) => {
  const { data: customer, error: customerError } = await supabaseAdmin.from("profiles")
    .select("id,full_name,first_name,last_name,email,phone_number,referral_code,email_verified_at,created_at")
    .eq("id", userId).maybeSingle();
  if (customerError) throw unavailable();
  if (!customer) throw new AppError("Customer not found", 404, "ADMIN_USER_NOT_FOUND");

  const [recordResult, personasResult] = await Promise.all([
    supabaseAdmin.from("customer_records").select("user_id").eq("user_id", userId).maybeSingle(),
    supabaseAdmin.from("user_personas").select("id,persona_type,onboarding_status,activated_at,onboarding_completed_at").eq("user_id", userId)
  ]);
  if (recordResult.error || personasResult.error) throw unavailable();
  if (!recordResult.data) throw new AppError("Customer not found", 404, "ADMIN_USER_NOT_FOUND");

  const personas = (personasResult.data ?? []) as CustomerPersonaRow[];
  const buyerPersona = persona(personas, "BUYER");
  const sellerPersona = persona(personas, "SELLER_DEVELOPER");
  const [buyerResult, sellerResult] = await Promise.all([
    buyerPersona?.id
      ? supabaseAdmin.from("buyer_profiles").select("preferred_locations,budget_min,budget_max,currency").eq("user_persona_id", buyerPersona.id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    sellerPersona?.id
      ? supabaseAdmin.from("seller_profiles").select("profile_type,company_name,company_address").eq("user_persona_id", sellerPersona.id).maybeSingle()
      : Promise.resolve({ data: null, error: null })
  ]);
  if (buyerResult.error || sellerResult.error) throw unavailable();

  const buyerActivated = buyerPersona?.onboarding_status === "COMPLETED";
  const sellerActivated = sellerPersona?.onboarding_status === "COMPLETED";
  const referralCode = typeof customer.referral_code === "string" && customer.referral_code.trim() ? customer.referral_code : null;
  return {
    customer: {
      id: customer.id,
      fullName: customer.full_name || [customer.first_name, customer.last_name].filter(Boolean).join(" ") || "Unnamed customer",
      email: customer.email,
      phone: customer.phone_number,
      referralCode,
      verified: Boolean(customer.email_verified_at),
      joinedAt: customer.created_at,
      roles: [buyerActivated ? "BUYER" : null, sellerActivated ? "SELLER" : null, referralCode ? "REFERRER" : null].filter(Boolean)
    },
    buyerProfile: {
      activated: buyerActivated,
      activatedAt: buyerActivated ? buyerPersona.onboarding_completed_at : null,
      preferredAreas: buyerActivated ? buyerResult.data?.preferred_locations ?? [] : [],
      budgetMin: buyerActivated ? buyerResult.data?.budget_min ?? null : null,
      budgetMax: buyerActivated ? buyerResult.data?.budget_max ?? null : null,
      currency: buyerActivated ? buyerResult.data?.currency ?? null : null
    },
    sellerProfile: {
      activated: sellerActivated,
      activatedAt: sellerActivated ? sellerPersona.onboarding_completed_at : null,
      sellerType: sellerActivated ? sellerResult.data?.profile_type ?? null : null,
      companyName: sellerActivated ? sellerResult.data?.company_name ?? null : null,
      companyAddress: sellerActivated ? sellerResult.data?.company_address ?? null : null
    },
    referrerProfile: { activated: Boolean(referralCode), referralCode, activatedAt: null }
  };
};
