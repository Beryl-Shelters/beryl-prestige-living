import { supabaseAdmin } from "../../config/supabase";
import { AppError } from "../../utils/AppError";

const privilegedRoles = ["admin", "support_agent", "super_admin"];

export const getOptionalUserIdFromToken = async (token?: string) => {
  if (!token) return null;

  const { data, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !data.user) return null;

  return data.user.id;
};

export const getUserRole = async (userId: string) => {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (error || !data) {
    throw new AppError("Profile not found", 404);
  }

  return data.role;
};

export const createInquiry = async (
  payload: Record<string, any>,
  userId?: string | null
) => {
  if (payload.property_id) {
    const { data: property, error: propertyError } = await supabaseAdmin
      .from("properties")
      .select("id")
      .eq("id", payload.property_id)
      .single();

    if (propertyError || !property) {
      throw new AppError("Property not found", 404);
    }
  }

  const { data, error } = await supabaseAdmin
    .from("inquiries")
    .insert({
      user_id: userId || null,
      property_id: payload.property_id || null,
      inquiry_type: payload.inquiry_type,
      full_name: payload.full_name,
      email: payload.email,
      phone_number: payload.phone_number,
      message: payload.message,
      status: "pending"
    })
    .select("*")
    .single();

  if (error) {
    throw new AppError(error.message, 400);
  }

  return data;
};

export const getMyInquiries = async (
  userId: string,
  query: Record<string, any>
) => {
  const page = Number(query.page || 1);
  const limit = Number(query.limit || 10);
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const { data, error, count } = await supabaseAdmin
    .from("inquiries")
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
      )
    `,
      { count: "exact" }
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    throw new AppError(error.message, 400);
  }

  return {
    inquiries: data,
    pagination: {
      page,
      limit,
      total: count || 0,
      total_pages: Math.ceil((count || 0) / limit)
    }
  };
};

export const getInquiryById = async (
  inquiryId: string,
  userId: string
) => {
  const { data: inquiry, error } = await supabaseAdmin
    .from("inquiries")
    .select(
      `
      *,
      property:properties (
        id,
        title,
        property_code,
        price,
        thumbnail_url,
        status,
        owner_id
      )
    `
    )
    .eq("id", inquiryId)
    .single();

  if (error || !inquiry) {
    throw new AppError("Inquiry not found", 404);
  }

  const role = await getUserRole(userId);

  const isOwner = inquiry.user_id === userId;
  const isPrivileged = privilegedRoles.includes(role);

  if (!isOwner && !isPrivileged) {
    throw new AppError("You are not allowed to view this inquiry", 403);
  }

  return inquiry;
};

export const updateInquiryStatus = async (
  inquiryId: string,
  payload: Record<string, any>
) => {
  const updateData: Record<string, any> = {
    status: payload.status
  };

  if (payload.assigned_to) {
    updateData.assigned_to = payload.assigned_to;
  }

  const { data, error } = await supabaseAdmin
    .from("inquiries")
    .update(updateData)
    .eq("id", inquiryId)
    .select("*")
    .single();

  if (error || !data) {
    throw new AppError(error?.message || "Inquiry not found", 404);
  }

  return data;
};