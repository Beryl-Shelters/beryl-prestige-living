import { supabaseAdmin } from "../../config/supabase";
import { AppError } from "../../utils/AppError";
import { marketplaceCategoryFromStorage } from "../marketplace/marketplace.contract";
import {
  deleteImageFromCloudinary,
  uploadImageWithPublicId
} from "../../utils/cloudinary";

const adminRoles = ["admin", "super_admin"];

const blockedUpdateFields = [
  "approved_by",
  "approved_at",
  "views_count",
  "shares_count",
  "saves_count",
  "property_code",
  "owner_id",
  "created_at",
  "updated_at"
];

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

export const getUserProfileRole = async (userId: string) => {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (error || !data) {
    throw new AppError("User profile not found", 404);
  }

  return data.role;
};

export const createProperty = async (
  userId: string,
  payload: Record<string, any>
) => {
  const slug = payload.slug || `${slugify(payload.title)}-${Date.now()}`;

  const { data, error } = await supabaseAdmin
    .from("properties")
    .insert({
      ...payload,
      owner_id: userId,
      slug,
      status: "pending",
      is_published: false
    })
    .select("*")
    .single();

  if (error) {
    throw new AppError(error.message, 400);
  }

  return data;
};

export const listProperties = async (query: Record<string, any>) => {
  const page = Number(query.page || 1);
  const limit = Number(query.limit || 10);
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let request = supabaseAdmin
    .from("properties")
    .select("*", { count: "exact" });

  if (query.status) {
    request = request.eq("status", query.status);
  } else {
    request = request.eq("is_published", true);
  }

  if (query.search) {
    request = request.or(
      `title.ilike.%${query.search}%,description.ilike.%${query.search}%,property_code.ilike.%${query.search}%`
    );
  }

  if (query.city) request = request.ilike("city", `%${query.city}%`);
  if (query.state) request = request.ilike("state", `%${query.state}%`);
  if (query.country) request = request.ilike("country", `%${query.country}%`);
  if (query.property_type) request = request.eq("property_type", query.property_type);
  if (query.listing_purpose) request = request.eq("listing_purpose", query.listing_purpose);
  if (query.min_price) request = request.gte("price", Number(query.min_price));
  if (query.max_price) request = request.lte("price", Number(query.max_price));

  if (query.sort === "price_asc") {
    request = request.order("price", { ascending: true });
  } else if (query.sort === "price_desc") {
    request = request.order("price", { ascending: false });
  } else {
    request = request.order("created_at", { ascending: false });
  }

  const { data, error, count } = await request.range(from, to);

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

export const getPropertyById = async (id: string) => {
  const { data, error } = await supabaseAdmin
    .from("properties")
    .select(`
      *,
      property_images (*),
      owner:profiles!properties_owner_id_fkey (
        id,
        first_name,
        last_name,
        email,
        phone_number,
        avatar_url,
        role
      )
    `)
    .eq("id", id)
    .single();

  if (error || !data) {
    throw new AppError("Property not found", 404);
  }

  return data;
};

export const updateProperty = async (
  propertyId: string,
  userId: string,
  payload: Record<string, any>
) => {
  const property = await getPropertyById(propertyId);
  const role = await getUserProfileRole(userId);

  const isOwner = property.owner_id === userId;
  const isAdmin = adminRoles.includes(role);

  if (!isOwner && !isAdmin) {
    throw new AppError("You are not allowed to update this property", 403);
  }

  for (const field of blockedUpdateFields) {
    if (field in payload) {
      throw new AppError(`You cannot update ${field}`, 400);
    }
  }

  if (payload.title && !payload.slug) {
    payload.slug = `${slugify(payload.title)}-${Date.now()}`;
  }

  const { data, error } = await supabaseAdmin
    .from("properties")
    .update(payload)
    .eq("id", propertyId)
    .select("*")
    .single();

  if (error) {
    throw new AppError(error.message, 400);
  }

  return data;
};

export const archiveProperty = async (
  propertyId: string,
  userId: string
) => {
  const property = await getPropertyById(propertyId);
  const role = await getUserProfileRole(userId);

  const isOwner = property.owner_id === userId;
  const isAdmin = adminRoles.includes(role);

  if (!isOwner && !isAdmin) {
    throw new AppError("You are not allowed to delete this property", 403);
  }

  const { data, error } = await supabaseAdmin
    .from("properties")
    .update({
      status: "archived",
      is_published: false
    })
    .eq("id", propertyId)
    .select("*")
    .single();

  if (error) {
    throw new AppError(error.message, 400);
  }

  return data;
};

const canManageProperty = async (propertyId: string, userId: string) => {
  const property = await getPropertyById(propertyId);
  const role = await getUserProfileRole(userId);

  const isOwner = property.owner_id === userId;
  const isAdmin = adminRoles.includes(role);

  if (!isOwner && !isAdmin) {
    throw new AppError("You are not allowed to manage this property", 403);
  }

  return property;
};

export const uploadPropertyImages = async (
  propertyId: string,
  userId: string,
  files?: Express.Multer.File[]
) => {
  if (!files || files.length === 0) {
    throw new AppError("At least one property image is required", 400);
  }

  const property = await canManageProperty(propertyId, userId);

  const { data: existingImages, error: existingError } = await supabaseAdmin
    .from("property_images")
    .select("*")
    .eq("property_id", propertyId)
    .order("sort_order", { ascending: true });

  if (existingError) {
    throw new AppError(existingError.message, 400);
  }

  const hasCoverImage = existingImages?.some((image) => image.is_cover);
  const startSortOrder = existingImages?.length || 0;

  const imageRows = [];

  for (let index = 0; index < files.length; index++) {
    const file = files[index];

    const uploaded = await uploadImageWithPublicId(
      file.buffer,
      "beryl-prestige/properties"
    );

    imageRows.push({
      property_id: propertyId,
      image_url: uploaded.secure_url,
      cloudinary_public_id: uploaded.public_id,
      alt_text: property.title,
      is_cover: !hasCoverImage && index === 0,
      sort_order: startSortOrder + index
    });
  }

  const { data: insertedImages, error: insertError } = await supabaseAdmin
    .from("property_images")
    .insert(imageRows)
    .select("*");

  if (insertError) {
    throw new AppError(insertError.message, 400);
  }

  if (!property.thumbnail_url && insertedImages && insertedImages.length > 0) {
    await supabaseAdmin
      .from("properties")
      .update({
        thumbnail_url: insertedImages[0].image_url
      })
      .eq("id", propertyId);
  }

  return insertedImages;
};

export const deletePropertyImage = async (
  imageId: string,
  userId: string
) => {
  const { data: image, error: imageError } = await supabaseAdmin
    .from("property_images")
    .select("*")
    .eq("id", imageId)
    .single();

  if (imageError || !image) {
    throw new AppError("Property image not found", 404);
  }

  const property = await canManageProperty(image.property_id, userId);

  if (image.cloudinary_public_id) {
    await deleteImageFromCloudinary(image.cloudinary_public_id);
  }

  const { error: deleteError } = await supabaseAdmin
    .from("property_images")
    .delete()
    .eq("id", imageId);

  if (deleteError) {
    throw new AppError(deleteError.message, 400);
  }

  if (property.thumbnail_url === image.image_url) {
    const { data: remainingImages } = await supabaseAdmin
      .from("property_images")
      .select("*")
      .eq("property_id", image.property_id)
      .order("sort_order", { ascending: true })
      .limit(1);

    await supabaseAdmin
      .from("properties")
      .update({
        thumbnail_url: remainingImages?.[0]?.image_url || null
      })
      .eq("id", image.property_id);
  }

  return true;
};


export const saveProperty = async (
  propertyId: string,
  userId: string
) => {
  const { data: property, error: propertyError } = await supabaseAdmin
    .from("properties")
    .select("id, saves_count, marketplace_status")
    .eq("id", propertyId)
    .maybeSingle();

  if (propertyError) {
    throw new AppError("Saved property is temporarily unavailable", 503, "SAVED_PROPERTY_UNAVAILABLE");
  }
  if (!property || property.marketplace_status !== "LIVE") {
    throw new AppError("Property is not available", 404, "PROPERTY_NOT_AVAILABLE");
  }

  const { data: existingSave, error: existingSaveError } = await supabaseAdmin
    .from("saved_properties")
    .select("id, property_id, user_id, created_at")
    .eq("property_id", propertyId)
    .eq("user_id", userId)
    .maybeSingle();

  if (existingSaveError) {
    throw new AppError("Saved property is temporarily unavailable", 503, "SAVED_PROPERTY_UNAVAILABLE");
  }
  if (existingSave) {
    return existingSave;
  }

  const { data: savedProperty, error: saveError } = await supabaseAdmin
    .from("saved_properties")
    .insert({
      property_id: propertyId,
      user_id: userId
    })
    .select("id, property_id, user_id, created_at")
    .single();

  if (saveError) {
    throw new AppError("Saved property is temporarily unavailable", 503, "SAVED_PROPERTY_UNAVAILABLE");
  }

  await supabaseAdmin
    .from("properties")
    .update({
      saves_count: (property.saves_count || 0) + 1
    })
    .eq("id", propertyId);

  return savedProperty;
};

export const unsaveProperty = async (
  propertyId: string,
  userId: string
) => {
  const { data: property, error: propertyError } = await supabaseAdmin
    .from("properties")
    .select("id, saves_count")
    .eq("id", propertyId)
    .maybeSingle();

  if (propertyError) {
    throw new AppError("Saved property is temporarily unavailable", 503, "SAVED_PROPERTY_UNAVAILABLE");
  }
  if (!property) {
    throw new AppError("Property not found", 404);
  }

  const { data: existingSave, error: existingError } = await supabaseAdmin
    .from("saved_properties")
    .select("id")
    .eq("property_id", propertyId)
    .eq("user_id", userId)
    .maybeSingle();

  if (existingError) {
    throw new AppError("Saved property is temporarily unavailable", 503, "SAVED_PROPERTY_UNAVAILABLE");
  }

  if (!existingSave) {
    throw new AppError("Property is not saved", 404);
  }

  const { error: deleteError } = await supabaseAdmin
    .from("saved_properties")
    .delete()
    .eq("id", existingSave.id);

  if (deleteError) {
    throw new AppError("Saved property is temporarily unavailable", 503, "SAVED_PROPERTY_UNAVAILABLE");
  }

  await supabaseAdmin
    .from("properties")
    .update({
      saves_count: Math.max((property.saves_count || 0) - 1, 0)
    })
    .eq("id", propertyId);

  return true;
};

export const getMySavedProperties = async (
  userId: string,
  query: Record<string, any>
) => {
  const page = Number(query.page || 1);
  const limit = Number(query.limit || 10);
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const { data, error, count } = await supabaseAdmin
    .from("saved_properties")
    .select(
      `
      id,
      created_at,
      property:properties!inner (
        id,
        property_code,
        title,
        category,
        property_type,
        public_location,
        price,
        negotiable,
        bedrooms,
        bathrooms,
        toilets,
        parking_spaces,
        marketplace_status,
        marketplace_published_at,
        property_images (id, image_url, sort_order, is_cover)
      )
    `,
      { count: "exact" }
    )
    .eq("user_id", userId)
    .eq("property.marketplace_status", "LIVE")
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    throw new AppError("Saved properties are temporarily unavailable", 503, "SAVED_PROPERTY_UNAVAILABLE");
  }

  const savedProperties=(data??[]).flatMap((saved:any)=>{
    const property=Array.isArray(saved.property)?saved.property[0]:saved.property;
    if(!property||property.marketplace_status!=="LIVE")return [];
    const seen=new Set<string>();
    const propertyImages=[...(property.property_images??[])].filter((image:any)=>{if(!image?.id||seen.has(image.id))return false;seen.add(image.id);return true}).sort((a:any,b:any)=>Number(a.sort_order)-Number(b.sort_order)||String(a.id).localeCompare(String(b.id)));
    const cover=propertyImages.find((image:any)=>Boolean(image.is_cover));
    return [{id:saved.id,propertyId:property.id,savedAt:saved.created_at,property:{id:property.id,referenceId:property.property_code,title:property.title,askingPrice:property.price,negotiable:Boolean(property.negotiable),propertyType:property.property_type,propertyCategory:marketplaceCategoryFromStorage(property.category),publicLocation:property.public_location,bedrooms:property.bedrooms??null,bathrooms:property.bathrooms??null,toilets:property.toilets??null,parkingSpaces:property.parking_spaces??null,coverImage:cover?{id:cover.id,url:cover.image_url}:null,photoCount:propertyImages.length,verified:true,publishedAt:property.marketplace_published_at??null,saved:true}}];
  });

  return {
    saved_properties: savedProperties,
    pagination: {
      page,
      limit,
      total: count || 0,
      total_pages: Math.ceil((count || 0) / limit)
    }
  };
};
