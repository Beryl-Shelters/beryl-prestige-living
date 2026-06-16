import { supabaseAdmin } from "../../config/supabase";
import { AppError } from "../../utils/AppError";

const adminRoles = ["admin", "super_admin"];

export const getOptionalUserFromToken = async (token?: string) => {
  if (!token) return null;

  const { data, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !data.user) return null;

  return data.user;
};

export const trackPropertyView = async ({
  propertyId,
  viewerId,
  ipAddress,
  userAgent
}: {
  propertyId: string;
  viewerId?: string | null;
  ipAddress?: string;
  userAgent?: string;
}) => {
  const { data: property, error: propertyError } = await supabaseAdmin
    .from("properties")
    .select("id, views_count")
    .eq("id", propertyId)
    .single();

  if (propertyError || !property) {
    throw new AppError("Property not found", 404);
  }

  await supabaseAdmin
    .from("properties")
    .update({
      views_count: (property.views_count || 0) + 1
    })
    .eq("id", propertyId);

  await supabaseAdmin.from("property_viewings").insert({
    property_id: propertyId,
    user_id: viewerId || null,
    message: "Property viewed",
    status: "new",
    created_at: new Date().toISOString()
  });

  return {
    property_id: propertyId,
    views_count: (property.views_count || 0) + 1,
    ip_address: ipAddress,
    user_agent: userAgent
  };
};

export const trackPropertyShare = async (propertyId: string) => {
  const { data: property, error: propertyError } = await supabaseAdmin
    .from("properties")
    .select("id, shares_count")
    .eq("id", propertyId)
    .single();

  if (propertyError || !property) {
    throw new AppError("Property not found", 404);
  }

  const newShareCount = (property.shares_count || 0) + 1;

  const { error } = await supabaseAdmin
    .from("properties")
    .update({
      shares_count: newShareCount
    })
    .eq("id", propertyId);

  if (error) {
    throw new AppError(error.message, 400);
  }

  return {
    property_id: propertyId,
    shares_count: newShareCount
  };
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

export const getPropertyStats = async (
  propertyId: string,
  userId: string
) => {
  const { data: property, error } = await supabaseAdmin
    .from("properties")
    .select(
      "id, title, owner_id, views_count, shares_count, saves_count, status, is_published"
    )
    .eq("id", propertyId)
    .single();

  if (error || !property) {
    throw new AppError("Property not found", 404);
  }

  const role = await getUserRole(userId);

  const isOwner = property.owner_id === userId;
  const isAdmin = adminRoles.includes(role);

  if (!isOwner && !isAdmin) {
    throw new AppError("You are not allowed to view this property analytics", 403);
  }

  return property;
};

export const getMyPropertyAnalytics = async (
  userId: string,
  query: Record<string, any>
) => {
  const page = Number(query.page || 1);
  const limit = Number(query.limit || 10);
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const { data, error, count } = await supabaseAdmin
    .from("properties")
    .select(
      "id, title, property_code, status, is_published, views_count, shares_count, saves_count, created_at",
      { count: "exact" }
    )
    .eq("owner_id", userId)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    throw new AppError(error.message, 400);
  }

  return {
    properties: data,
    pagination: {
      page,
      limit,
      total: count || 0,
      total_pages: Math.ceil((count || 0) / limit)
    }
  };
};

export const getAdminDashboardAnalytics = async () => {
  const { data: properties, error } = await supabaseAdmin
    .from("properties")
    .select("status, is_published, views_count, saves_count, shares_count");

  if (error) {
    throw new AppError(error.message, 400);
  }

  const totalProperties = properties?.length || 0;

  const publishedProperties =
    properties?.filter((item) => item.is_published).length || 0;

  const pendingProperties =
    properties?.filter((item) => item.status === "pending").length || 0;

  const archivedProperties =
    properties?.filter((item) => item.status === "archived").length || 0;

  const totalViews =
    properties?.reduce((sum, item) => sum + (item.views_count || 0), 0) || 0;

  const totalSaves =
    properties?.reduce((sum, item) => sum + (item.saves_count || 0), 0) || 0;

  const totalShares =
    properties?.reduce((sum, item) => sum + (item.shares_count || 0), 0) || 0;

  return {
    total_properties: totalProperties,
    published_properties: publishedProperties,
    pending_properties: pendingProperties,
    archived_properties: archivedProperties,
    total_views: totalViews,
    total_saves: totalSaves,
    total_shares: totalShares
  };
};