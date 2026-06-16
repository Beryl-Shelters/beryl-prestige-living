import { supabaseAdmin } from "../../config/supabase";
import { AppError } from "../../utils/AppError";


export const createReport = async (
  reporterId: string,
  payload: any
) => {
  if (payload.property_id) {
    const { data: property } = await supabaseAdmin
      .from("properties")
      .select("id")
      .eq("id", payload.property_id)
      .maybeSingle();

    if (!property) {
      throw new AppError("Property not found", 404);
    }
  }

  const { data, error } = await supabaseAdmin
    .from("reports")
    .insert({
      reporter_id: reporterId,
      property_id: payload.property_id,
      agent_id: payload.agent_id,
      report_type: payload.report_type,
      reason: payload.reason,
      status: "pending"
    })
    .select()
    .single();

  if (error) {
    throw new AppError(error.message, 400);
  }

  return data;
};



export const getMyReports = async (
  reporterId: string,
  page = 1,
  limit = 10
) => {
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const { data, count, error } = await supabaseAdmin
    .from("reports")
    .select("*", { count: "exact" })
    .eq("reporter_id", reporterId)
    .range(from, to)
    .order("created_at", { ascending: false });

  if (error) {
    throw new AppError(error.message, 400);
  }

  return {
    reports: data,
    pagination: {
      page,
      limit,
      total: count || 0
    }
  };
};


export const getReportById = async (
  reportId: string,
  userId: string,
  role?: string
) => {
  const { data, error } = await supabaseAdmin
    .from("reports")
    .select("*")
    .eq("id", reportId)
    .single();

  if (error || !data) {
    throw new AppError("Report not found", 404);
  }

  const isAdmin = [
    "admin",
    "support_agent",
    "super_admin"
  ].includes(role || "");

  if (
    !isAdmin &&
    data.reporter_id !== userId
  ) {
    throw new AppError("Forbidden", 403);
  }

  return data;
};



export const adminReports = async (
  filters: any
) => {
  let query = supabaseAdmin
    .from("reports")
    .select("*", { count: "exact" });

  if (filters.status) {
    query = query.eq("status", filters.status);
  }

  if (filters.report_type) {
    query = query.eq(
      "report_type",
      filters.report_type
    );
  }

  const page = Number(filters.page || 1);
  const limit = Number(filters.limit || 10);

  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const { data, count, error } =
    await query
      .range(from, to)
      .order("created_at", {
        ascending: false
      });

  if (error) {
    throw new AppError(error.message, 400);
  }

  return {
    reports: data,
    pagination: {
      page,
      limit,
      total: count || 0
    }
  };
};


export const reviewReport = async (
  reportId: string,
  reviewerId: string,
  payload: any
) => {
  const { data, error } = await supabaseAdmin
    .from("reports")
    .update({
      status: payload.status,
      resolution_note:
        payload.resolution_note,
      reviewed_by: reviewerId,
      reviewed_at:
        new Date().toISOString()
    })
    .eq("id", reportId)
    .select()
    .single();

  if (error) {
    throw new AppError(error.message, 400);
  }

  return data;
};


export const deleteReport = async (
  reportId: string,
  userId: string,
  role?: string
) => {
  const report = await getReportById(
    reportId,
    userId,
    role
  );

  const isAdmin = [
    "admin",
    "support_agent",
    "super_admin"
  ].includes(role || "");

  if (
    !isAdmin &&
    report.status !== "pending"
  ) {
    throw new AppError(
      "Cannot delete reviewed report",
      400
    );
  }

  const { error } = await supabaseAdmin
    .from("reports")
    .update({
      status: "rejected"
    })
    .eq("id", reportId);

  if (error) {
    throw new AppError(error.message, 400);
  }
};