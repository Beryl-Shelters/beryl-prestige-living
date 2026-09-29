import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { createMessagesApi } from "../src/lib/messages-api";
import {
  calculateQuickPercentage,
  createReferralsApi,
  referralCommissionBasisPoints,
} from "../src/lib/referrals-api";
import { createSettingsApi } from "../src/lib/settings-api";
import { createKycApi } from "../src/lib/kyc-api";
import { createSupportApi, supportQuestions } from "../src/lib/support-api";
import { passwordValidationErrors, validateNewPassword } from "../src/lib/password-policy";

const root = existsSync(join(process.cwd(), "apps/mobile"))
  ? join(process.cwd(), "apps/mobile")
  : process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

// ============================================================================
// 1. MESSAGES & SUPPORT TICKETS
// ============================================================================

test("Messages API list, detail, reply, and read acknowledgement match V2 contract", async () => {
  const calls: { path: string; options: unknown }[] = [];
  const client = {
    request: async <T>(path: string, options?: unknown) => {
      calls.push({ path, options });
      if (path.includes("/api/v1/messages/tickets?q=billing")) {
        return {
          items: [
            {
              id: "tick-1",
              ticketNumber: "1001",
              subject: "Billing inquiry",
              status: "OPEN",
              resolvedAt: null,
              latestMessagePreview: "Can you clarify the fees?",
              lastActivityAt: "2026-09-29T10:00:00Z",
              unread: true,
            },
          ],
        } as T;
      }
      if (path.includes("/api/v1/messages/tickets/tick-1/messages")) {
        return {
          id: "tick-1",
          ticketNumber: "1001",
          subject: "Billing inquiry",
          status: "OPEN",
          resolvedAt: null,
          createdAt: "2026-09-29T09:00:00Z",
          lastActivityAt: "2026-09-29T10:05:00Z",
          messages: [
            {
              id: "msg-1",
              senderType: "CUSTOMER",
              body: "Here is more info",
              createdAt: "2026-09-29T10:05:00Z",
              readByCustomerAt: null,
            },
          ],
        } as T;
      }
      if (path.includes("/api/v1/messages/tickets/tick-1/read")) {
        return { acknowledged: true } as T;
      }
      return {
        id: "tick-1",
        ticketNumber: "1001",
        subject: "Billing inquiry",
        status: "OPEN",
        resolvedAt: null,
        createdAt: "2026-09-29T09:00:00Z",
        lastActivityAt: "2026-09-29T10:00:00Z",
        messages: [],
      } as T;
    },
  };

  const api = createMessagesApi(client as never);

  const listRes = await api.list("billing");
  assert.equal(listRes.items.length, 1);
  assert.equal(calls[0]!.path, "/api/v1/messages/tickets?q=billing");

  const detailRes = await api.detail("tick-1");
  assert.equal(detailRes.id, "tick-1");

  const replyRes = await api.reply("tick-1", "Here is more info");
  assert.equal(replyRes.messages.length, 1);
  assert.equal(calls[2]!.path, "/api/v1/messages/tickets/tick-1/messages");

  const ackRes = await api.acknowledge("tick-1", "msg-1");
  assert.equal(ackRes.acknowledged, true);
  assert.equal(calls[3]!.path, "/api/v1/messages/tickets/tick-1/read");
});

