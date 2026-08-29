import { supabaseAdmin } from "../../config/supabase";
import { AppError } from "../../utils/AppError";
import { createPropertyDocumentAccessUrl } from "../../utils/cloudinary";
import { marketplaceCategoryToStorage } from "../marketplace/marketplace.contract";

const reviewStatuses = ["IN_REVIEW", "LIVE", "REJECTED"] as const;
type ReviewStatus = typeof reviewStatuses[number];

const imageDto = (row: any) => ({ id: row.id, url: row.image_url, order: row.sort_order, isCover: Boolean(row.is_cover) });
const documentDto = (row: any) => ({ id: row.id, documentType: row.document_type, displayName: row.display_name, mimeType: row.mime_type, sizeBytes: row.size_bytes, uploadedAt: row.created_at });
const summaryDto = (row: any) => {
  const images = [...(row.property_images ?? [])].sort((a: any, b: any) => a.sort_order - b.sort_order);
  const cover = images.find((image: any) => image.is_cover);
  const mandate = Array.isArray(row.mandates) ? row.mandates[0] : row.mandates;
  return { id: row.id, referenceId: row.property_code, title: row.title, propertyType: row.property_type, propertyCategory: row.category, publicLocation: row.public_location, askingPrice: row.price, status: row.marketplace_status, mandateType: mandate?.marketplace_mandate_type ?? null, sellerSummary: row.seller ? { id: row.seller.id, fullName: row.seller.full_name } : null, coverImage: cover ? imageDto(cover) : null, photoCount: images.length, submittedAt: row.marketplace_submitted_at ?? null, reviewedAt: row.marketplace_reviewed_at ?? null, publishedAt: row.marketplace_published_at ?? null, rejectedAt: row.marketplace_rejected_at ?? null, updatedAt: row.updated_at };
};

const safeSearch = (value: string) => value.replace(/[,%()]/g, " ").replace(/\s+/g, " ").trim();
const sellerIdsMatching = async (value: string) => {
  const term = `%${value}%`;
  const [profiles, companies] = await Promise.all([
    supabaseAdmin.from("profiles").select("id").ilike("full_name", term).limit(100),
    supabaseAdmin.from("seller_profiles").select("user_persona_id").ilike("company_name", term).limit(100)
  ]);
  if (profiles.error || companies.error) throw new AppError("Marketplace review queue is temporarily unavailable", 503, "MARKETPLACE_REVIEW_UNAVAILABLE");
  const personaIds = (companies.data ?? []).map((row: any) => row.user_persona_id).filter(Boolean);
  const personas = personaIds.length
    ? await supabaseAdmin.from("user_personas").select("user_id").in("id", personaIds)
    : { data: [], error: null };
  if (personas.error) throw new AppError("Marketplace review queue is temporarily unavailable", 503, "MARKETPLACE_REVIEW_UNAVAILABLE");
  return [...new Set([...(profiles.data ?? []).map((row: any) => row.id), ...(personas.data ?? []).map((row: any) => row.user_id)].filter(Boolean))];
};

const countStatus = async (status?: ReviewStatus) => {
  let query = supabaseAdmin.from("properties").select("id", { count: "exact", head: true });
  query = status ? query.eq("marketplace_status", status) : query.in("marketplace_status", reviewStatuses);
  const { count, error } = await query;
  if (error) throw new AppError("Marketplace review queue is temporarily unavailable", 503, "MARKETPLACE_REVIEW_UNAVAILABLE");
  return count ?? 0;
};

export const listReviewQueue = async (query: { page: number; limit: number; status: "ALL" | ReviewStatus; q?: string; category?: "RESIDENTIAL" | "COMMERCIAL"; mandate?: "EXCLUSIVE" | "OPEN"; sort: "OPERATIONAL" | "MOST_RECENT" | "OLDEST" | "PRICE_HIGH" | "PRICE_LOW" }) => {
  const from = (query.page - 1) * query.limit;
  let request = supabaseAdmin.from("properties").select("id,property_code,title,property_type,category,public_location,price,marketplace_status,marketplace_submitted_at,marketplace_reviewed_at,marketplace_published_at,marketplace_rejected_at,updated_at,property_images(id,image_url,sort_order,is_cover),seller:profiles!properties_owner_id_fkey(id,full_name),mandates!inner(marketplace_mandate_type)", { count: "exact" });
  request = query.status === "ALL" ? request.in("marketplace_status", reviewStatuses) : request.eq("marketplace_status", query.status);
  if (query.category) request = request.eq("category", marketplaceCategoryToStorage(query.category));
  if (query.mandate) request = request.eq("mandates.marketplace_mandate_type", query.mandate);
  if (query.q) {
    const normalized = safeSearch(query.q);
    if (normalized) {
      const sellerIds = await sellerIdsMatching(normalized);
      const ownerFilter = sellerIds.length ? `,owner_id.in.(${sellerIds.join(",")})` : "";
      request = request.or(`title.ilike.%${normalized}%,property_code.ilike.%${normalized}%,public_location.ilike.%${normalized}%${ownerFilter}`);
    }
  }
  if (query.sort === "PRICE_HIGH") request = request.order("price", { ascending: false }).order("id", { ascending: true });
  else if (query.sort === "PRICE_LOW") request = request.order("price", { ascending: true }).order("id", { ascending: true });
  else if (query.sort === "MOST_RECENT") request = request.order("updated_at", { ascending: false }).order("id", { ascending: false });
  else if (query.sort === "OLDEST") request = request.order("updated_at", { ascending: true }).order("id", { ascending: true });
  else request = query.status === "IN_REVIEW" ? request.order("marketplace_submitted_at", { ascending: true }).order("id", { ascending: true }) : request.order("updated_at", { ascending: false }).order("id", { ascending: false });
  const [{ data, error, count }, all, inReview, live, rejected] = await Promise.all([request.range(from, from + query.limit - 1), countStatus(), countStatus("IN_REVIEW"), countStatus("LIVE"), countStatus("REJECTED")]);
  if (error) throw new AppError("Marketplace review queue is temporarily unavailable", 503, "MARKETPLACE_REVIEW_UNAVAILABLE");
  return { counts: { all, inReview, live, rejected }, items: (data ?? []).map(summaryDto), pagination: { page: query.page, limit: query.limit, total: count ?? 0, total_pages: Math.ceil((count ?? 0) / query.limit) } };
};

