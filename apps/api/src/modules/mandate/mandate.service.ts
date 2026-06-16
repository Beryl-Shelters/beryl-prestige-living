import { supabaseAdmin } from "../../config/supabase";
import { AppError } from "../../utils/AppError";
import {
  deleteImageFromCloudinary,
  uploadImageWithPublicId
} from "../../utils/cloudinary";

const staffRoles = ["admin", "support_agent", "super_admin"];

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

export const createMandate = async (
  userId: string,
  payload: Record<string, any>,
  file?: Express.Multer.File
) => {
  if (!payload.terms_accepted) {
    throw new AppError("Terms must be accepted", 400);
  }

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

  let documentUrl: string | null = null;
  let cloudinaryPublicId: string | null = null;

  if (file) {
    const uploaded = await uploadImageWithPublicId(
      file.buffer,
      "beryl-prestige/mandates"
    );

    documentUrl = uploaded.secure_url;
    cloudinaryPublicId = uploaded.public_id;
  }

  const { data, error } = await supabaseAdmin
    .from("mandates")
    .insert({
      user_id: userId,
      property_id: payload.property_id || null,
      mandate_type: payload.mandate_type,
      status: "pending",
      full_name: payload.full_name,
      email: payload.email,
      phone_number: payload.phone_number,
      address: payload.address,
      nationality: payload.nationality || null,
      date_of_birth: payload.date_of_birth || null,
      title_document: payload.title_document || null,
      document_url: documentUrl,
      cloudinary_public_id: cloudinaryPublicId,
      signature_data: payload.signature_data || null,
      terms_accepted: payload.terms_accepted,
      submitted_at: new Date().toISOString()
    })
    .select("*")
    .single();

  if (error) {
    throw new AppError(error.message, 400);
  }

  return data;
};

export const getMyMandates = async (
  userId: string,
  query: Record<string, any>
) => {
  const page = Number(query.page || 1);
  const limit = Number(query.limit || 10);
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const { data, error, count } = await supabaseAdmin
    .from("mandates")
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
    mandates: data,
    pagination: {
      page,
      limit,
      total: count || 0,
      total_pages: Math.ceil((count || 0) / limit)
    }
  };
};

export const getMandateById = async (
  mandateId: string,
  userId: string
) => {
  const { data: mandate, error } = await supabaseAdmin
    .from("mandates")
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
      user:profiles!mandates_user_id_fkey (
        id,
        first_name,
        last_name,
        email,
        phone_number,
        role
      )
    `
    )
    .eq("id", mandateId)
    .single();

  if (error || !mandate) {
    throw new AppError("Mandate not found", 404);
  }

  const role = await getUserRole(userId);
  const isOwner = mandate.user_id === userId;
  const isStaff = staffRoles.includes(role);

  if (!isOwner && !isStaff) {
    throw new AppError("You are not allowed to view this mandate", 403);
  }

  return mandate;
};

export const getAdminMandates = async (query: Record<string, any>) => {
  const page = Number(query.page || 1);
  const limit = Number(query.limit || 10);
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let request = supabaseAdmin
    .from("mandates")
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
      user:profiles!mandates_user_id_fkey (
        id,
        first_name,
        last_name,
        email,
        phone_number,
        role
      )
    `,
      { count: "exact" }
    );

  if (query.status) {
    request = request.eq("status", query.status);
  }

  if (query.mandate_type) {
    request = request.eq("mandate_type", query.mandate_type);
  }

  const { data, error, count } = await request
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    throw new AppError(error.message, 400);
  }

  return {
    mandates: data,
    pagination: {
      page,
      limit,
      total: count || 0,
      total_pages: Math.ceil((count || 0) / limit)
    }
  };
};

export const reviewMandate = async (
  mandateId: string,
  reviewerId: string,
  payload: Record<string, any>
) => {
  const updateData: Record<string, any> = {
    status: payload.status,
    reviewed_by: reviewerId,
    reviewed_at: new Date().toISOString()
  };

  if (payload.status === "rejected") {
    updateData.rejection_reason = payload.rejection_reason || null;
  }

  const { data, error } = await supabaseAdmin
    .from("mandates")
    .update(updateData)
    .eq("id", mandateId)
    .select("*")
    .single();

  if (error || !data) {
    throw new AppError(error?.message || "Mandate not found", 404);
  }

  return data;
};

export const deleteMandate = async (
  mandateId: string,
  userId: string
) => {
  const mandate = await getMandateById(mandateId, userId);
  const role = await getUserRole(userId);
  const isOwner = mandate.user_id === userId;
  const isStaff = staffRoles.includes(role);

  if (!isOwner && !isStaff) {
    throw new AppError("You are not allowed to delete this mandate", 403);
  }

  if (!isStaff && mandate.status !== "pending") {
    throw new AppError("Only pending mandates can be deleted by user", 400);
  }

  if (mandate.cloudinary_public_id) {
    await deleteImageFromCloudinary(mandate.cloudinary_public_id);
  }

  const { error } = await supabaseAdmin
    .from("mandates")
    .delete()
    .eq("id", mandateId);

  if (error) {
    throw new AppError(error.message, 400);
  }

  return true;
};