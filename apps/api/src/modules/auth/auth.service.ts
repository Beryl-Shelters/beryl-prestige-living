import { supabaseAdmin, supabase } from "../../config/supabase";
import { AppError } from "../../utils/AppError";

type RegisterInput = {
  first_name: string;
  last_name: string;
  email: string;
  phone_number?: string;
  password: string;
  role:
    | "investor"
    | "property_developer"
    | "landlord"
    | "registered_agent"
    | "freelance_agent";
  profile_type: "personal" | "business";
  referral_code?: string;
};

export const registerUser = async (payload: RegisterInput) => {
  const { data: authData, error: authError } =
    await supabaseAdmin.auth.admin.createUser({
      email: payload.email,
      password: payload.password,
      email_confirm: true,
      user_metadata: {
        first_name: payload.first_name,
        last_name: payload.last_name,
        role: payload.role,
        profile_type: payload.profile_type
      }
    });

  if (authError) {
    throw new AppError(authError.message, 400);
  }

  if (!authData.user) {
    throw new AppError("User registration failed", 400);
  }

  let referredBy: string | null = null;

  if (payload.referral_code) {
    const { data: referrer } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("referral_code", payload.referral_code)
      .maybeSingle();

    if (referrer) {
      referredBy = referrer.id;
    }
  }

  const generatedReferralCode = `BPL-${Math.random()
    .toString(36)
    .substring(2, 10)
    .toUpperCase()}`;

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .insert({
      id: authData.user.id,
      first_name: payload.first_name,
      last_name: payload.last_name,
      email: payload.email,
      phone_number: payload.phone_number,
      role: payload.role,
      profile_type: payload.profile_type,
      referral_code: generatedReferralCode,
      referred_by: referredBy
    })
    .select()
    .single();

  if (profileError) {
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
    throw new AppError(profileError.message, 400);
  }

  return {
    user: authData.user,
    profile
  };
};

export const loginUser = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    throw new AppError(error.message, 401);
  }

  if (!data.user || !data.session) {
    throw new AppError("Invalid login credentials", 401);
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("*")
    .eq("id", data.user.id)
    .single();

  if (profileError) {
    throw new AppError("Profile not found", 404);
  }

  await supabaseAdmin
    .from("profiles")
    .update({ last_login_at: new Date().toISOString() })
    .eq("id", data.user.id);

  return {
    user: data.user,
    session: data.session,
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    profile
  };
};

export const getCurrentUser = async (userId: string) => {
  const { data: profile, error } = await supabaseAdmin
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (error) {
    throw new AppError("Profile not found", 404);
  }

  return profile;
};