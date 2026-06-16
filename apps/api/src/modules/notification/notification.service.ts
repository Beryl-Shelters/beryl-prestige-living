import { supabaseAdmin } from "../../config/supabase";
import { AppError } from "../../utils/AppError";
import { createNotification } from "../../utils/notification";

export const getMyNotifications = async (
  userId: string,
  query: Record<string, any>
) => {
  const page = Number(query.page || 1);
  const limit = Number(query.limit || 10);
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let request = supabaseAdmin
    .from("notifications")
    .select("*", { count: "exact" })
    .eq("user_id", userId);

  if (query.is_read !== undefined) {
    request = request.eq("is_read", query.is_read === "true");
  }

  if (query.type) {
    request = request.eq("type", query.type);
  }

  const { data, error, count } = await request
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    throw new AppError(error.message, 400);
  }

  return {
    notifications: data,
    pagination: {
      page,
      limit,
      total: count || 0,
      total_pages: Math.ceil((count || 0) / limit)
    }
  };
};

export const getUnreadNotificationCount = async (userId: string) => {
  const { count, error } = await supabaseAdmin
    .from("notifications")
    .select("*", {
      count: "exact",
      head: true
    })
    .eq("user_id", userId)
    .eq("is_read", false);

  if (error) {
    throw new AppError(error.message, 400);
  }

  return count || 0;
};

export const markNotificationAsRead = async (
  notificationId: string,
  userId: string
) => {
  const { data: notification, error: findError } = await supabaseAdmin
    .from("notifications")
    .select("*")
    .eq("id", notificationId)
    .single();

  if (findError || !notification) {
    throw new AppError("Notification not found", 404);
  }

  if (notification.user_id !== userId) {
    throw new AppError("You are not allowed to update this notification", 403);
  }

  const { data, error } = await supabaseAdmin
    .from("notifications")
    .update({ is_read: true })
    .eq("id", notificationId)
    .select("*")
    .single();

  if (error) {
    throw new AppError(error.message, 400);
  }

  return data;
};

export const markAllNotificationsAsRead = async (userId: string) => {
  const { error } = await supabaseAdmin
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", userId)
    .eq("is_read", false);

  if (error) {
    throw new AppError(error.message, 400);
  }

  return true;
};

export const deleteNotification = async (
  notificationId: string,
  userId: string
) => {
  const { data: notification, error: findError } = await supabaseAdmin
    .from("notifications")
    .select("*")
    .eq("id", notificationId)
    .single();

  if (findError || !notification) {
    throw new AppError("Notification not found", 404);
  }

  if (notification.user_id !== userId) {
    throw new AppError("You are not allowed to delete this notification", 403);
  }

  const { error } = await supabaseAdmin
    .from("notifications")
    .delete()
    .eq("id", notificationId);

  if (error) {
    throw new AppError(error.message, 400);
  }

  return true;
};

export const sendAdminNotification = async (payload: Record<string, any>) => {
  const { data: user, error: userError } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("id", payload.user_id)
    .single();

  if (userError || !user) {
    throw new AppError("User profile not found", 404);
  }

  return createNotification({
    userId: payload.user_id,
    type: payload.type,
    title: payload.title,
    message: payload.message,
    metadata: payload.metadata || {}
  });
};