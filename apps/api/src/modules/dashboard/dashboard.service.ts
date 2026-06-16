import { supabaseAdmin } from "../../config/supabase";
import { AppError } from "../../utils/AppError";

export const getOverview = async (userId: string, role: string) => {
  // base counts
  const [properties, listings, saved, notifications, messages] =
    await Promise.all([
      supabaseAdmin.from("properties").select("*", { count: "exact", head: true }).eq("owner_id", userId),
      supabaseAdmin.from("listings").select("*", { count: "exact", head: true }).eq("listed_by", userId),
      supabaseAdmin.from("saved_properties").select("*", { count: "exact", head: true }).eq("user_id", userId),
      supabaseAdmin.from("notifications").select("*", { count: "exact", head: true }).eq("user_id", userId).eq("is_read", false),
      supabaseAdmin.from("ticket_messages").select("*", { count: "exact", head: true }).eq("sender_id", userId)
    ]);

  // transactions (buyer or seller)
  const { data: tx } = await supabaseAdmin
    .from("transactions")
    .select("amount")
    .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`);

  const totalSpend = tx?.reduce((sum, t) => sum + Number(t.amount || 0), 0) || 0;

  const { data: referrals } = await supabaseAdmin
    .from("referrals")
    .select("earned_commission")
    .eq("referrer_id", userId);

  const referralEarnings =
    referrals?.reduce((sum, r) => sum + Number(r.earned_commission || 0), 0) || 0;

  return {
    total_properties: properties.count || 0,
    total_listings: listings.count || 0,
    saved_properties_count: saved.count || 0,
    unread_notifications: notifications.count || 0,
    unread_messages: messages.count || 0,
    total_spend: totalSpend,
    referral_earnings: referralEarnings,
    total_purchases: tx?.length || 0
  };
};

export const getInvestments = async (userId: string, period: "monthly" | "yearly") => {
  const { data, error } = await supabaseAdmin
    .from("transactions")
    .select("amount, created_at")
    .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`);

  if (error) throw new AppError(error.message, 500);

  const grouped: Record<string, number> = {};

  data?.forEach((t) => {
    const date = new Date(t.created_at);
    const key =
      period === "monthly"
        ? `${date.getFullYear()}-${date.getMonth() + 1}`
        : `${date.getFullYear()}`;

    grouped[key] = (grouped[key] || 0) + Number(t.amount);
  });

  return grouped;
};

export const getRecentMessages = async (userId: string) => {
  const { data } = await supabaseAdmin
    .from("ticket_messages")
    .select("*")
    .eq("sender_id", userId)
    .order("created_at", { ascending: false })
    .limit(10);

  return data;
};

export const getRecentProperties = async (userId: string) => {
  const { data } = await supabaseAdmin
    .from("properties")
    .select("*")
    .eq("owner_id", userId)
    .order("created_at", { ascending: false })
    .limit(10);

  return data;
};

export const getAdminSummary = async () => {
  const [users, properties, listings, tx, reports, mandates, tickets] =
    await Promise.all([
      supabaseAdmin.from("profiles").select("*", { count: "exact", head: true }),
      supabaseAdmin.from("properties").select("*", { count: "exact", head: true }),
      supabaseAdmin.from("listings").select("*", { count: "exact", head: true }),
      supabaseAdmin.from("transactions").select("amount"),
      supabaseAdmin.from("reports").select("*", { count: "exact", head: true }),
      supabaseAdmin.from("mandates").select("*", { count: "exact", head: true }),
      supabaseAdmin.from("support_tickets").select("*", { count: "exact", head: true })
    ]);

  const revenue = tx.data?.reduce((s, t) => s + Number(t.amount || 0), 0) || 0;

  return {
    users: users.count || 0,
    properties: properties.count || 0,
    listings: listings.count || 0,
    transactions: tx.data?.length || 0,
    reports: reports.count || 0,
    mandates: mandates.count || 0,
    support_tickets: tickets.count || 0,
    revenue_volume: revenue
  };
};