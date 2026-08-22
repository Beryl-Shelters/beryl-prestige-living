import { supabaseAdmin } from "../../config/supabase";
import { AppError } from "../../utils/AppError";
import type { MarketplaceInterestInput } from "../marketplace/marketplace.validators";

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

export const createMarketplaceInterest=async(propertyId:string,userId:string,input:MarketplaceInterestInput)=>{
  const [propertyResult,profileResult]=await Promise.all([
    supabaseAdmin.from("properties").select("id,property_code,title,price,property_type,category,marketplace_status").eq("id",propertyId).eq("marketplace_status","LIVE").maybeSingle(),
    supabaseAdmin.from("profiles").select("full_name,first_name,last_name,email,phone_number,is_whatsapp_number,whatsapp_number").eq("id",userId).maybeSingle()
  ]);
  if(propertyResult.error)throw new AppError("Interest submission is temporarily unavailable",503,"INTEREST_SUBMISSION_FAILED");
  if(!propertyResult.data)throw new AppError("Property is not available",404,"PROPERTY_NOT_AVAILABLE");
  if(profileResult.error||!profileResult.data)throw new AppError("Inquiry service is temporarily unavailable",503,"INQUIRY_UNAVAILABLE");
  const property=propertyResult.data;const profile=profileResult.data;
  const fullName=String(profile.full_name??`${profile.first_name??""} ${profile.last_name??""}`).trim();
  const email=typeof profile.email==="string"?profile.email.trim():"";
  const phone=typeof profile.phone_number==="string"?profile.phone_number.trim():"";
  const whatsapp=typeof profile.whatsapp_number==="string"&&profile.whatsapp_number.trim()?profile.whatsapp_number.trim():(profile.is_whatsapp_number?phone:"");
  const available={WHATSAPP:Boolean(whatsapp),CALL:Boolean(phone),EMAIL:Boolean(email)} as const;
  if(!available[input.contactMethod])throw new AppError("Preferred contact method is unavailable",409,"CONTACT_METHOD_UNAVAILABLE");
  if(!fullName||!email||!phone)throw new AppError("Inquiry service is temporarily unavailable",503,"INQUIRY_UNAVAILABLE");
  const inquiryTypeByContactMethod={WHATSAPP:"MARKETPLACE_INTEREST_WHATSAPP",CALL:"MARKETPLACE_INTEREST_CALL",EMAIL:"MARKETPLACE_INTEREST_EMAIL"} as const;
  const {data,error}=await supabaseAdmin.from("inquiries").insert({user_id:userId,property_id:propertyId,inquiry_type:inquiryTypeByContactMethod[input.contactMethod],full_name:fullName,email,phone_number:input.contactMethod==="WHATSAPP"?whatsapp:phone,message:input.message??"Marketplace interest submitted",status:"new"}).select("id,property_id,inquiry_type,status,created_at").single();
  if(error||!data)throw new AppError("Interest submission is temporarily unavailable",503,"INTEREST_SUBMISSION_FAILED");
  return {inquiryId:data.id,propertyId:property.id,referenceId:property.property_code,title:property.title,askingPrice:property.price,preferredContactMethod:input.contactMethod,submittedAt:data.created_at,nextAction:"KEEP_BROWSING" as const};
};
