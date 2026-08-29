import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd().endsWith("apps\\admin") || process.cwd().endsWith("apps/admin") ? process.cwd() : join(process.cwd(), "apps", "admin");
const source = (path: string) => readFileSync(join(root, path), "utf8");
const shell = source("components/admin-dashboard.tsx");
const directory = source("components/admin-users-directory.tsx");
const detail = source("components/admin-user-detail.tsx");
const css = source("app/globals.css");
const contracts = source("lib/contracts.ts");
const listBff = source("app/api/admin/users/route.ts");
const detailBff = source("app/api/admin/users/[userId]/route.ts");
const listPage = source("app/dashboard/users/page.tsx");
const detailPage = source("app/dashboard/users/[userId]/page.tsx");

describe("Admin Users interface architecture", () => {
  it("uses the exact approved primary sidebar", () => {
    ["Dashboard", "Users", "Properties", "Leads", "Referrers", "Admin Management"].forEach((label) => expect(shell).toContain(label));
    expect(shell).toContain('admin.adminRole === "SUPER_ADMIN"');
    ["My Listings", "Payments", "Subaccounts", "Save-as-you-earn", "Invest", "Refer & Earn", "Support"].forEach((label) => expect(shell).not.toContain(label));
    ["Settings", "sidebar-profile", "Log out"].forEach((label) => expect(shell).toContain(label));
  });
  it("links and highlights Users by the canonical route", () => {
    expect(shell).toContain('href={"/dashboard/users" as never}');
    expect(shell).toContain('pathname.startsWith("/dashboard/users")');
  });
  it("protects both pages with the existing Admin server guard", () => {
    expect(listPage).toContain("requireAdminSession()");
    expect(detailPage).toContain("requireAdminSession()");
  });
  it("renders the approved heading and read-only subtitle", () => {
    expect(directory).toContain('id="users-title">Users');
    expect(directory).toContain("Customer directory. View only — no changes can be made here.");
  });
  it("renders all four authoritative summary cards", () => {
    ["Total Users", "Buyer Profiles", "Seller Profiles", "Referrer Profiles"].forEach((label) => expect(directory).toContain(label));
    expect(directory).toContain("data?.counts[key]");
  });
  it("renders authoritative persona tabs with server counts", () => {
    ["All", "Buyers", "Sellers", "Referrers"].forEach((label) => expect(directory).toContain(label));
    expect(directory).toContain('role="tablist"');
    expect(directory).toContain("data?.counts[countKey]");
  });
  it("uses server-driven trimmed search, role, verification, sort, and pagination", () => {
    expect(directory).toContain("Search name, email or phone");
    expect(directory).toContain("search.trim()");
    ["role", "verification", "sort", "page", 'limit: "6"'].forEach((value) => expect(directory).toContain(value));
    expect(directory).toContain("/api/admin/users?");
  });
  it("renders the six approved table headings", () => {
    ["Full name", "Roles", "Contact", "Referral code", "Status", "Actions"].forEach((label) => expect(directory).toContain(`<th>${label}</th>`));
  });
  it("renders initials, joined date, roles, contact, referral, and verification", () => {
    ["customerInitials(user.fullName)", "Joined", "user.roles", "user.email", "user.phone", "user.referralCode", "user.verified"].forEach((value) => expect(directory).toContain(value));
  });
  it("navigates View details with canonical customer UUID", () => {
    expect(directory).toContain("/dashboard/users/${user.id}");
    expect(directory).not.toContain("/dashboard/users/${user.email}");
    expect(directory).not.toContain("/dashboard/users/${user.referralCode}");
  });
  it("provides loading, empty, filtered-empty, and retryable error states", () => {
    ["users-row-skeleton", "No customers yet", "Registered customers will appear here.", "No users match these filters", "Try again"].forEach((value) => expect(directory).toContain(value));
    expect(detail).toContain("skeleton-card"); expect(detail).toContain("Try again");
  });
  it("uses Back to users rather than the erroneous PDF label", () => {
    expect(detail).toContain("Back to users");
    expect(detail).not.toContain("Back to properties");
  });
  it("renders bounded identity fields and no mutation controls", () => {
    ["fullName", "verified", "roles", "email", "phone", "referralCode", "joinedAt"].forEach((field) => expect(detail).toContain(`customer.${field}`));
    ["Edit user", "Suspend", "Delete user", "Reset password", "Impersonate"].forEach((label) => expect(detail).not.toContain(label));
  });
  it("renders Buyer active/inactive data and centralized NGN formatting", () => {
    ["Buyer Profile", "preferredAreas", "budgetMin", "budgetMax", "formatAdminCurrency", "This customer has not activated a Buyer profile."].forEach((value) => expect(detail).toContain(value));
  });
  it("maps Individual and Company Seller profiles without invented fields", () => {
    ["Seller Profile", '"BUSINESS" ? "Company"', '"INDIVIDUAL" ? "Individual"', "companyName", "companyAddress", "This customer has not activated a Seller profile."].forEach((value) => expect(detail).toContain(value));
    ["CAC", "Website", "Staff count"].forEach((value) => expect(detail).not.toContain(value));
  });
  it("renders Referrer active/inactive states without inventing activation dates", () => {
    ["Referrer Profile", "referrerProfile.referralCode", "This customer has not activated a Referrer profile."].forEach((value) => expect(detail).toContain(value));
    expect(contracts).toContain("referrerProfile");
  });
  it("uses the shared cookie BFF and encodes dynamic user IDs", () => {
    expect(listBff).toContain("protectedAdminRequest");
    expect(listBff).toContain("request.nextUrl.searchParams.toString()");
    expect(detailBff).toContain("protectedAdminRequest");
    expect(detailBff).toContain("encodeURIComponent");
  });
  it("keeps tokens and analytics PII out of components", () => {
    for (const file of [directory, detail]) expect(file).not.toMatch(/accessToken|refreshToken|localStorage|trackAdminEvent/);
  });
  it("supports compact desktop overflow and intentional responsive stacking", () => {
    expect(css).toMatch(/\.users-table-scroll \{ overflow-x: auto/);
    expect(css).toMatch(/@media \(max-width: 800px\)[\s\S]*\.user-detail-layout \{ grid-template-columns: 1fr/);
  });
});