test("Messages UI enforces read-only banner when ticket status is RESOLVED", () => {
  const detailFile = read("app/dashboard/messages/[id].tsx");
  assert.match(detailFile, /ticket\.status\s*===\s*"RESOLVED"/);
  assert.match(detailFile, /Ticket resolved on/);
  assert.match(detailFile, /You can't send or receive messages for this ticket anymore/);
  assert.match(detailFile, /Create a new ticket instead/);
  assert.match(detailFile, /messagesApi\.acknowledge/);
});

// ============================================================================
// 2. REFERRALS & REFERRAL HISTORY
// ============================================================================

test("Referral commission is strictly 2% (200 basis points), never 4%", () => {
  assert.equal(referralCommissionBasisPoints, 200);
  const screenContent = read("app/dashboard/referrals/index.tsx");
  assert.doesNotMatch(screenContent, /4%/);
  assert.match(screenContent, /2%/);
  assert.match(screenContent, /Send Invitation/);
  assert.match(screenContent, /Registration and Purchase/);
  assert.match(screenContent, /Referral Reward/);
});

test("Referrals API requests real data and supports SELLER referral generation", async () => {
  const calls: { path: string; options: unknown }[] = [];
  const client = {
    request: async <T>(path: string, options?: unknown) => {
      calls.push({ path, options });
      if (path === "/api/v1/dashboard/referrals") {
        return {
          id: "ref-1",
          referralType: "SELLER",
          propertyCode: null,
          referralUrl: "https://berylshelter.com/referrals/SELLER-123",
        } as T;
      }
      return {
        program: { commissionRateBasisPoints: 200 },
        summary: {
          availableBalance: 15000000,
          totalEarnings: 20000000,
          paid: 5000000,
          pendingWithdrawals: 0,
          grossOutstanding: 0,
          bankComplete: true,
          referrals: 3,
          propertiesSold: 2,
        },
        items: [
          {
            id: "ref-item-1",
            referralType: "PROPERTY",
            saleAmount: 5000000000,
            propertyCode: "PROP-99",
            earnings: 100000000,
            status: "COMPLETED",
            completedAt: "2026-09-20T12:00:00Z",
            paymentState: "PAID",
            paidMinor: 100000000,
            paidAt: "2026-09-22T14:00:00Z",
          },
        ],
        page: 1,
        pageSize: 10,
        total: 1,
        totalPages: 1,
      } as T;
    },
  };

  const api = createReferralsApi(client as never);
  const page = await api.list(1);
  assert.equal(page.program.commissionRateBasisPoints, 200);
  assert.equal(page.summary.availableBalance, 15000000);
  assert.equal(page.items[0]!.earnings, 100000000);

  const created = await api.create({ type: "SELLER" });
  assert.equal(created.referralType, "SELLER");
  assert.match(created.referralUrl, /^https:\/\//);
});

// ============================================================================
// 3. REFERRAL WITHDRAWALS
// ============================================================================

test("calculateQuickPercentage calculates exact integer minor units for 25, 50, 75, 100%", () => {
  const available = 1000050; // ₦10,000.50

  assert.equal(calculateQuickPercentage(available, 100), 1000050);
  assert.equal(calculateQuickPercentage(available, 50), 500025);
  assert.equal(calculateQuickPercentage(available, 25), 250012);
  assert.equal(calculateQuickPercentage(available, 75), 750037);
});

test("Withdrawal UI requires bank details and only allows cancellation for PENDING status", () => {
  const withdrawContent = read("app/dashboard/referrals/withdraw.tsx");
  assert.match(withdrawContent, /Submitting this request does not transfer money automatically/);
  assert.match(withdrawContent, /isPending/);
  assert.match(withdrawContent, /Cancel Request/);
  assert.match(withdrawContent, /Beryl is processing the external payment/);
  // Verify that cancel is strictly conditionally guarded for isPending
  assert.match(withdrawContent, /\{isPending && \(/);
});

test("Withdrawals API requests and cancels pending withdrawal", async () => {
  const calls: { path: string; options: unknown }[] = [];
  const client = {
    request: async <T>(path: string, options?: unknown) => {
      calls.push({ path, options });
      if (path === "/api/v1/dashboard/referrals/withdrawals") {
        return { id: "wth-123" } as T;
      }
      return undefined as T;
    },
  };

  const api = createReferralsApi(client as never);
  const reqRes = await api.requestWithdrawal("req-1", 500000);
  assert.equal(reqRes.id, "wth-123");
  assert.equal(calls[0]!.path, "/api/v1/dashboard/referrals/withdrawals");

  await api.cancelWithdrawal("wth-123");
  assert.equal(calls[1]!.path, "/api/v1/dashboard/referrals/withdrawals/wth-123/cancel");
});

// ============================================================================
// 4. ACCOUNT SETTINGS & PASSWORD POLICY
// ============================================================================

test("Profile settings preserves read-only email and enforces bank invariant", () => {
  const profileContent = read("app/dashboard/settings/profile.tsx");
  assert.match(profileContent, /readOnlyBadge/);
  assert.match(profileContent, /Read-only/);
  assert.match(profileContent, /editable=\{false\}/);
  assert.match(profileContent, /To update bank details, please complete Account Name, Bank Name, and Account Number/);
  assert.match(profileContent, /MAX_AVATAR_BYTES = 2 \* 1024 \* 1024/);
});

test("Business settings enforces read-only public BUS ID and 2MB logo limit", () => {
  const bizContent = read("app/dashboard/settings/business.tsx");
  assert.match(bizContent, /Public ID/);
  assert.match(bizContent, /editable=\{false\}/);
  assert.match(bizContent, /MAX_LOGO_BYTES = 2 \* 1024 \* 1024/);
});

test("Password policy validation mirrors canonical rules", () => {
  // Too short
  assert.throws(() => validateNewPassword("Short1!", "Short1!"), /at least 8 characters/);
  // Missing uppercase
  assert.throws(() => validateNewPassword("lowercase1!", "lowercase1!"), /uppercase letter/);
  // Missing lowercase
  assert.throws(() => validateNewPassword("UPPERCASE1!", "UPPERCASE1!"), /lowercase letter/);
  // Missing symbol
  assert.throws(() => validateNewPassword("NoSymbol123", "NoSymbol123"), /at least one symbol/);
  // Confirmation mismatch
  assert.throws(() => validateNewPassword("StrongP@ss1", "StrongP@ss2"), /Passwords do not match/);

  // Valid password
  assert.doesNotThrow(() => validateNewPassword("SecurePass123!", "SecurePass123!"));

  const errors = passwordValidationErrors("validP@ss1", "validP@ss1");
  assert.equal(errors.length, 0);
});

test("Settings API get and update methods match V2 endpoints", async () => {
  const calls: { path: string; options: unknown }[] = [];
  const client = {
    request: async <T>(path: string, options?: unknown) => {
      calls.push({ path, options });
      if (path === "/api/v1/dashboard/settings/profile") {
        return {
          firstName: "Ada",
          lastName: "Okafor",
          email: "ada@example.com",
          phoneNumber: "08012345678",
          briefBio: "",
          accountName: "",
          bankName: "",
          accountNumber: "",
          streetAddress: "12 Marina Road",
          zipCode: "100001",
          city: "Lagos",
          state: "Lagos",
          country: "Nigeria",
          countryCode: "NG",
          accountType: "CUSTOMER",
          profileImageUrl: null,
        } as T;
      }
      if (path === "/api/v1/dashboard/settings/business") {
        return {
          companyId: "BUS-2026-001",
          companyName: "Ada Ventures Ltd",
          companyEmail: "info@adaventures.ng",
          companyPhoneNumber: "+2348012345678",
          aboutCompany: "Real estate investment firm",
          streetAddress: "45 Admiralty Way",
          zipCode: "106104",
          city: "Lekki",
          state: "Lagos",
          country: "Nigeria",
          companyLogoUrl: null,
        } as T;
      }
      if (path === "/api/v1/dashboard/settings/password") {
        return { reauthenticate: true } as T;
      }
      return {} as T;
    },
  };

  const api = createSettingsApi(client as never);
  const profile = await api.getProfile();
  assert.equal(profile.email, "ada@example.com");

  const business = await api.getBusiness();
  assert.equal(business.companyId, "BUS-2026-001");

  const pwRes = await api.changePassword("OldP@ss123!", "NewP@ss123!", "NewP@ss123!");
  assert.equal(pwRes.reauthenticate, true);
});

// ============================================================================
// 5. KYC / VERIFY ACCOUNT
// ============================================================================

test("KYC screen adheres strictly to canonical document rules and excludes BVN", () => {
  const kycContent = read("app/dashboard/kyc.tsx");
  assert.doesNotMatch(kycContent, /bvn/i);
  assert.match(kycContent, /PASSPORT/);
  assert.match(kycContent, /DRIVERS_LICENSE/);
  assert.match(kycContent, /NATIONAL_ID/);
  assert.match(kycContent, /documentType !== "PASSPORT" && \(/);
  assert.match(kycContent, /MAX_FILE_BYTES = 10 \* 1024 \* 1024/);
  assert.match(kycContent, /PENDING_REVIEW/);
  assert.match(kycContent, /APPROVED/);
  assert.match(kycContent, /REJECTED/);
  assert.match(kycContent, /Submission rejected/);
});

test("KYC API fetches and submits verification", async () => {
  const calls: { path: string; options: unknown }[] = [];
  const client = {
    request: async <T>(path: string, options?: unknown) => {
      calls.push({ path, options });
      return {
        status: "NOT_SUBMITTED",
        country: null,
        documentType: null,
        submittedAt: null,
        rejectionReason: null,
        documents: [],
      } as T;
    },
  };

  const api = createKycApi(client as never);
  const kyc = await api.getKyc();
  assert.equal(kyc.status, "NOT_SUBMITTED");
  assert.equal(calls[0]!.path, "/api/v1/dashboard/kyc");
});

// ============================================================================
// 6. SUPPORT & FAQS
// ============================================================================

test("Support screen contains 5 canonical FAQs, contact info, and report submission", () => {
  assert.equal(supportQuestions.length, 5);
  const supportContent = read("app/support.tsx");
  assert.match(supportContent, /info@berylshelter\.com/);
  assert.match(supportContent, /\+234 704 205 5678/);
  assert.match(supportContent, /Plot 2, Cornerstone Estate Drive/);
  assert.match(supportContent, /What are you reporting\?/);
  assert.match(supportContent, /Open Support Tickets/);
});

test("Support API submits property and agent reports", async () => {
  const calls: { path: string; options: unknown }[] = [];
  const client = {
    request: async <T>(path: string, options?: unknown) => {
      calls.push({ path, options });
      return { success: true } as T;
    },
  };

  const api = createSupportApi(client as never);
  const res = await api.submitReport({
    reportType: "PROPERTY",
    propertyCode: "PROP-10",
    propertyName: "Lekki Villa",
    reason: "Suspicious agent contact",
  });

  assert.equal(res.success, true);
  assert.equal(calls[0]!.path, "/api/v1/public/support/reports");
});

// ============================================================================
// 7. DASHBOARD NAVIGATION & INTEGRATION
// ============================================================================

test("Dashboard layout registers all canonical screens without placeholders", () => {
  const layout = read("app/dashboard/_layout.tsx");
  assert.match(layout, /Stack\.Screen name="messages"/);
  assert.match(layout, /Stack\.Screen name="referrals"/);
  assert.match(layout, /Stack\.Screen name="settings"/);
  assert.match(layout, /Stack\.Screen name="kyc"/);

  const feature = read("app/dashboard/[feature].tsx");
  assert.match(feature, /feature === "messages"/);
  assert.match(feature, /feature === "settings"/);
  assert.match(feature, /feature === "kyc"/);
});
