import { supabaseAdmin } from "../../config/supabase";
import { AppError } from "../../utils/AppError";
import { uploadImage } from "../../utils/cloudinary";

const blockedFields = [
  "email",
  "role",
  "referral_code",
  "verification_status",
  "is_active",
  "created_at",
  "updated_at"
];

export const getMyProfile = async (userId: string) => {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (error || !data) {
    throw new AppError("Profile not found", 404);
  }

  return data;
};

export const updateMyProfile = async (
  userId: string,
  payload: Record<string, unknown>
) => {
  for (const field of blockedFields) {
    if (field in payload) {
      throw new AppError(`You cannot update ${field}`, 400);
    }
  }

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .update(payload)
    .eq("id", userId)
    .select("*")
    .single();

  if (error || !data) {
    throw new AppError(error?.message || "Profile update failed", 400);
  }

  return data;
};

export const changeMyPassword = async (
  userId: string,
  newPassword: string
) => {
  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    password: newPassword
  });

  if (error) {
    throw new AppError(error.message, 400);
  }

  return true;
};

export const updateMyAvatar = async (
  userId: string,
  file?: Express.Multer.File
) => {
  if (!file) {
    throw new AppError("Avatar image is required", 400);
  }

  const avatarUrl = await uploadImage(
    file.buffer,
    "beryl-prestige/profiles"
  );

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .update({ avatar_url: avatarUrl })
    .eq("id", userId)
    .select("*")
    .single();

  if (error || !data) {
    throw new AppError(error?.message || "Avatar update failed", 400);
  }

  return data;
};