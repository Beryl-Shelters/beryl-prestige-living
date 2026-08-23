"use client";

import { ArrowLeft, BriefcaseBusiness, Building2, Mail, MapPin, Phone, UserRound } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { AdminCustomerDetail, AdminCustomerRole, ApiEnvelope } from "@/lib/contracts";
import { customerInitials, formatAdminCurrency, formatAdminDate } from "@/lib/admin-user-format";

const labels: Record<AdminCustomerRole, string> = { BUYER: "Buyer", SELLER: "Seller", REFERRER: "Referrer" };
function StateBadge({ active }: { active: boolean }) { return <span className={`profile-state ${active ? "active" : "inactive"}`}>{active ? "Activated" : "Not activated"}</span>; }
function ProfilePanel({ title, active, icon, children, inactiveCopy }: { title: string; active: boolean; icon: React.ReactNode; children: React.ReactNode; inactiveCopy: string }) {
  return <section className="customer-profile-panel"><header><h2>{icon}{title}</h2><StateBadge active={active} /></header>{active ? children : <p className="inactive-profile-copy">{inactiveCopy}</p>}</section>;
}

export function AdminUserDetailScreen({ userId }: { userId: string }) {
  const [data, setData] = useState<AdminCustomerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(userId)}`, { cache: "no-store" });
      const payload = await response.json() as ApiEnvelope<AdminCustomerDetail>;
      if (!response.ok || !payload.data) throw new Error(payload.message || "Customer details could not be loaded.");
      setData(payload.data);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Customer details could not be loaded."); }
    finally { setLoading(false); }
  }, [userId]);
  useEffect(() => { const task = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(task); }, [load]);
  if (loading) return <section className="admin-user-detail"><Link href={"/dashboard/users" as never} className="back-link"><ArrowLeft size={15} />Back to users</Link><div className="user-detail-layout"><div className="detail-panel skeleton-card" /><div className="user-profile-stack"><div className="detail-panel skeleton-card" /><div className="detail-panel skeleton-card" /></div></div></section>;
  if (error || !data) return <section className="admin-user-detail"><Link href={"/dashboard/users" as never} className="back-link"><ArrowLeft size={15} />Back to users</Link><div className="users-state alert alert-error" role="alert"><span>{error || "Customer details could not be loaded."}</span><button type="button" onClick={() => void load()}>Try again</button></div></section>;
  const { customer, buyerProfile, sellerProfile, referrerProfile } = data;
  const sellerType = sellerProfile.sellerType === "BUSINESS" ? "Company" : sellerProfile.sellerType === "INDIVIDUAL" ? "Individual" : "—";
  return <section className="admin-user-detail" aria-labelledby="customer-name">
    <Link href={"/dashboard/users" as never} className="back-link"><ArrowLeft size={15} />Back to users</Link>
    <div className="user-detail-layout">
      <aside className="customer-identity-card detail-panel">
        <header><span className="identity-avatar" aria-hidden>{customerInitials(customer.fullName)}</span><div><div className="identity-name-row"><h1 id="customer-name">{customer.fullName}</h1>{customer.verified ? <span className="user-verification verified">Verified</span> : <span className="user-verification unverified">Unverified</span>}</div><div className="user-role-badges">{customer.roles.map((role) => <span data-role={role.toLowerCase()} key={role}>{labels[role]}</span>)}</div></div></header>
        <dl className="identity-facts"><div><dt><Mail size={14} />Email</dt><dd>{customer.email}</dd></div><div><dt><Phone size={14} />Phone</dt><dd>{customer.phone || "—"}</dd></div><div><dt>Referral code</dt><dd>{customer.referralCode || "Unavailable"}</dd></div><div><dt>Date joined</dt><dd>{formatAdminDate(customer.joinedAt, true)}</dd></div></dl>
      </aside>
      <div className="user-profile-stack">
        <ProfilePanel title="Buyer Profile" active={buyerProfile.activated} icon={<UserRound size={16} />} inactiveCopy="This customer has not activated a Buyer profile.">
          <div className="profile-content"><div><span>Preferred Areas</span>{buyerProfile.preferredAreas.length ? <div className="preferred-area-chips">{buyerProfile.preferredAreas.map((area) => <span key={area}><MapPin size={12} />{area}</span>)}</div> : <strong>Not provided</strong>}</div><div><span>Budget</span><strong>{buyerProfile.budgetMin == null && buyerProfile.budgetMax == null ? "Not provided" : `${formatAdminCurrency(buyerProfile.budgetMin, buyerProfile.currency || "NGN")} – ${formatAdminCurrency(buyerProfile.budgetMax, buyerProfile.currency || "NGN")}`}</strong></div>{buyerProfile.activatedAt ? <div><span>Activated</span><strong>{formatAdminDate(buyerProfile.activatedAt)}</strong></div> : null}</div>
        </ProfilePanel>
        <ProfilePanel title="Seller Profile" active={sellerProfile.activated} icon={<Building2 size={16} />} inactiveCopy="This customer has not activated a Seller profile.">
          <div className="profile-content"><div><span>Seller Type</span><strong>{sellerType}</strong></div>{sellerProfile.sellerType === "BUSINESS" ? <><div><span>Company Name</span><strong>{sellerProfile.companyName || "Not provided"}</strong></div><div><span>Company Address</span><strong>{sellerProfile.companyAddress || "Not provided"}</strong></div></> : null}{sellerProfile.activatedAt ? <div><span>Activated</span><strong>{formatAdminDate(sellerProfile.activatedAt)}</strong></div> : null}</div>
        </ProfilePanel>
        <ProfilePanel title="Referrer Profile" active={referrerProfile.activated} icon={<BriefcaseBusiness size={16} />} inactiveCopy="This customer has not activated a Referrer profile.">
          <div className="profile-content"><div><span>Referral Code</span><strong>{referrerProfile.referralCode || "Unavailable"}</strong></div>{referrerProfile.activatedAt ? <div><span>Activated</span><strong>{formatAdminDate(referrerProfile.activatedAt)}</strong></div> : null}</div>
        </ProfilePanel>
      </div>
    </div>
  </section>;
}
