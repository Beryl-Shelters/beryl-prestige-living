import { beforeEach, describe, expect, it, vi } from "vitest";
import { CustomerOnboardingService } from "./customer-onboarding.service";
import {
  CustomerOnboardingInfrastructureError,
  CustomerOnboardingStore
} from "./customer-onboarding.types";

const userId = "11111111-1111-4111-8111-111111111111";

const getState = vi.fn();
const completeBuyer = vi.fn();
const completeSeller = vi.fn();
const activatePersona = vi.fn();
const switchPersona = vi.fn();

const store = {
  getState,
  completeBuyer,
  completeSeller,
  activatePersona,
  switchPersona
} as unknown as CustomerOnboardingStore;

const service = new CustomerOnboardingService(store);

const buyerState = (onboardingStatus: "NOT_STARTED" | "COMPLETED") => ({
  accountStatus: "ACTIVE" as const,
  emailVerified: true,
  activePersona: "BUYER" as const,
  lastActivePersona: "BUYER" as const,
  personas: [
    {
      type: "BUYER" as const,
      onboardingStatus,
      activated: true as const
    }
  ]
});

describe("customer onboarding service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns resumable status for a new Buyer", async () => {
    getState.mockResolvedValue(buyerState("NOT_STARTED"));

    await expect(service.getStatus(userId)).resolves.toMatchObject({
      activePersona: "BUYER",
      missingOnboardingSteps: ["PREFERRED_LOCATIONS"],
      nextAction: "COMPLETE_BUYER_ONBOARDING",
      dashboardAccess: false
    });
  });

  it("returns resumable status for a new Seller/Developer", async () => {
    getState.mockResolvedValue({
      accountStatus: "ACTIVE",
      emailVerified: true,
      activePersona: "SELLER_DEVELOPER",
      lastActivePersona: "SELLER_DEVELOPER",
      personas: [
        {
          type: "SELLER_DEVELOPER",
          onboardingStatus: "NOT_STARTED",
          activated: true
        }
      ]
    });

    await expect(service.getStatus(userId)).resolves.toMatchObject({
      missingOnboardingSteps: ["PROFILE_TYPE"],
      nextAction: "COMPLETE_SELLER_ONBOARDING",
      dashboardAccess: false
    });
  });

  it("allows dashboard access after Buyer onboarding is complete", async () => {
    getState.mockResolvedValue(buyerState("COMPLETED"));

    await expect(service.getStatus(userId)).resolves.toMatchObject({
      missingOnboardingSteps: [],
      nextAction: "OPEN_BUYER_DASHBOARD",
      dashboardAccess: true
    });
  });

  it("completes Buyer onboarding with normalized preferences", async () => {
    completeBuyer.mockResolvedValue({
      status: "OK",
      preferredLocations: ["Lekki, Lagos", "Ikoyi, Lagos"],
      budgetMin: 50000000,
      budgetMax: 150000000,
      currency: "USD",
      skipped: false
    });

    await expect(
      service.completeBuyer(userId, {
        preferredLocations: ["Lekki, Lagos", "Ikoyi, Lagos"],
        budgetMin: 50000000,
        budgetMax: 150000000,
        currency: "USD"
      })
    ).resolves.toMatchObject({
      activePersona: "BUYER",
      onboardingStatus: "COMPLETED",
      currency: "USD",
      nextAction: "OPEN_BUYER_DASHBOARD"
    });
  });

  it("supports Buyer skip without creating preference data", async () => {
    completeBuyer.mockResolvedValue({
      status: "OK",
      preferredLocations: [],
      currency: "NGN",
      skipped: true
    });

    await expect(service.completeBuyer(userId, { skip: true })).resolves.toMatchObject({
      preferredLocations: [],
      skipped: true,
      nextAction: "OPEN_BUYER_DASHBOARD"
    });
  });

  it("keeps repeated Buyer submissions idempotent at the store boundary", async () => {
    const result = {
      status: "OK",
      preferredLocations: ["Lagos"],
      currency: "NGN",
      skipped: false
    };
    completeBuyer.mockResolvedValue(result);
    const input = { preferredLocations: ["Lagos"], currency: "NGN" as const };

    expect(await service.completeBuyer(userId, input)).toEqual(
      await service.completeBuyer(userId, input)
    );
    expect(completeBuyer).toHaveBeenCalledTimes(2);
  });

  it("completes Individual Seller onboarding with null company data", async () => {
    completeSeller.mockResolvedValue({
      status: "OK",
      profileType: "INDIVIDUAL",
      companyName: null,
      companyAddress: null,
      skipped: false
    });

    await expect(
      service.completeSeller(userId, { profileType: "INDIVIDUAL" })
    ).resolves.toMatchObject({
      profileType: "INDIVIDUAL",
      companyName: null,
      companyAddress: null,
      nextAction: "OPEN_SELLER_DASHBOARD"
    });
  });

  it("completes Business Seller onboarding", async () => {
    completeSeller.mockResolvedValue({
      status: "OK",
      profileType: "BUSINESS",
      companyName: "Beryl Development Company",
      companyAddress: "Lekki Phase 1, Lagos",
      skipped: false
    });

    await expect(
      service.completeSeller(userId, {
        profileType: "BUSINESS",
        companyName: "Beryl Development Company",
        companyAddress: "Lekki Phase 1, Lagos"
      })
    ).resolves.toMatchObject({
      profileType: "BUSINESS",
      companyName: "Beryl Development Company",
      nextAction: "OPEN_SELLER_DASHBOARD"
    });
  });

  it("supports Seller skip and repeated Seller submissions", async () => {
    completeSeller.mockResolvedValue({ status: "OK", skipped: true });

    const first = await service.completeSeller(userId, { skip: true });
    const second = await service.completeSeller(userId, { skip: true });

    expect(first).toEqual(second);
    expect(first).toMatchObject({ skipped: true, nextAction: "OPEN_SELLER_DASHBOARD" });
    expect(completeSeller).toHaveBeenCalledTimes(2);
  });

  it("returns both possible personas for the switcher", async () => {
    getState.mockResolvedValue(buyerState("COMPLETED"));

    await expect(service.getPersonas(userId)).resolves.toMatchObject({
      activePersona: "BUYER",
      personas: [
        { type: "BUYER", activated: true, nextAction: "OPEN_BUYER_DASHBOARD" },
        {
          type: "SELLER_DEVELOPER",
          activated: false,
          nextAction: "ACTIVATE_SELLER_PERSONA"
        }
      ]
    });
  });

  it("activates a missing Seller persona while preserving Buyer", async () => {
    activatePersona.mockResolvedValue({
      status: "OK",
      personas: ["BUYER", "SELLER_DEVELOPER"],
      onboardingStatus: "NOT_STARTED",
      alreadyActivated: false
    });

    await expect(
      service.activatePersona(userId, "SELLER_DEVELOPER")
    ).resolves.toMatchObject({
      activePersona: "SELLER_DEVELOPER",
      personas: ["BUYER", "SELLER_DEVELOPER"],
      nextAction: "COMPLETE_SELLER_ONBOARDING"
    });
  });

  it("activates a missing Buyer persona", async () => {
    activatePersona.mockResolvedValue({
      status: "OK",
      personas: ["SELLER_DEVELOPER", "BUYER"],
      onboardingStatus: "NOT_STARTED",
      alreadyActivated: false
    });

    await expect(service.activatePersona(userId, "BUYER")).resolves.toMatchObject({
      activePersona: "BUYER",
      nextAction: "COMPLETE_BUYER_ONBOARDING"
    });
  });

  it("returns current state for repeated persona activation", async () => {
    activatePersona.mockResolvedValue({
      status: "OK",
      personas: ["BUYER", "SELLER_DEVELOPER"],
      onboardingStatus: "COMPLETED",
      alreadyActivated: true
    });

    await expect(service.activatePersona(userId, "BUYER")).resolves.toMatchObject({
      alreadyActivated: true,
      nextAction: "OPEN_BUYER_DASHBOARD"
    });
  });

  it("switches to completed and incomplete personas with the correct destination", async () => {
    switchPersona
      .mockResolvedValueOnce({ status: "OK", onboardingStatus: "COMPLETED" })
      .mockResolvedValueOnce({ status: "OK", onboardingStatus: "NOT_STARTED" });

    await expect(service.switchPersona(userId, "BUYER")).resolves.toMatchObject({
      nextAction: "OPEN_BUYER_DASHBOARD"
    });
    await expect(
      service.switchPersona(userId, "SELLER_DEVELOPER")
    ).resolves.toMatchObject({ nextAction: "COMPLETE_SELLER_ONBOARDING" });
  });

  it("rejects switching to a non-activated persona with a stable code", async () => {
    switchPersona.mockResolvedValue({ status: "PERSONA_NOT_ACTIVATED" });

    await expect(
      service.switchPersona(userId, "SELLER_DEVELOPER")
    ).rejects.toMatchObject({ statusCode: 409, code: "PERSONA_NOT_ACTIVATED" });
  });

  it("maps unverified, suspended, and locked account states to stable errors", async () => {
    activatePersona
      .mockResolvedValueOnce({ status: "ACCOUNT_VERIFICATION_REQUIRED" })
      .mockResolvedValueOnce({ status: "ACCOUNT_SUSPENDED" })
      .mockResolvedValueOnce({ status: "ACCOUNT_LOCKED" });

    await expect(service.activatePersona(userId, "BUYER")).rejects.toMatchObject({
      code: "ACCOUNT_VERIFICATION_REQUIRED"
    });
    await expect(service.activatePersona(userId, "BUYER")).rejects.toMatchObject({
      code: "ACCOUNT_SUSPENDED"
    });
    await expect(service.activatePersona(userId, "BUYER")).rejects.toMatchObject({
      statusCode: 423,
      code: "ACCOUNT_LOCKED"
    });
  });

  it("never exposes storage errors", async () => {
    getState.mockRejectedValue(
      new CustomerOnboardingInfrastructureError("raw Supabase detail")
    );

    await expect(service.getStatus(userId)).rejects.toMatchObject({
      statusCode: 503,
      code: "ONBOARDING_UNAVAILABLE",
      message: "Customer onboarding is temporarily unavailable"
    });
  });
});
