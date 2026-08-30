import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const fromApp = (file: string) => path.resolve(__dirname, "..", file);
const source = (file: string) => readFileSync(fromApp(file), "utf8");

describe("Admin onboarding architecture", () => {
  it("has no public Admin signup and includes every approved flow route", () => {
    expect(existsSync(fromApp("app/signup"))).toBe(false);
    ["app/activate/page.tsx", "app/activation-otp/page.tsx", "app/set-password/page.tsx", "app/dashboard/admins/page.tsx", "app/dashboard/change-password/page.tsx"].forEach((file) => expect(existsSync(fromApp(file))).toBe(true));
  });

  it("keeps invitation and setup credentials out of browser storage", () => {
    const activation = source("components/activation-screen.tsx");
    const verify = source("app/api/admin/verify-activation-otp/route.ts");
    expect(activation).toContain("beryl_admin_activation_challenge");
    expect(activation).not.toContain("sessionStorage.setItem(\"invitationToken");
    expect(verify).toContain("setSetupPasswordProof");
  });

  it("limits Admin management to the Super Admin dashboard route", () => {
    expect(source("app/dashboard/admins/page.tsx")).toContain('adminRole !== "SUPER_ADMIN"');
    expect(source("components/admin-management.tsx")).toContain("Invite Admin");
    expect(source("components/admin-management.tsx")).toContain("Resend");
  });

  it("restores the exact operational sidebar order for Super Admins", () => {
    const sidebar = source("components/admin-dashboard.tsx");
    const labels = ["            Dashboard", ">Users</Link>", ">Properties</Link>", ">Leads</Link>", ">Admin Management</Link>"];
    labels.reduce((previousIndex, label) => {
      const index = sidebar.indexOf(label);
      expect(index).toBeGreaterThan(previousIndex);
      return index;
    }, -1);
    expect(sidebar).toContain('admin.adminRole === "SUPER_ADMIN"');
    expect(sidebar).toContain('pathname.startsWith("/dashboard/admins")');
    ["My Listings", "Payments", "Subaccounts", "Save-as-you-earn", "Invest", "Refer & Earn", "Support"].forEach((label) => expect(sidebar).not.toContain(label));
    expect(sidebar).toContain(">Settings<");
    expect(sidebar).toContain("sidebar-profile");
    expect(sidebar).toContain('"Log out"');
  });

  it("uses the existing HttpOnly Admin BFF for list, invite, and resend operations", () => {
    expect(source("app/api/admin/staff/route.ts")).toContain('protectedAdminRequest("admin/staff", "GET")');
    expect(source("app/api/admin/invite/route.ts")).toContain('protectedAdminRequest("admin/staff/invite", "POST"');
    expect(source("app/api/admin/staff/[adminId]/resend-invitation/route.ts")).toContain("protectedAdminRequest(`admin/staff/${(await params).adminId}/resend-invitation`");
    const management = source("components/admin-management.tsx");
    expect(management).not.toMatch(/localStorage|accessToken|refreshToken/);
  });

  it("keeps the restored management UI restrained, validated, and duplicate-submit safe", () => {
    const management = source("components/admin-management.tsx");
    expect(management).toContain("Manage who can access the Beryl Shelter Admin Portal.");
    expect(management).toContain('z.string().trim().email("Enter a valid email")');
    expect(management).toContain('z.enum(["ADMIN", "SUPER_ADMIN"])');
    expect(management).toContain("Full Name");
    expect(management).toContain("Joined");
    expect(management).toContain('member.status === "PENDING"');
    expect(management).toContain("Sending invitation…");
    expect(management).toContain("Invitation sent to ${values.email}.");
    expect(management).toContain('role="dialog"');
    expect(management).toContain('aria-modal="true"');
  });

  it("preserves public token activation states without mixing customer authentication", () => {
    const activationPage = source("app/activate/page.tsx");
    const activation = source("components/activation-screen.tsx");
    expect(activationPage).toContain("Invitation link required");
    expect(activationPage).toContain("<ActivationScreen invitationToken={token}");
    expect(activation).toContain('postApi<{ challengeId: string; maskedEmail: string; resendAvailableIn: number }>("/api/admin/activate"');
    expect(activation).toContain("Unable to activate this invitation.");
    expect(activation).not.toMatch(/customer|beryl_customer/i);
    expect(source("app/api/admin/activate/route.ts")).toContain('upstream("admin/auth/activate"');
  });
});
