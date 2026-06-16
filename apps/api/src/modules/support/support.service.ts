import { supabaseAdmin } from "../../config/supabase";
import { AppError } from "../../utils/AppError";

const staffRoles = ["admin", "support_agent", "super_admin"];
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

export const createSupportTicket = async (
  userId: string,
  payload: Record<string, any>
) => {
  const { data, error } = await supabaseAdmin
    .from("support_tickets")
    .insert({
      user_id: userId,
      subject: payload.subject,
      message: payload.message,
      priority: payload.priority || "medium",
      status: "open"
    })
    .select("*")
    .single();

  if (error) {
    throw new AppError(error.message, 400);
  }

  return data;
};

export const getMySupportTickets = async (
  userId: string,
  query: Record<string, any>
) => {
  const page = Number(query.page || 1);
  const limit = Number(query.limit || 10);
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const { data, error, count } = await supabaseAdmin
    .from("support_tickets")
    .select("*", { count: "exact" })
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    throw new AppError(error.message, 400);
  }

  return {
    tickets: data,
    pagination: {
      page,
      limit,
      total: count || 0,
      total_pages: Math.ceil((count || 0) / limit)
    }
  };
};

export const getSupportTicketById = async (
  ticketId: string,
  userId: string
) => {
  const { data: ticket, error } = await supabaseAdmin
    .from("support_tickets")
    .select(
      `
      *,
      messages:ticket_messages (
        *
      )
    `
    )
    .eq("id", ticketId)
    .single();

  if (error || !ticket) {
    throw new AppError("Support ticket not found", 404);
  }

  const role = await getUserRole(userId);
  const isOwner = ticket.user_id === userId;
  const isStaff = staffRoles.includes(role);

  if (!isOwner && !isStaff) {
    throw new AppError("You are not allowed to view this support ticket", 403);
  }

  return ticket;
};

export const addSupportTicketMessage = async (
  ticketId: string,
  userId: string,
  payload: Record<string, any>
) => {
  const { data: ticket, error: ticketError } = await supabaseAdmin
    .from("support_tickets")
    .select("id, user_id")
    .eq("id", ticketId)
    .single();

  if (ticketError || !ticket) {
    throw new AppError("Support ticket not found", 404);
  }

  const role = await getUserRole(userId);
  const isOwner = ticket.user_id === userId;
  const isStaff = staffRoles.includes(role);

  if (!isOwner && !isStaff) {
    throw new AppError("You are not allowed to reply to this ticket", 403);
  }

  const senderType = isStaff ? "staff" : "user";

  const { data: message, error } = await supabaseAdmin
    .from("ticket_messages")
    .insert({
      ticket_id: ticketId,
      sender_id: userId,
      sender_type: senderType,
      message: payload.message,
      attachment_url: payload.attachment_url || null,
      is_read: false
    })
    .select("*")
    .single();

  if (error) {
    throw new AppError(error.message, 400);
  }

  if (ticket && payload.message) {
    await supabaseAdmin
      .from("support_tickets")
      .update({
        status: "in_progress"
      })
      .eq("id", ticketId);
  }

  return message;
};

export const updateSupportTicketStatus = async (
  ticketId: string,
  payload: Record<string, any>
) => {
  const { data, error } = await supabaseAdmin
    .from("support_tickets")
    .update({
      status: payload.status
    })
    .eq("id", ticketId)
    .select("*")
    .single();

  if (error || !data) {
    throw new AppError(error?.message || "Support ticket not found", 404);
  }

  return data;
};

export const getAllSupportTickets = async (query: Record<string, any>) => {
  const page = Number(query.page || 1);
  const limit = Number(query.limit || 10);
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let request = supabaseAdmin
    .from("support_tickets")
    .select(
      `
      *,
      user:profiles!support_tickets_user_id_fkey (
        id,
        first_name,
        last_name,
        email,
        phone_number,
        role
      ),
      assigned_staff:profiles!support_tickets_assigned_to_fkey (
        id,
        first_name,
        last_name,
        email,
        role
      )
    `,
      { count: "exact" }
    );

  if (query.status) {
    request = request.eq("status", query.status);
  }

  if (query.priority) {
    request = request.eq("priority", query.priority);
  }

  if (query.assigned_to) {
    request = request.eq("assigned_to", query.assigned_to);
  }

  const { data, error, count } = await request
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    throw new AppError(error.message, 400);
  }

  return {
    tickets: data,
    pagination: {
      page,
      limit,
      total: count || 0,
      total_pages: Math.ceil((count || 0) / limit)
    }
  };
};

export const assignSupportTicket = async (
  ticketId: string,
  assignedTo: string
) => {
  const role = await getUserRole(assignedTo);

  if (!staffRoles.includes(role)) {
    throw new AppError("Ticket can only be assigned to admin or support staff", 400);
  }

  const { data, error } = await supabaseAdmin
    .from("support_tickets")
    .update({
      assigned_to: assignedTo,
      status: "in_progress"
    })
    .eq("id", ticketId)
    .select("*")
    .single();

  if (error || !data) {
    throw new AppError(error?.message || "Support ticket not found", 404);
  }

  return data;
};