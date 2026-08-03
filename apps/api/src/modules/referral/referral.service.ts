import { env } from "../../config/env";
import { supabaseAdmin } from "../../config/supabase";
import { AppError } from "../../utils/AppError";

const PUBLIC_WEB_URL = env.clientWebUrl;

export const getReferralDashboard = async (userId: string) => {
  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("id, referral_code")
    .eq("id", userId)
    .single();

  if (profileError || !profile) {
    throw new AppError("Profile not found", 404);
  }

  const { data: referrals, error } = await supabaseAdmin
    .from("referrals")
    .select("*")
    .eq("referrer_id", userId);

  if (error) {
    throw new AppError(error.message, 400);
  }

  const totalEarnings =
    referrals?.reduce(
      (sum, item) => sum + Number(item.earned_commission || 0),
      0
    ) || 0;

  const propertiesSoldCount =
    referrals?.filter((item) => item.status === "converted").length || 0;

  return {
    available_balance: totalEarnings,
    total_earnings: totalEarnings,
    referrals_count: referrals?.length || 0,
    properties_sold_count: propertiesSoldCount,
    referral_code: profile.referral_code,
    referral_link: `${PUBLIC_WEB_URL}/register?ref=${profile.referral_code}`
  };
};

export const getMyReferralList = async (
  userId: string,
  query: Record<string, any>
) => {
  const page = Number(query.page || 1);
  const limit = Number(query.limit || 10);
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const { data, error, count } = await supabaseAdmin
    .from("referrals")
    .select(
      `
      *,
      property:properties (
        id,
        title,
        property_code,
        price,
        thumbnail_url,
        status
      ),
      registered_user:profiles!referrals_registered_user_id_fkey (
        id,
        first_name,
        last_name,
        email,
        phone_number
      )
    `,
      { count: "exact" }
    )
    .eq("referrer_id", userId)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    throw new AppError(error.message, 400);
  }

  return {
    referrals: data,
    pagination: {
      page,
      limit,
      total: count || 0,
      total_pages: Math.ceil((count || 0) / limit)
    }
  };
};

export const generatePropertyReferralLink = async (
  userId: string,
  propertyId: string
) => {
  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("referral_code")
    .eq("id", userId)
    .single();

  if (profileError || !profile) {
    throw new AppError("Profile not found", 404);
  }

  const { data: property, error: propertyError } = await supabaseAdmin
    .from("properties")
    .select("id")
    .eq("id", propertyId)
    .single();

  if (propertyError || !property) {
    throw new AppError("Property not found", 404);
  }

  const referralLink = `${PUBLIC_WEB_URL}/properties/${propertyId}?ref=${profile.referral_code}`;

  return {
    property_id: propertyId,
    referral_code: profile.referral_code,
    referral_link: referralLink
  };
};

export const generateSellerReferralLink = async (userId: string) => {
  const { data: profile, error } = await supabaseAdmin
    .from("profiles")
    .select("referral_code")
    .eq("id", userId)
    .single();

  if (error || !profile) {
    throw new AppError("Profile not found", 404);
  }

  return {
    referral_code: profile.referral_code,
    referral_link: `${PUBLIC_WEB_URL}/register?type=seller&ref=${profile.referral_code}`
  };
};

export const trackReferral = async (
  payload: Record<string, any>,
  loggedInUserId?: string | null
) => {
  const { data: referrer, error: referrerError } = await supabaseAdmin
    .from("profiles")
    .select("id, referral_code")
    .eq("referral_code", payload.referral_code)
    .single();

  if (referrerError || !referrer) {
    throw new AppError("Invalid referral code", 404);
  }

  if (loggedInUserId && loggedInUserId === referrer.id) {
    throw new AppError("Self-referral is not allowed", 400);
  }

  if (payload.property_id) {
    const { data: property, error: propertyError } = await supabaseAdmin
      .from("properties")
      .select("id, price")
      .eq("id", payload.property_id)
      .single();

    if (propertyError || !property) {
      throw new AppError("Property not found", 404);
    }
  }

  const referralLink = payload.property_id
    ? `${PUBLIC_WEB_URL}/properties/${payload.property_id}?ref=${payload.referral_code}`
    : `${PUBLIC_WEB_URL}/register?type=${payload.referral_type}&ref=${payload.referral_code}`;

  const { data, error } = await supabaseAdmin
    .from("referrals")
    .insert({
      referrer_id: referrer.id,
      referral_type: payload.referral_type,
      property_id: payload.property_id || null,
      referral_code: payload.referral_code,
      referral_link: referralLink,
      referred_name: payload.referred_name || null,
      referred_email: payload.referred_email || null,
      referred_phone: payload.referred_phone || null,
      notes: payload.notes || null,
      status: "pending",
      commission_rate: 2,
      registered_user_id: loggedInUserId || null
    })
    .select("*")
    .single();

  if (error) {
    throw new AppError(error.message, 400);
  }

  return data;
};

export const updateReferralStatus = async (
  referralId: string,
  payload: Record<string, any>
) => {
  const updateData: Record<string, any> = {
    status: payload.status
  };

  if (payload.status === "converted") {
    updateData.converted_at = new Date().toISOString();

    if (payload.earned_commission !== undefined) {
      updateData.earned_commission = payload.earned_commission;
    }
  }

  const { data, error } = await supabaseAdmin
    .from("referrals")
    .update(updateData)
    .eq("id", referralId)
    .select("*")
    .single();

  if (error || !data) {
    throw new AppError(error?.message || "Referral not found", 404);
  }

  return data;
};
