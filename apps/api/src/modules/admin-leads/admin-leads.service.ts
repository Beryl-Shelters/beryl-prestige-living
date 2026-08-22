import { supabaseAdmin } from "../../config/supabase";
import { AppError } from "../../utils/AppError";
import type { LeadStage } from "./admin-leads.validators";

const emptyCounts: Record<LeadStage, number> = { NEW: 0, CONTACTED: 0, WON: 0, LOST: 0 };
const leadReference = (id: string) => `ENQ-${id.replaceAll("-", "").slice(0, 8).toUpperCase()}`;
const canonicalLeadStage = (leadStage: unknown, legacyStatus: unknown): LeadStage => {
  if (typeof leadStage === "string" && leadStage in emptyCounts) return leadStage as LeadStage;
  switch (String(legacyStatus ?? "").toLowerCase()) {
    case "contacted":
    case "in_progress":
    case "scheduled":
      return "CONTACTED";
    case "resolved":
      return "WON";
    case "closed":
      return "LOST";
    default:
      return "NEW";
  }
};
const preferredContact = (inquiryType: unknown) => {
  const value = String(inquiryType ?? "").toUpperCase();
  if (value.endsWith("WHATSAPP")) return "WHATSAPP";
  if (value.endsWith("CALL")) return "CALL";
  if (value.endsWith("EMAIL")) return "EMAIL";
  return null;
};
const imageDto = (row: any) => ({ id: row.id, url: row.image_url, order: row.sort_order, isCover: Boolean(row.is_cover) });

export const listLeads = async (input: { q?: string; limit: number }) => {
  const { data, error } = await supabaseAdmin.rpc("list_admin_inquiry_leads", {
    p_query: input.q ?? null,
    p_per_stage_limit: input.limit
  });
  if (error) throw new AppError("Lead management is temporarily unavailable", 503, "LEADS_UNAVAILABLE");
  const counts = { ...emptyCounts };
  const items = (data ?? []).map((row: any) => {
    const stage = canonicalLeadStage(row.stage, null);
    if (stage in counts) counts[stage] = Number(row.stage_total ?? 0);
    return {
      id: row.lead_id,
      referenceId: row.reference_id,
      customerName: row.customer_name,
      propertyId: row.property_id,
      propertyTitle: row.property_title,
      propertyReferenceId: row.property_reference_id,
      stage,
      inquiryType: row.inquiry_type,
      receivedAt: row.received_at
    };
  });
  return { counts, total: Object.values(counts).reduce((sum, count) => sum + count, 0), items, perStageLimit: input.limit, query: input.q ?? null };
};

