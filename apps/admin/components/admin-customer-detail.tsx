"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { getAdminCustomer, type CustomerAccountType, type CustomerDetail, type CustomerProfileType } from "../lib/admin-customers-api";
import { AdminAppShell } from "./admin-app-shell";

const accountLabels: Record<CustomerAccountType, string> = {
  INVESTOR: "Investor",
  PROPERTY_DEVELOPER: "Property Developer",
  LANDLORD: "Landlord",
  REGISTERED_AGENT: "Registered Agent",
  FREELANCE_AGENT: "Freelance Agent",
};

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "—";
}

function date(value: string | null, includeTime = false) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", includeTime ? { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" } : { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

function accountLabel(value: CustomerAccountType | null) {
  return value ? accountLabels[value] : "—";
}

function profileLabel(value: CustomerProfileType | null) {
  return value ? value[0] + value.slice(1).toLowerCase() : "—";
}

function kycLabel(value: CustomerDetail["kycStatus"]) {
  return value.split("_").map((part) => part[0] + part.slice(1).toLowerCase()).join(" ");
}

function ActivityCard({ title, hasActivity, children, emptyCopy }: { title: string; hasActivity: boolean; children?: React.ReactNode; emptyCopy: string }) {
  return <section className="customer-profile-card"><header><h2>{title}</h2><span className={hasActivity ? "has-activity" : "no-activity"}>{hasActivity ? "Activity recorded" : "No activity"}</span></header>{hasActivity ? <div className="customer-profile-fields">{children}</div> : <p className="customer-profile-inactive">{emptyCopy}</p>}</section>;
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return <div><dt>{label}</dt><dd>{value ?? "—"}</dd></div>;
}

function DetailContent({ customerId }: { customerId: string }) {
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    getAdminCustomer(customerId, controller.signal).then(setCustomer).catch((reason) => {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Customer could not be loaded.");
    });
    return () => controller.abort();
  }, [customerId]);

  if (error) return <main className="admin-customer-detail"><Link className="admin-back-link" href="/dashboard/users">‹ Back to users</Link><p className="admin-data-error" role="alert">{error}</p></main>;
  if (!customer) return <main className="admin-customer-detail" role="status">Loading customer…</main>;
  const verified = customer.kycStatus === "APPROVED";

  return <main className="admin-customer-detail">
    <Link className="admin-back-link" href="/dashboard/users">‹ Back to users</Link>
    <div className="customer-detail-grid">
      <aside className="customer-identity-card">
        <header><span className="customer-detail-avatar">{initials(customer.fullName)}</span><div><div className="customer-detail-name"><h1>{customer.fullName}</h1><span className={verified ? "is-verified" : "is-unverified"} title={`KYC: ${customer.kycStatus.replaceAll("_", " ").toLowerCase()}`}>{verified ? "Verified" : "Unverified"}</span></div><div className="customer-classification-list"><span>{accountLabel(customer.accountType)}</span><span>{profileLabel(customer.profileType)}</span></div></div></header>
        <dl><Field label="Email" value={customer.email}/><Field label="Phone" value={customer.phone ?? "—"}/><Field label="Account Type" value={accountLabel(customer.accountType)}/><Field label="Profile Type" value={profileLabel(customer.profileType)}/><Field label="KYC State" value={kycLabel(customer.kycStatus)}/><Field label="Date Joined" value={date(customer.joinedAt, true)}/></dl>
      </aside>

      <div className="customer-profile-stack">
        <ActivityCard hasActivity={customer.propertyActivity.hasActivity} title="Property Activity" emptyCopy="No saved properties or verified completed purchases have been recorded.">
          <dl><Field label="Saved Properties" value={customer.propertyActivity.savedProperties.toLocaleString()}/><Field label="Verified Completed Purchases" value={customer.propertyActivity.completedPurchases.toLocaleString()}/><Field label="First Property Activity" value={date(customer.propertyActivity.firstActivityAt)}/></dl>
        </ActivityCard>
        <ActivityCard hasActivity={customer.listingActivity.hasActivity} title="Listing Activity" emptyCopy="No customer listings have been recorded.">
          <dl><Field label="Listings" value={customer.listingActivity.listingCount.toLocaleString()}/><Field label="First Listing Date" value={date(customer.listingActivity.firstListingAt)}/></dl>
        </ActivityCard>
        <ActivityCard hasActivity={customer.referralActivity.hasActivity} title="Referral Activity" emptyCopy="No referral links have been generated.">
          <dl><Field label="Referral Links" value={customer.referralActivity.referralLinkCount.toLocaleString()}/><Field label="Referral Code" value={customer.referralActivity.referralCode ?? "—"}/><Field label="First Referral Link Date" value={date(customer.referralActivity.firstReferralLinkAt)}/></dl>
        </ActivityCard>
        {customer.profileType === "BUSINESS" && <section className="customer-profile-card"><header><h2>Business Information</h2><span className="classification-badge">Business</span></header>{customer.businessInformation.exists ? <div className="customer-profile-fields"><dl><Field label="Company Name" value={customer.businessInformation.companyName ?? "—"}/><Field label="Company Address" value={customer.businessInformation.companyAddress ?? "—"}/></dl></div> : <p className="customer-profile-inactive">No business information has been provided.</p>}</section>}
      </div>
    </div>
  </main>;
}

export function AdminCustomerDetail({ customerId }: { customerId: string }) {
  return <AdminAppShell><DetailContent customerId={customerId}/></AdminAppShell>;
}
