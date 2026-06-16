import { supabaseAdmin } from "../config/supabase";
import { AppError } from "./AppError";

export const createNotification = async ({
  userId,
  type,
  title,
  message,
  metadata = {}
}: {
  userId: string;
  type: string;
  title: string;
  message: string;
  metadata?: Record<string, any>;
}) => {
  const { data, error } = await supabaseAdmin
    .from("notifications")
    .insert({
      user_id: userId,
      type,
      title,
      message,
      metadata,
      is_read: false
    })
    .select("*")
    .single();

  if (error) {
    throw new AppError(error.message, 400);
  }

  return data;
};