export const getReviewDetail = async (propertyId: string) => {
  const { data: property, error } = await supabaseAdmin.from("properties").select("*,property_images(id,image_url,sort_order,is_cover),seller:profiles!properties_owner_id_fkey(id,full_name,email,phone_number,account_status,email_verified_at)").eq("id", propertyId).in("marketplace_status", reviewStatuses).maybeSingle();
  if (error) throw new AppError("Marketplace review is temporarily unavailable", 503, "MARKETPLACE_REVIEW_UNAVAILABLE");
  if (!property) throw new AppError("Marketplace listing not found", 404, "MARKETPLACE_REVIEW_NOT_FOUND");
  const [documentsResult, mandateResult, historyResult] = await Promise.all([
    supabaseAdmin.from("property_documents").select("id,document_type,display_name,mime_type,size_bytes,created_at").eq("property_id", propertyId).order("created_at", { ascending: true }),
    supabaseAdmin.from("mandates").select("marketplace_mandate_type,full_name,ownership_confirmed,mandate_accepted,accepted_at,agreement_version,commission_percentage,commission_amount").eq("property_id", propertyId).not("marketplace_mandate_type", "is", null).maybeSingle(),
    supabaseAdmin.from("marketplace_property_review_history").select("id,previous_status,new_status,action,reason,reviewed_by_admin_id,created_at").eq("property_id", propertyId).order("created_at", { ascending: false })
  ]);
  if (documentsResult.error || mandateResult.error || historyResult.error) throw new AppError("Marketplace review is temporarily unavailable", 503, "MARKETPLACE_REVIEW_UNAVAILABLE");
  const historyRows = historyResult.data ?? [];
  const reviewerIds = [...new Set(historyRows.map((row: any) => row.reviewed_by_admin_id).filter(Boolean))];
  const reviewersResult = reviewerIds.length
    ? await supabaseAdmin.from("admins").select("id,full_name").in("id", reviewerIds)
    : { data: [], error: null };
  if (reviewersResult.error) throw new AppError("Marketplace review is temporarily unavailable", 503, "MARKETPLACE_REVIEW_UNAVAILABLE");
  const reviewerNames = new Map<string, string>((reviewersResult.data ?? []).map((row: any) => [row.id, row.full_name]));
  const sellerPersonaResult = property.seller?.id
    ? await supabaseAdmin.from("user_personas").select("id").eq("user_id", property.seller.id).eq("persona_type", "SELLER_DEVELOPER").maybeSingle()
    : { data: null, error: null };
  if (sellerPersonaResult.error) throw new AppError("Marketplace review is temporarily unavailable", 503, "MARKETPLACE_REVIEW_UNAVAILABLE");
  const sellerProfileResult = sellerPersonaResult.data?.id
    ? await supabaseAdmin.from("seller_profiles").select("company_name").eq("user_persona_id", sellerPersonaResult.data.id).maybeSingle()
    : { data: null, error: null };
  if (sellerProfileResult.error) throw new AppError("Marketplace review is temporarily unavailable", 503, "MARKETPLACE_REVIEW_UNAVAILABLE");
  const images = [...(property.property_images ?? [])].sort((a: any, b: any) => a.sort_order - b.sort_order).map(imageDto);
  const mandate: any = mandateResult.data;
  return { summary: summaryDto({ ...property, mandates: mandate ? [mandate] : [] }), property: { id: property.id, referenceId: property.property_code, title: property.title, description: property.description, propertyCategory: property.category, propertyType: property.property_type, ownershipType: property.ownership_type, publicLocation: property.public_location, fullAddress: property.full_address, askingPrice: property.price, negotiable: Boolean(property.negotiable), initialDepositType: property.initial_deposit_type ?? null, initialDepositValue: property.initial_deposit_value ?? null, condition: property.property_condition, furnishing: property.furnishing, bedrooms: property.bedrooms, bathrooms: property.bathrooms, toilets: property.toilets, parkingSpaces: property.parking_spaces, numberOfFloors: property.number_of_floors, parkingCapacity: property.parking_capacity, amenities: property.amenities ?? [], images }, seller: property.seller ? { id: property.seller.id, fullName: property.seller.full_name, companyName: sellerProfileResult.data?.company_name ?? null, email: property.seller.email, phone: property.seller.phone_number, accountStatus: property.seller.account_status, emailVerified: Boolean(property.seller.email_verified_at) } : null, documents: (documentsResult.data ?? []).map(documentDto), mandate: mandate ? { mandateType: mandate.marketplace_mandate_type, sellerFullName: mandate.full_name, ownershipConfirmed: Boolean(mandate.ownership_confirmed), mandateAccepted: Boolean(mandate.mandate_accepted), acceptedAt: mandate.accepted_at, agreementVersion: mandate.agreement_version, commissionPercentage: mandate.commission_percentage, commissionAmount: mandate.commission_amount } : null, rejectionFeedback: property.marketplace_status === "REJECTED" ? property.rejection_reason ?? null : null, history: historyRows.map((row: any) => ({ id: row.id, previousStatus: row.previous_status, newStatus: row.new_status, action: row.action, reason: row.reason, reviewedByAdminId: row.reviewed_by_admin_id, reviewedByAdminName: reviewerNames.get(row.reviewed_by_admin_id) ?? null, createdAt: row.created_at })) };
};

