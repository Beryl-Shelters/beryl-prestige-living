import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithQuery } from "@/test/render";
import type { CustomerSessionState, ReferralDashboard } from "@/lib/contracts";

const mocks = vi.hoisted(() => ({
  session: null as CustomerSessionState | null,
  context: vi.fn(), submit: vi.fn(), dashboard: vi.fn(), payout: vi.fn(), banks: vi.fn(), savePayout: vi.fn(),
  requestTracking: vi.fn(), verifyTracking: vi.fn(), push: vi.fn()
}));
vi.mock("@/context/auth-provider", () => ({ useAuth: () => ({ session: mocks.session }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("@/components/marketplace/marketplace-header", () => ({ MarketplaceHeader: () => <header>Referral header</header> }));
vi.mock("@/lib/api/client", () => ({ referralApi: {
  context: mocks.context, submit: mocks.submit, dashboard: mocks.dashboard,
  payout: mocks.payout, banks: mocks.banks, savePayout: mocks.savePayout,
  requestTracking: mocks.requestTracking, verifyTracking: mocks.verifyTracking
} }));

import { CopyReferralLink } from "./copy-referral-link";
import { DirectReferralScreen } from "./direct-referral-screen";
import { ReferralDashboardScreen } from "./referral-dashboard-screen";
import { ReferralLanding } from "./referral-landing";
import { ReferralTrackingScreen } from "./referral-tracking-screen";

const dashboard: ReferralDashboard = {
  referrer: { fullName: "Ada Okafor", referralCode: "BSR-ADA", referralLink: "https://dev.berylshelter.com/r/BSR-ADA" },
  summary: { referralCount: 2, completedCount: 1, earnedAmount: 500000, outstandingAmount: 500000 },
  referrals: [
    { id: "1", referenceId: "REF-2608-0001", referredName: "Tomi Balogun", purpose: "BUYING", contactMethod: "WHATSAPP", status: "COMPLETED", statusLabel: "Completed", rewardAmount: 500000, paymentStatus: "OUTSTANDING", submittedAt: "2026-08-28T00:00:00Z" },
    { id: "2", referenceId: "REF-2608-0002", referredName: "Kemi Ade", purpose: "SELLING", contactMethod: "CALL", status: "LOST", statusLabel: "Didn't proceed", rewardAmount: null, paymentStatus: "NOT_ELIGIBLE", submittedAt: "2026-08-27T00:00:00Z" }
  ],
  pagination: { page: 1, limit: 10, total: 2, totalPages: 1 }
};

describe("desktop referral Web experience", () => {
  beforeEach(() => {
    mocks.session = null;
    mocks.context.mockResolvedValue({ data: { authenticated: false, referrer: null } });
    mocks.submit.mockReset(); mocks.dashboard.mockReset(); mocks.payout.mockReset(); mocks.banks.mockReset();
    mocks.requestTracking.mockReset(); mocks.verifyTracking.mockReset(); mocks.push.mockReset();
  });

  it("renders the public approved landing copy, supplied hero asset and direct CTA", async () => {
    renderWithQuery(<ReferralLanding />);
    expect(screen.getByRole("heading", { name: "Refer someone and earn up to ₦2,500,000." })).toBeInTheDocument();
    expect(screen.getByText(/earn up to 25% when the deal closes/i)).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /people sharing/i })).toHaveAttribute("src", "/images/referrals/referral-hero-collage.png");
    expect(screen.getByRole("link", { name: /fill in their details/i })).toHaveAttribute("href", "/refer/direct");
    await waitFor(() => expect(screen.getByText(/submit your first referral/i)).toBeInTheDocument());
  });

  it("shows and copies a stable authenticated referral link", async () => {
    mocks.context.mockResolvedValue({ data: { authenticated: true, referrer: { fullName: "Ada", referralCode: "BSR-ADA", referralLink: "https://dev.berylshelter.com/r/BSR-ADA" } } });
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    renderWithQuery(<ReferralLanding />);
    const button = await screen.findByRole("button", { name: "Copy referral link" });
    await userEvent.click(button);
    expect(writeText).toHaveBeenCalledWith("https://dev.berylshelter.com/r/BSR-ADA");
    expect(screen.getByRole("button", { name: "Referral link copied" })).toHaveTextContent("Copied");
  });

  it("keeps the direct form public and submits anonymous Buying data without a signup redirect", async () => {
    mocks.submit.mockResolvedValue({ data: { referral: { id: "1", referenceId: "REF-2608-0001", referredFirstName: "Tomi", purpose: "BUYING", status: "NEW", submittedAt: "2026-08-28T00:00:00Z" }, referrer: { referralCode: "BSR-ADA", referralLink: "https://dev.berylshelter.com/r/BSR-ADA" }, nextAction: "REQUEST_TRACKING_CODE", trackingAvailable: false } });
    renderWithQuery(<DirectReferralScreen />);
    fireEvent.change(screen.getByLabelText("Full Name"), { target: { value: "Ada Okafor" } });
    fireEvent.change(screen.getByPlaceholderText("801 234 5678"), { target: { value: "08012345678" } });
    fireEvent.change(screen.getByLabelText("Their Full Name"), { target: { value: "Tomi Balogun" } });
    fireEvent.change(screen.getByLabelText("Their phone number"), { target: { value: "08023456789" } });
    await userEvent.click(screen.getByText(/I have permission/).closest("label")!.querySelector("input")!);
    await userEvent.click(screen.getByRole("button", { name: "Submit Referral" }));
    await waitFor(() => expect(mocks.submit).toHaveBeenCalledWith(expect.objectContaining({ purpose: "BUYING", referrer: { fullName: "Ada Okafor", phone: "+2348012345678" } })));
    expect(await screen.findByRole("heading", { name: "Referral submitted" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /sign up/i })).not.toBeInTheDocument();
  });

  it("uses the customer session for a logged-in submission instead of sending guest identity", async () => {
    mocks.session = { user: { id: "customer", fullName: "Ada Okafor", email: "ada@example.com", phone: "+2348012345678", accountStatus: "ACTIVE", emailVerified: true }, activePersona: "BUYER", personas: [], nextAction: "OPEN_BUYER_DASHBOARD" };
    mocks.submit.mockResolvedValue({ data: { referral: { id: "1", referenceId: "REF-2608-0001", referredFirstName: "Tomi", purpose: "SELLING", status: "NEW", submittedAt: "2026-08-28T00:00:00Z" }, referrer: { referralCode: "BSR-ADA", referralLink: "https://dev.berylshelter.com/r/BSR-ADA" }, nextAction: "OPEN_REFERRAL_DASHBOARD", trackingAvailable: false } });
    renderWithQuery(<DirectReferralScreen />);
    await userEvent.click(screen.getByRole("button", { name: "Selling" }));
    fireEvent.change(screen.getByLabelText("Their Full Name"), { target: { value: "Tomi Balogun" } });
    fireEvent.change(screen.getByLabelText("Their phone number"), { target: { value: "08023456789" } });
    await userEvent.click(screen.getByText(/I have permission/).closest("label")!.querySelector("input")!);
    await userEvent.click(screen.getByRole("button", { name: "Submit Referral" }));
    await waitFor(() => expect(mocks.submit).toHaveBeenCalledWith(expect.not.objectContaining({ referrer: expect.anything() })));
    expect(await screen.findByRole("link", { name: "View your referrals" })).toHaveAttribute("href", "/referrals");
  });

  it("renders canonical dashboard status, authoritative reward and payment labels", async () => {
    mocks.dashboard.mockResolvedValue({ data: dashboard });
    renderWithQuery(<ReferralDashboardScreen />);
    expect(await screen.findByRole("heading", { name: "Your referrals" })).toBeInTheDocument();
    expect(screen.getByText("REF-2608-0001")).toBeInTheDocument();
    expect(screen.getByText("Didn't proceed")).toBeInTheDocument();
    expect(screen.getByText("Not paid yet")).toBeInTheDocument();
    expect(screen.getAllByText(/₦500,000/).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /bank details/i })).toBeInTheDocument();
  });

  it("renders the approved empty state", async () => {
    mocks.dashboard.mockResolvedValue({ data: { ...dashboard, summary: { referralCount: 0, completedCount: 0, earnedAmount: 0, outstandingAmount: 0 }, referrals: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 0 } } });
    renderWithQuery(<ReferralDashboardScreen />);
    expect(await screen.findByRole("heading", { name: "No referrals yet" })).toBeInTheDocument();
  });

  it("advances to OTP entry after the server accepts WhatsApp delivery", async () => {
    mocks.requestTracking.mockResolvedValue({ data: { accepted: true, resendAvailableIn: 60 } });
    renderWithQuery(<ReferralTrackingScreen />);
    fireEvent.change(screen.getByLabelText("Full Name"), { target: { value: "Ada Okafor" } });
    fireEvent.change(screen.getByLabelText("Phone Number"), { target: { value: "08012345678" } });
    await userEvent.click(screen.getByRole("button", { name: "Send tracking code" }));
    await waitFor(() => expect(mocks.requestTracking).toHaveBeenCalledWith({
      fullName: "Ada Okafor",
      phone: "+2348012345678"
    }));
    expect(await screen.findByRole("heading", { name: "Enter your tracking code" })).toBeInTheDocument();
    expect(screen.getByLabelText("Six-digit code")).toBeInTheDocument();
  });

  it("shows a safe retry message when configured-provider delivery fails", async () => {
    mocks.requestTracking.mockRejectedValue({ response: { data: {
      code: "REFERRAL_OTP_DELIVERY_FAILED",
      message: "We could not deliver the referral tracking code"
    } } });
    renderWithQuery(<ReferralTrackingScreen />);
    fireEvent.change(screen.getByLabelText("Full Name"), { target: { value: "Ada Okafor" } });
    fireEvent.change(screen.getByLabelText("Phone Number"), { target: { value: "08012345678" } });
    await userEvent.click(screen.getByRole("button", { name: "Send tracking code" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("We could not deliver the referral tracking code");
    expect(screen.getByRole("button", { name: "Send tracking code" })).toBeEnabled();
    expect(screen.queryByLabelText("Six-digit code")).not.toBeInTheDocument();
  });

  it("keeps the provider-unconfigured response safe and retryable", async () => {
    mocks.requestTracking.mockRejectedValue({ response: { data: {
      code: "REFERRAL_TRACKING_UNAVAILABLE",
      message: "internal configuration detail"
    } } });
    renderWithQuery(<ReferralTrackingScreen />);
    fireEvent.change(screen.getByLabelText("Full Name"), { target: { value: "Ada Okafor" } });
    fireEvent.change(screen.getByLabelText("Phone Number"), { target: { value: "08012345678" } });
    await userEvent.click(screen.getByRole("button", { name: "Send tracking code" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("WhatsApp tracking codes are not configured yet");
    expect(screen.queryByText("internal configuration detail")).not.toBeInTheDocument();
  });
});

describe("CopyReferralLink", () => {
  it("uses the Clipboard API and accessible copied feedback", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    renderWithQuery(<CopyReferralLink value="https://example.com/r/CODE" />);
    await userEvent.click(screen.getByRole("button", { name: "Copy referral link" }));
    expect(writeText).toHaveBeenCalledWith("https://example.com/r/CODE");
    expect(screen.getByRole("button", { name: "Referral link copied" })).toBeInTheDocument();
  });
});
