import { supabaseAdmin } from "../../config/supabase";
import { AppError } from "../../utils/AppError";

const adminRoles = ["admin", "super_admin"];

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

export const createListing = async (
  userId: string,
  payload: Record<string, any>
) => {
  const { data: property, error: propertyError } = await supabaseAdmin
    .from("properties")
    .select("id, owner_id")
    .eq("id", payload.property_id)
    .single();

  if (propertyError || !property) {
    throw new AppError("Property not found", 404);
  }

  const role = await getUserRole(userId);
  const isOwner = property.owner_id === userId;
  const isAdmin = adminRoles.includes(role);

  if (!isOwner && !isAdmin) {
    throw new AppError("You are not allowed to create listing for this property", 403);
  }

  const { data, error } = await supabaseAdmin
    .from("listings")
    .insert({
      property_id: payload.property_id,
      listed_by: userId,
      title: payload.title,
      description: payload.description,
      status: "pending",
      listed_at: new Date().toISOString(),
      expires_at: payload.expires_at || null
    })
    .select("*")
    .single();

  if (error) {
    throw new AppError(error.message, 400);
  }

  return data;
};

export const listListings = async (query: Record<string, any>) => {
  const page = Number(query.page || 1);
  const limit = Number(query.limit || 10);
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let request = supabaseAdmin
    .from("listings")
    .select(
      `
      *,
      property:properties (
        id,
        title,
        property_code,
        price,
        thumbnail_url,
        property_type,
        listing_purpose,
        city,
        state,
        country,
        status,
        is_published
      )
    `,
      { count: "exact" }
    );

  if (query.status) {
    request = request.eq("status", query.status);
  } else {
    request = request.eq("status", "active");
  }

  if (query.search) {
    request = request.or(
      `title.ilike.%${query.search}%,description.ilike.%${query.search}%`
    );
  }

  const { data, error, count } = await request
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    throw new AppError(error.message, 400);
  }

  return {
    listings: data,
    pagination: {
      page,
      limit,
      total: count || 0,
      total_pages: Math.ceil((count || 0) / limit)
    }
  };
};

export const getMyListings = async (
  userId: string,
  query: Record<string, any>
) => {
  const page = Number(query.page || 1);
  const limit = Number(query.limit || 10);
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const { data, error, count } = await supabaseAdmin
    .from("listings")
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
        is_published
      )
    `,
      { count: "exact" }
    )
    .eq("listed_by", userId)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    throw new AppError(error.message, 400);
  }

  return {
    listings: data,
    pagination: {
      page,
      limit,
      total: count || 0,
      total_pages: Math.ceil((count || 0) / limit)
    }
  };
};

export const getListingById = async (listingId: string) => {
  const { data, error } = await supabaseAdmin
    .from("listings")
    .select(
      `
      *,
      property:properties (
        *,
        property_images (*)
      ),
      listed_user:profiles!listings_listed_by_fkey (
        id,
        first_name,
        last_name,
        email,
        phone_number,
        role
      )
    `
    )
    .eq("id", listingId)
    .single();

  if (error || !data) {
    throw new AppError("Listing not found", 404);
  }

  return data;
};

export const updateListing = async (
  listingId: string,
  userId: string,
  payload: Record<string, any>
) => {
  const { data: listing, error: listingError } = await supabaseAdmin
    .from("listings")
    .select("id, listed_by")
    .eq("id", listingId)
    .single();

  if (listingError || !listing) {
    throw new AppError("Listing not found", 404);
  }

  const role = await getUserRole(userId);
  const isOwner = listing.listed_by === userId;
  const isAdmin = adminRoles.includes(role);

  if (!isOwner && !isAdmin) {
    throw new AppError("You are not allowed to update this listing", 403);
  }

  if ("status" in payload) {
    throw new AppError("Use listing status endpoint to update status", 400);
  }

  const { data, error } = await supabaseAdmin
    .from("listings")
    .update(payload)
    .eq("id", listingId)
    .select("*")
    .single();

  if (error) {
    throw new AppError(error.message, 400);
  }

  return data;
};

export const updateListingStatus = async (
  listingId: string,
  status: string
) => {
  const { data: listing, error: listingError } = await supabaseAdmin
    .from("listings")
    .select("id, property_id")
    .eq("id", listingId)
    .single();

  if (listingError || !listing) {
    throw new AppError("Listing not found", 404);
  }

  const { data, error } = await supabaseAdmin
    .from("listings")
    .update({ status })
    .eq("id", listingId)
    .select("*")
    .single();

  if (error) {
    throw new AppError(error.message, 400);
  }

  if (status === "active") {
    await supabaseAdmin
      .from("properties")
      .update({
        is_published: true,
        status: "approved"
      })
      .eq("id", listing.property_id);
  }

  if (["rejected", "archived", "expired"].includes(status)) {
    await supabaseAdmin
      .from("properties")
      .update({
        is_published: false
      })
      .eq("id", listing.property_id);
  }

  if (status === "sold") {
    await supabaseAdmin
      .from("properties")
      .update({
        status: "sold",
        is_published: false
      })
      .eq("id", listing.property_id);
  }

  return data;
};

export const archiveListing = async (
  listingId: string,
  userId: string
) => {
  const { data: listing, error: listingError } = await supabaseAdmin
    .from("listings")
    .select("id, listed_by, property_id")
    .eq("id", listingId)
    .single();

  if (listingError || !listing) {
    throw new AppError("Listing not found", 404);
  }

  const role = await getUserRole(userId);
  const isOwner = listing.listed_by === userId;
  const isAdmin = adminRoles.includes(role);

  if (!isOwner && !isAdmin) {
    throw new AppError("You are not allowed to delete this listing", 403);
  }

  const { data, error } = await supabaseAdmin
    .from("listings")
    .update({ status: "archived" })
    .eq("id", listingId)
    .select("*")
    .single();

  if (error) {
    throw new AppError(error.message, 400);
  }

  await supabaseAdmin
    .from("properties")
    .update({ is_published: false })
    .eq("id", listing.property_id);

  return data;
};