export const getLeadDetail = async (leadId: string) => {
  const { data: inquiry, error } = await supabaseAdmin.from("inquiries")
    .select("id,user_id,property_id,inquiry_type,full_name,email,phone_number,message,status,lead_stage,created_at,updated_at")
    .eq("id", leadId).maybeSingle();
  if (error) throw new AppError("Lead management is temporarily unavailable", 503, "LEADS_UNAVAILABLE");
  if (!inquiry) throw new AppError("Lead not found", 404, "LEAD_NOT_FOUND");

  const [profileResult, personasResult, propertyResult, historyResult] = await Promise.all([
    inquiry.user_id
      ? supabaseAdmin.from("profiles").select("id,full_name,email,phone_number,email_verified_at,account_status").eq("id", inquiry.user_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    inquiry.user_id
      ? supabaseAdmin.from("user_personas").select("id,persona_type,onboarding_status").eq("user_id", inquiry.user_id)
      : Promise.resolve({ data: [], error: null }),
    inquiry.property_id
      ? supabaseAdmin.from("properties").select("id,owner_id,property_code,title,public_location,price,category,property_type,marketplace_status,initial_deposit_type,initial_deposit_value,property_images(id,image_url,sort_order,is_cover)").eq("id", inquiry.property_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabaseAdmin.from("inquiry_lead_stage_history").select("id,previous_stage,new_stage,changed_by_admin_id,created_at").eq("inquiry_id", leadId).order("created_at", { ascending: false })
  ]);
  if (profileResult.error || personasResult.error || propertyResult.error || historyResult.error) {
    throw new AppError("Lead management is temporarily unavailable", 503, "LEADS_UNAVAILABLE");
  }

  const property: any = propertyResult.data;
  const mandateResult = property
    ? await supabaseAdmin.from("mandates").select("marketplace_mandate_type").eq("property_id", property.id).not("marketplace_mandate_type", "is", null).maybeSingle()
    : { data: null, error: null };
  if (mandateResult.error) throw new AppError("Lead management is temporarily unavailable", 503, "LEADS_UNAVAILABLE");
  let seller: { fullName: string | null; companyName: string | null } | null = null;
  if (property?.owner_id) {
    const [sellerProfile, sellerPersona] = await Promise.all([
      supabaseAdmin.from("profiles").select("full_name").eq("id", property.owner_id).maybeSingle(),
      supabaseAdmin.from("user_personas").select("id").eq("user_id", property.owner_id).eq("persona_type", "SELLER_DEVELOPER").maybeSingle()
    ]);
    if (sellerProfile.error || sellerPersona.error) throw new AppError("Lead management is temporarily unavailable", 503, "LEADS_UNAVAILABLE");
    let companyName: string | null = null;
    if (sellerPersona.data?.id) {
      const sellerBusiness = await supabaseAdmin.from("seller_profiles").select("company_name").eq("user_persona_id", sellerPersona.data.id).maybeSingle();
      if (sellerBusiness.error) throw new AppError("Lead management is temporarily unavailable", 503, "LEADS_UNAVAILABLE");
      companyName = sellerBusiness.data?.company_name ?? null;
    }
    seller = { fullName: sellerProfile.data?.full_name ?? null, companyName };
  }

  const profile: any = profileResult.data;
  const images = [...(property?.property_images ?? [])].sort((a: any, b: any) => a.sort_order - b.sort_order);
  const cover = images.find((item: any) => item.is_cover) ?? images[0] ?? null;
  const message = String(inquiry.message ?? "").trim();
  return {
    id: inquiry.id,
    referenceId: leadReference(inquiry.id),
    stage: canonicalLeadStage(inquiry.lead_stage, inquiry.status),
    inquiryType: inquiry.inquiry_type,
    receivedAt: inquiry.created_at,
    updatedAt: inquiry.updated_at,
    customer: {
      id: inquiry.user_id,
      fullName: profile?.full_name ?? inquiry.full_name,
      email: profile?.email ?? inquiry.email,
      phone: profile?.phone_number ?? inquiry.phone_number,
      emailVerified: Boolean(profile?.email_verified_at),
      accountStatus: profile?.account_status ?? null,
      preferredContactMethod: preferredContact(inquiry.inquiry_type),
      personas: (personasResult.data ?? []).map((row: any) => ({ type: row.persona_type, onboardingStatus: row.onboarding_status }))
    },
    message: !message || message === "Marketplace interest submitted" ? null : message,
    property: property ? {
      id: property.id,
      referenceId: property.property_code,
      title: property.title,
      publicLocation: property.public_location,
      askingPrice: property.price,
      propertyCategory: property.category,
      propertyType: property.property_type,
      marketplaceStatus: property.marketplace_status,
      initialDepositType: property.initial_deposit_type,
      initialDepositValue: property.initial_deposit_value,
      mandateType: mandateResult.data?.marketplace_mandate_type ?? null,
      coverImage: cover ? imageDto(cover) : null,
      seller
    } : null,
    history: (historyResult.data ?? []).map((row: any) => ({ id: row.id, previousStage: row.previous_stage, newStage: row.new_stage, changedByAdminId: row.changed_by_admin_id, createdAt: row.created_at }))
  };
};

export const updateLeadStage = async (leadId: string, adminId: string, expectedStage: LeadStage, stage: LeadStage) => {
  const { data, error } = await supabaseAdmin.rpc("transition_admin_inquiry_lead_stage", {
    p_inquiry_id: leadId,
    p_admin_id: adminId,
    p_expected_stage: expectedStage,
    p_new_stage: stage
  });
  if (error) throw new AppError("Lead stage could not be updated", 503, "LEAD_UPDATE_FAILED");
  const result = Array.isArray(data) ? data[0] : data;
  if (!result || result.outcome === "NOT_FOUND") throw new AppError("Lead not found", 404, "LEAD_NOT_FOUND");
  if (result.outcome === "STALE") throw new AppError("Lead stage changed before this update", 409, "LEAD_STAGE_CONFLICT", { currentStage: result.current_stage });
  if (result.outcome === "INVALID_TRANSITION") throw new AppError("This lead stage transition is not allowed", 409, "INVALID_LEAD_TRANSITION", { currentStage: result.current_stage });
  if (result.outcome !== "UPDATED") throw new AppError("Lead stage could not be updated", 503, "LEAD_UPDATE_FAILED");
  return { leadId: result.inquiry_id, previousStage: result.previous_stage, stage: result.current_stage, changedAt: result.changed_at };
};
