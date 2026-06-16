import { supabaseAdmin } from "../../config/supabase";
import { AppError } from "../../utils/AppError";
import { createNotification } from "../../utils/notification";

const countRows = async (table: string, filters?: Record<string, any>) => {
  let request = supabaseAdmin.from(table).select("*", {
    count: "exact",
    head: true
  });

  if (filters) {
    for (const [key, value] of Object.entries(filters)) {
      request = request.eq(key, value);
    }
  }

  const { count, error } = await request;

  if (error) {
    throw new AppError(error.message, 400);
  }

  return count || 0;
};

export const getAdminDashboard = async () => {
  const [
    totalUsers,
    verifiedUsers,
    unverifiedUsers,
    totalProperties,
    publishedProperties,
    pendingProperties,
    archivedProperties,
    activeListings,
    pendingListings,
    soldListings,
    pendingReports,
    pendingMandates,
    totalTransactions
  ] = await Promise.all([
    countRows("profiles"),
    countRows("profiles", { verification_status: "verified" }),
    countRows("profiles", { verification_status: "unverified" }),
    countRows("properties"),
    countRows("properties", { is_published: true }),
    countRows("properties", { status: "pending" }),
    countRows("properties", { status: "archived" }),
    countRows("listings", { status: "active" }),
    countRows("listings", { status: "pending" }),
    countRows("listings", { status: "sold" }),
    countRows("reports", { status: "pending" }),
    countRows("mandates", { status: "pending" }),
    countRows("transactions")
  ]);

  const { data: transactions, error: transactionError } = await supabaseAdmin
    .from("transactions")
    .select("amount");

  if (transactionError) {
    throw new AppError(transactionError.message, 400);
  }

  const transactionVolume =
    transactions?.reduce((sum, item) => sum + Number(item.amount || 0), 0) || 0;

  return {
    users: {
      total: totalUsers,
      verified: verifiedUsers,
      unverified: unverifiedUsers
    },
    properties: {
      total: totalProperties,
      published: publishedProperties,
      pending: pendingProperties,
      archived: archivedProperties
    },
    listings: {
      active: activeListings,
      pending: pendingListings,
      sold: soldListings
    },
    transactions: {
      count: totalTransactions,
      volume: transactionVolume
    },
    reports: {
      pending: pendingReports
    },
    mandates: {
      pending: pendingMandates
    }
  };
};

export const getAdminUsers = async (query: Record<string, any>) => {
  const page = Number(query.page || 1);
  const limit = Number(query.limit || 10);
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let request = supabaseAdmin
    .from("profiles")
    .select("*", { count: "exact" });

  if (query.role) {
    request = request.eq("role", query.role);
  }

  if (query.verification_status) {
    request = request.eq("verification_status", query.verification_status);
  }

  if (query.search) {
    request = request.or(
      `first_name.ilike.%${query.search}%,last_name.ilike.%${query.search}%,email.ilike.%${query.search}%,phone_number.ilike.%${query.search}%`
    );
  }

  const { data, error, count } = await request
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    throw new AppError(error.message, 400);
  }

  return {
    users: data,
    pagination: {
      page,
      limit,
      total: count || 0,
      total_pages: Math.ceil((count || 0) / limit)
    }
  };
};

export const getAdminUserById = async (userId: string) => {
  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (profileError || !profile) {
    throw new AppError("User profile not found", 404);
  }

  const [
    propertiesResult,
    listingsResult,
    buyerTransactionsResult,
    sellerTransactionsResult,
    agentTransactionsResult
  ] = await Promise.all([
    supabaseAdmin.from("properties").select("*").eq("owner_id", userId),
    supabaseAdmin.from("listings").select("*").eq("listed_by", userId),
    supabaseAdmin.from("transactions").select("*").eq("buyer_id", userId),
    supabaseAdmin.from("transactions").select("*").eq("seller_id", userId),
    supabaseAdmin.from("transactions").select("*").eq("agent_id", userId)
  ]);

  return {
    profile,
    properties: propertiesResult.data || [],
    listings: listingsResult.data || [],
    transactions: [
      ...(buyerTransactionsResult.data || []),
      ...(sellerTransactionsResult.data || []),
      ...(agentTransactionsResult.data || [])
    ]
  };
};