export const getDocumentAccess = async (propertyId: string, documentId: string) => {
  const { data: property, error: propertyError } = await supabaseAdmin.from("properties").select("id").eq("id", propertyId).in("marketplace_status", reviewStatuses).maybeSingle();
  if (propertyError) throw new AppError("Document access is temporarily unavailable", 503, "MARKETPLACE_DOCUMENT_ACCESS_FAILED");
  if (!property) throw new AppError("Marketplace listing not found", 404, "MARKETPLACE_REVIEW_NOT_FOUND");
  const { data, error } = await supabaseAdmin.from("property_documents").select("id,cloudinary_public_id,cloudinary_resource_type,display_name").eq("id", documentId).eq("property_id", propertyId).maybeSingle();
  if (error) throw new AppError("Document access is temporarily unavailable", 503, "MARKETPLACE_DOCUMENT_ACCESS_FAILED");
  if (!data) throw new AppError("Property document not found", 404, "MARKETPLACE_DOCUMENT_NOT_FOUND");
  const expiresAt = Math.floor(Date.now() / 1000) + 300;
  return { url: createPropertyDocumentAccessUrl(data.cloudinary_public_id, expiresAt), expiresAt: new Date(expiresAt * 1000).toISOString() };
};

export const reviewProperty = async (propertyId: string, adminId: string, action: "APPROVE" | "REJECT", reason?: string) => {
  const { data, error } = await supabaseAdmin.rpc("review_marketplace_property", { p_property_id: propertyId, p_admin_id: adminId, p_action: action, p_reason: reason ?? null });
  if (error) throw new AppError(action === "APPROVE" ? "Listing approval failed" : "Listing rejection failed", 503, action === "APPROVE" ? "LISTING_APPROVAL_FAILED" : "LISTING_REJECTION_FAILED");
  const result = Array.isArray(data) ? data[0] : data;
  if (!result || result.outcome === "NOT_FOUND") throw new AppError("Marketplace listing not found", 404, "MARKETPLACE_REVIEW_NOT_FOUND");
  if (result.outcome === "NOT_IN_REVIEW") throw new AppError("Listing is not in review", 409, "LISTING_NOT_IN_REVIEW");
  if (result.outcome === "ALREADY_REVIEWED") throw new AppError("Listing has already been reviewed", 409, "LISTING_ALREADY_REVIEWED");
  if (result.outcome === "INVALID_REASON") throw new AppError("A valid rejection reason is required", 400, "REJECTION_REASON_INVALID");
  if (result.outcome === "INCOMPLETE") throw new AppError("Listing no longer meets approval requirements", 409, "LISTING_APPROVAL_FAILED", { missingFields: result.missing_fields ?? [] });
  if (!['APPROVED','REJECTED'].includes(result.outcome)) throw new AppError("Marketplace review failed", 503, action === "APPROVE" ? "LISTING_APPROVAL_FAILED" : "LISTING_REJECTION_FAILED");
  return { propertyId: result.property_id, referenceId: result.reference_id, status: result.marketplace_status, reviewedAt: result.reviewed_at, publishedAt: result.published_at, rejectedAt: result.rejected_at, rejectionReason: result.rejection_reason, nextAction: action === "APPROVE" ? "VIEW_LIVE_LISTING" : "VIEW_REJECTION" };
};
