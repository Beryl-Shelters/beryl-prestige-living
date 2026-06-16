import { supabaseAdmin } from "../../config/supabase";
import { AppError } from "../../utils/AppError";

const staffRoles = ["admin", "super_admin"];

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

export const createTransaction = async (
  creatorId: string,
  payload: Record<string, any>
) => {
  const creatorRole = await getUserRole(creatorId);

  if (!staffRoles.includes(creatorRole)) {
    throw new AppError("Only admin users can create transactions", 403);
  }

  const { data: property, error: propertyError } = await supabaseAdmin
    .from("properties")
    .select("id, owner_id, agent_id, price")
    .eq("id", payload.property_id)
    .single();

  if (propertyError || !property) {
    throw new AppError("Property not found", 404);
  }

  const { data: buyer, error: buyerError } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("id", payload.buyer_id)
    .single();

  if (buyerError || !buyer) {
    throw new AppError("Buyer profile not found", 404);
  }

  if (payload.seller_id) {
    const { data: seller } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("id", payload.seller_id)
      .single();

    if (!seller) {
      throw new AppError("Seller profile not found", 404);
    }
  }

  if (payload.agent_id) {
    const { data: agent } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("id", payload.agent_id)
      .single();

    if (!agent) {
      throw new AppError("Agent profile not found", 404);
    }
  }

  if (payload.referral_id) {
    const { data: referral } = await supabaseAdmin
      .from("referrals")
      .select("id")
      .eq("id", payload.referral_id)
      .single();

    if (!referral) {
      throw new AppError("Referral record not found", 404);
    }
  }

  const { data, error } = await supabaseAdmin
    .from("transactions")
    .insert({
      property_id: payload.property_id,
      buyer_id: payload.buyer_id,
      seller_id: payload.seller_id || property.owner_id || null,
      agent_id: payload.agent_id || property.agent_id || null,
      referral_id: payload.referral_id || null,
      amount: payload.amount,
      commission_amount: payload.commission_amount || 0,
      referral_commission_amount: payload.referral_commission_amount || 0,
      status: "pending",
      payment_reference: payload.payment_reference || null,
      payment_method: payload.payment_method || null,
      metadata: payload.metadata || {}
    })
    .select("*")
    .single();

  if (error) {
    throw new AppError(error.message, 400);
  }

  return data;
};

export const getMyTransactions = async (
  userId: string,
  query: Record<string, any>
) => {
  const page = Number(query.page || 1);
  const limit = Number(query.limit || 10);
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const { data, error, count } = await supabaseAdmin
    .from("transactions")
    .select(
      `
      *,
      property:properties (
        id,
        title,
        property_code,
        price,
        thumbnail_url
      )
    `,
      { count: "exact" }
    )
    .or(`buyer_id.eq.${userId},seller_id.eq.${userId},agent_id.eq.${userId}`)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    throw new AppError(error.message, 400);
  }

  return {
    transactions: data,
    pagination: {
      page,
      limit,
      total: count || 0,
      total_pages: Math.ceil((count || 0) / limit)
    }
  };
};

export const getTransactionById = async (
  transactionId: string,
  userId: string
) => {
  const { data: transaction, error } = await supabaseAdmin
    .from("transactions")
    .select(
      `
      *,
      property:properties (
        id,
        title,
        property_code,
        price,
        thumbnail_url
      ),
      buyer:profiles!transactions_buyer_id_fkey (
        id,
        first_name,
        last_name,
        email,
        phone_number
      ),
      seller:profiles!transactions_seller_id_fkey (
        id,
        first_name,
        last_name,
        email,
        phone_number
      ),
      agent:profiles!transactions_agent_id_fkey (
        id,
        first_name,
        last_name,
        email,
        phone_number
      ),
      referral:referrals (
        id,
        referral_code,
        earned_commission,
        status
      )
    `
    )
    .eq("id", transactionId)
    .single();

  if (error || !transaction) {
    throw new AppError("Transaction not found", 404);
  }

  const role = await getUserRole(userId);
  const isStaff = staffRoles.includes(role);
  const isParticipant =
    transaction.buyer_id === userId ||
    transaction.seller_id === userId ||
    transaction.agent_id === userId;

  if (!isStaff && !isParticipant) {
    throw new AppError("You are not allowed to view this transaction", 403);
  }

  return transaction;
};

export const getAdminTransactions = async (query: Record<string, any>) => {
  const page = Number(query.page || 1);
  const limit = Number(query.limit || 10);
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let request = supabaseAdmin
    .from("transactions")
    .select(
      `
      *,
      property:properties (
        id,
        title,
        property_code,
        price,
        thumbnail_url
      ),
      buyer:profiles!transactions_buyer_id_fkey (
        id,
        first_name,
        last_name,
        email,
        phone_number
      )
    `,
      { count: "exact" }
    );

  if (query.status) {
    request = request.eq("status", query.status);
  }

  if (query.property_id) {
    request = request.eq("property_id", query.property_id);
  }

  if (query.buyer_id) {
    request = request.eq("buyer_id", query.buyer_id);
  }

  const { data, error, count } = await request
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    throw new AppError(error.message, 400);
  }

  return {
    transactions: data,
    pagination: {
      page,
      limit,
      total: count || 0,
      total_pages: Math.ceil((count || 0) / limit)
    }
  };
};

export const updateTransactionStatus = async (
  transactionId: string,
  payload: Record<string, any>
) => {
  const updateData: Record<string, any> = {
    status: payload.status
  };

  if (payload.payment_reference !== undefined) {
    updateData.payment_reference = payload.payment_reference;
  }

  if (payload.payment_method !== undefined) {
    updateData.payment_method = payload.payment_method;
  }

  if (payload.commission_amount !== undefined) {
    updateData.commission_amount = payload.commission_amount;
  }

  if (payload.referral_commission_amount !== undefined) {
    updateData.referral_commission_amount = payload.referral_commission_amount;
  }

  if (payload.metadata !== undefined) {
    updateData.metadata = payload.metadata;
  }

  if (payload.status === "closed") {
    updateData.closed_at = new Date().toISOString();
  }

  const { data: transaction, error } = await supabaseAdmin
    .from("transactions")
    .update(updateData)
    .eq("id", transactionId)
    .select("*")
    .single();

  if (error || !transaction) {
    throw new AppError(error?.message || "Transaction not found", 404);
  }

  if (payload.status === "closed") {
    await supabaseAdmin
      .from("properties")
      .update({
        status: "sold",
        is_published: false
      })
      .eq("id", transaction.property_id);

    if (transaction.referral_id) {
      await supabaseAdmin
        .from("referrals")
        .update({
          status: "converted",
          earned_commission:
            transaction.referral_commission_amount || 0,
          converted_at: new Date().toISOString()
        })
        .eq("id", transaction.referral_id);
    }
  }

  return transaction;
};