export const updateAdminUserStatus = async (
  userId: string,
  isActive: boolean
) => {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .update({ is_active: isActive })
    .eq("id", userId)
    .select("*")
    .single();

  if (error || !data) {
    throw new AppError(error?.message || "User profile not found", 404);
  }

  await createNotification({
    userId,
    type: "account",
    title: isActive ? "Account Activated" : "Account Suspended",
    message: isActive
      ? "Your account has been activated."
      : "Your account has been suspended. Please contact support.",
    metadata: {
      is_active: isActive
    }
  });

  return data;
};

export const verifyAdminUser = async (
  userId: string,
  verificationStatus: string
) => {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .update({ verification_status: verificationStatus })
    .eq("id", userId)
    .select("*")
    .single();

  if (error || !data) {
    throw new AppError(error?.message || "User profile not found", 404);
  }

  await createNotification({
    userId,
    type: "verification",
    title: "Verification Status Updated",
    message: `Your verification status is now ${verificationStatus}.`,
    metadata: {
      verification_status: verificationStatus
    }
  });

  return data;
};

export const getPendingProperties = async (query: Record<string, any>) => {
  const page = Number(query.page || 1);
  const limit = Number(query.limit || 10);
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const { data, error, count } = await supabaseAdmin
    .from("properties")
    .select(
      `
      *,
      owner:profiles!properties_owner_id_fkey (
        id,
        first_name,
        last_name,
        email,
        phone_number,
        role
      )
    `,
      { count: "exact" }
    )
    .eq("status", "pending")
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

export const approveAdminProperty = async (
  propertyId: string,
  adminId: string
) => {
  const { data: property, error: propertyError } = await supabaseAdmin
    .from("properties")
    .select("id, owner_id, title")
    .eq("id", propertyId)
    .single();

  if (propertyError || !property) {
    throw new AppError("Property not found", 404);
  }

  const { data, error } = await supabaseAdmin
    .from("properties")
    .update({
      status: "approved",
      is_published: true,
      approved_by: adminId,
      approved_at: new Date().toISOString(),
      rejection_reason: null
    })
    .eq("id", propertyId)
    .select("*")
    .single();

  if (error) {
    throw new AppError(error.message, 400);
  }

  await createNotification({
    userId: property.owner_id,
    type: "property",
    title: "Property Approved",
    message: `Your property "${property.title}" has been approved and published.`,
    metadata: {
      property_id: propertyId
    }
  });

  return data;
};

export const rejectAdminProperty = async (
  propertyId: string,
  adminId: string,
  rejectionReason: string
) => {
  const { data: property, error: propertyError } = await supabaseAdmin
    .from("properties")
    .select("id, owner_id, title")
    .eq("id", propertyId)
    .single();

  if (propertyError || !property) {
    throw new AppError("Property not found", 404);
  }

  const { data, error } = await supabaseAdmin
    .from("properties")
    .update({
      status: "rejected",
      is_published: false,
      rejection_reason: rejectionReason,
      approved_by: adminId,
      approved_at: new Date().toISOString()
    })
    .eq("id", propertyId)
    .select("*")
    .single();

  if (error) {
    throw new AppError(error.message, 400);
  }

  await createNotification({
    userId: property.owner_id,
    type: "property",
    title: "Property Rejected",
    message: `Your property "${property.title}" was rejected. Reason: ${rejectionReason}`,
    metadata: {
      property_id: propertyId,
      rejection_reason: rejectionReason
    }
  });

  return data;
};

export const getPendingListings = async (query: Record<string, any>) => {
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
        thumbnail_url
      ),
      listed_user:profiles!listings_listed_by_fkey (
        id,
        first_name,
        last_name,
        email,
        phone_number,
        role
      )
    `,
      { count: "exact" }
    )
    .eq("status", "pending")
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

export const getPendingReports = async (query: Record<string, any>) => {
  const page = Number(query.page || 1);
  const limit = Number(query.limit || 10);
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const { data, error, count } = await supabaseAdmin
    .from("reports")
    .select("*", { count: "exact" })
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    throw new AppError(error.message, 400);
  }

  return {
    reports: data,
    pagination: {
      page,
      limit,
      total: count || 0,
      total_pages: Math.ceil((count || 0) / limit)
    }
  };
};

export const getPendingMandates = async (query: Record<string, any>) => {
  const page = Number(query.page || 1);
  const limit = Number(query.limit || 10);
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const { data, error, count } = await supabaseAdmin
    .from("mandates")
    .select("*", { count: "exact" })
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    throw new AppError(error.message, 400);
  }

  return {
    mandates: data,
    pagination: {
      page,
      limit,
      total: count || 0,
      total_pages: Math.ceil((count || 0) / limit)
    }
  };
};


export const createSuperAdminUser = async (
  actorId: string,
  payload: Record<string, any>
) => {
  const { data: authData, error: authError } =
    await supabaseAdmin.auth.admin.createUser({
      email: payload.email,
      password: payload.password,
      email_confirm: true,
      user_metadata: {
        first_name: payload.first_name,
        last_name: payload.last_name,
        role: payload.role
      }
    });

  if (authError || !authData.user) {
    throw new AppError(authError?.message || "Failed to create user", 400);
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .insert({
      id: authData.user.id,
      first_name: payload.first_name,
      last_name: payload.last_name,
      email: payload.email,
      phone_number: payload.phone_number || null,
      role: payload.role,
      profile_type: "business",
      verification_status: "verified",
      is_active: true
    })
    .select("*")
    .single();

  if (profileError) {
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
    throw new AppError(profileError.message, 400);
  }

  await supabaseAdmin.from("audit_logs").insert({
    actor_id: actorId,
    action: "create_admin_user",
    entity_type: "profiles",
    entity_id: authData.user.id,
    metadata: { role: payload.role }
  });

  return {
    user: authData.user,
    profile
  };
};

export const updateSuperAdminUserRole = async (
  actorId: string,
  userId: string,
  role: string
) => {
  if (role === "super_admin") {
    throw new AppError("Cannot assign super_admin role through API", 400);
  }

  const { data: profile, error } = await supabaseAdmin
    .from("profiles")
    .update({ role })
    .eq("id", userId)
    .select("*")
    .single();

  if (error || !profile) {
    throw new AppError(error?.message || "User profile not found", 404);
  }

  await supabaseAdmin.auth.admin.updateUserById(userId, {
    user_metadata: { role }
  });

  await createNotification({
    userId,
    type: "account",
    title: "Account Role Updated",
    message: `Your account role has been updated to ${role}.`,
    metadata: { role }
  });

  await supabaseAdmin.from("audit_logs").insert({
    actor_id: actorId,
    action: "update_user_role",
    entity_type: "profiles",
    entity_id: userId,
    metadata: { role }
  });

  return profile;
};

export const deactivateSuperAdminUser = async (
  actorId: string,
  userId: string
) => {
  const { data: profile, error } = await supabaseAdmin
    .from("profiles")
    .update({ is_active: false })
    .eq("id", userId)
    .select("*")
    .single();

  if (error || !profile) {
    throw new AppError(error?.message || "User profile not found", 404);
  }

  await createNotification({
    userId,
    type: "account",
    title: "Account Deactivated",
    message: "Your account has been deactivated. Please contact support.",
    metadata: { is_active: false }
  });

  await supabaseAdmin.from("audit_logs").insert({
    actor_id: actorId,
    action: "deactivate_user",
    entity_type: "profiles",
    entity_id: userId,
    metadata: { is_active: false }
  });

  return profile;
};

export const getAuditLogs = async (query: Record<string, any>) => {
  const page = Number(query.page || 1);
  const limit = Number(query.limit || 10);
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let request = supabaseAdmin
    .from("audit_logs")
    .select("*", { count: "exact" });

  if (query.action) {
    request = request.eq("action", query.action);
  }

  if (query.actor_id) {
    request = request.eq("actor_id", query.actor_id);
  }

  const { data, error, count } = await request
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    throw new AppError(error.message, 400);
  }

  return {
    audit_logs: data,
    pagination: {
      page,
      limit,
      total: count || 0,
      total_pages: Math.ceil((count || 0) / limit)
    }
  };
};

const groupCount = async (table: string, column: string) => {
  const { data, error } = await supabaseAdmin.from(table).select(column);

  if (error) {
    throw new AppError(error.message, 400);
  }

  return data.reduce((acc: Record<string, number>, item: any) => {
    const key = item[column] || "unknown";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
};

export const getSystemStats = async () => {
  const [
    usersByRole,
    propertiesByStatus,
    listingsByStatus,
    transactionsByStatus,
    reportsByStatus,
    mandatesByStatus
  ] = await Promise.all([
    groupCount("profiles", "role"),
    groupCount("properties", "status"),
    groupCount("listings", "status"),
    groupCount("transactions", "status"),
    groupCount("reports", "status"),
    groupCount("mandates", "status")
  ]);

  return {
    users_by_role: usersByRole,
    properties_by_status: propertiesByStatus,
    listings_by_status: listingsByStatus,
    transactions_by_status: transactionsByStatus,
    reports_by_status: reportsByStatus,
    mandates_by_status: mandatesByStatus
  };
};