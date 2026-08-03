import { AppError } from "../../utils/AppError";
import {
  PERSONA_TYPES,
  PersonaOnboardingStatus,
  PersonaType
} from "./auth-onboarding.types";
import {
  BuyerOnboardingInput,
  CustomerOnboardingInfrastructureError,
  CustomerOnboardingStore,
  MutationStatus,
  SellerOnboardingInput
} from "./customer-onboarding.types";

export const nextActionFor = (
  personaType: PersonaType,
  onboardingStatus: PersonaOnboardingStatus
) => {
  if (onboardingStatus !== "COMPLETED") {
    return personaType === "BUYER"
      ? "COMPLETE_BUYER_ONBOARDING"
      : "COMPLETE_SELLER_ONBOARDING";
  }

  return personaType === "BUYER"
    ? "OPEN_BUYER_DASHBOARD"
    : "OPEN_SELLER_DASHBOARD";
};

const activationActionFor = (personaType: PersonaType) =>
  personaType === "BUYER"
    ? "ACTIVATE_BUYER_PERSONA"
    : "ACTIVATE_SELLER_PERSONA";

const missingStepsFor = (
  personaType: PersonaType,
  onboardingStatus: PersonaOnboardingStatus
) => {
  if (onboardingStatus === "COMPLETED") return [];
  return personaType === "BUYER" ? ["PREFERRED_LOCATIONS"] : ["PROFILE_TYPE"];
};

const throwForStatus = (status: MutationStatus): never => {
  switch (status) {
    case "ACCOUNT_VERIFICATION_REQUIRED":
      throw new AppError(
        "Account verification is required",
        403,
        "ACCOUNT_VERIFICATION_REQUIRED"
      );
    case "ACCOUNT_SUSPENDED":
      throw new AppError("Account is suspended", 403, "ACCOUNT_SUSPENDED");
    case "ACCOUNT_LOCKED":
      throw new AppError("Account is locked", 423, "ACCOUNT_LOCKED");
    case "BUYER_PERSONA_NOT_ACTIVE":
      throw new AppError(
        "Buyer persona is not activated",
        409,
        "BUYER_PERSONA_NOT_ACTIVE"
      );
    case "SELLER_PERSONA_NOT_ACTIVE":
      throw new AppError(
        "Seller/Developer persona is not activated",
        409,
        "SELLER_PERSONA_NOT_ACTIVE"
      );
    case "PERSONA_NOT_ACTIVATED":
      throw new AppError(
        "Persona has not been activated",
        409,
        "PERSONA_NOT_ACTIVATED"
      );
    case "ONBOARDING_VALIDATION_ERROR":
      throw new AppError(
        "Onboarding data is invalid",
        400,
        "ONBOARDING_VALIDATION_ERROR"
      );
    case "INVALID_BUDGET_RANGE":
      throw new AppError(
        "Maximum budget must be greater than or equal to minimum budget",
        400,
        "INVALID_BUDGET_RANGE"
      );
    default:
      throw new AppError("Customer account was not found", 404, "ACCOUNT_NOT_FOUND");
  }
};

export class CustomerOnboardingService {
  constructor(private readonly store: CustomerOnboardingStore) {}

  private async safely<T>(operation: () => Promise<T>) {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof AppError) throw error;
      if (error instanceof CustomerOnboardingInfrastructureError) {
        throw new AppError(
          "Customer onboarding is temporarily unavailable",
          503,
          "ONBOARDING_UNAVAILABLE"
        );
      }
      throw error;
    }
  }

  async getStatus(userId: string) {
    return this.safely(async () => {
      const state = await this.store.getState(userId);
      if (!state) {
        throw new AppError(
          "Customer account was not found",
          404,
          "ACCOUNT_NOT_FOUND"
        );
      }

      const active = state.personas.find(
        (persona) => persona.type === state.activePersona
      );
      if (!active) {
        throw new AppError(
          "Persona has not been activated",
          409,
          "PERSONA_NOT_ACTIVATED"
        );
      }

      return {
        accountStatus: state.accountStatus,
        emailVerified: state.emailVerified,
        activePersona: state.activePersona,
        lastActivePersona: state.lastActivePersona,
        personas: state.personas.map((persona) => ({
          ...persona,
          missingOnboardingSteps: missingStepsFor(
            persona.type,
            persona.onboardingStatus
          )
        })),
        missingOnboardingSteps: missingStepsFor(
          active.type,
          active.onboardingStatus
        ),
        nextAction: nextActionFor(active.type, active.onboardingStatus),
        dashboardAccess: active.onboardingStatus === "COMPLETED"
      };
    });
  }

  async completeBuyer(userId: string, input: BuyerOnboardingInput) {
    return this.safely(async () => {
      const result = await this.store.completeBuyer(userId, input);
      if (result.status !== "OK") throwForStatus(result.status);

      return {
        activePersona: "BUYER" as const,
        onboardingStatus: "COMPLETED" as const,
        preferredLocations: result.preferredLocations ?? [],
        budgetMin: result.budgetMin ?? null,
        budgetMax: result.budgetMax ?? null,
        currency: result.currency ?? "NGN",
        skipped: result.skipped ?? false,
        nextAction: "OPEN_BUYER_DASHBOARD" as const
      };
    });
  }

  async completeSeller(userId: string, input: SellerOnboardingInput) {
    return this.safely(async () => {
      const result = await this.store.completeSeller(userId, input);
      if (result.status !== "OK") throwForStatus(result.status);

      return {
        activePersona: "SELLER_DEVELOPER" as const,
        onboardingStatus: "COMPLETED" as const,
        profileType: result.profileType ?? null,
        companyName: result.companyName ?? null,
        companyAddress: result.companyAddress ?? null,
        skipped: result.skipped ?? false,
        nextAction: "OPEN_SELLER_DASHBOARD" as const
      };
    });
  }

  async getPersonas(userId: string) {
    return this.safely(async () => {
      const state = await this.store.getState(userId);
      if (!state) {
        throw new AppError(
          "Customer account was not found",
          404,
          "ACCOUNT_NOT_FOUND"
        );
      }

      return {
        activePersona: state.activePersona,
        personas: PERSONA_TYPES.map((type) => {
          const activated = state.personas.find((persona) => persona.type === type);
          return {
            type,
            activated: Boolean(activated),
            onboardingStatus: activated?.onboardingStatus ?? "NOT_STARTED",
            isActive: state.activePersona === type,
            nextAction: activated
              ? nextActionFor(type, activated.onboardingStatus)
              : activationActionFor(type)
          };
        })
      };
    });
  }

  async activatePersona(userId: string, personaType: PersonaType) {
    return this.safely(async () => {
      const result = await this.store.activatePersona(userId, personaType);
      if (result.status !== "OK") throwForStatus(result.status);
      const onboardingStatus = result.onboardingStatus ?? "NOT_STARTED";

      return {
        activePersona: personaType,
        personas: result.personas ?? [personaType],
        onboardingStatus,
        alreadyActivated: result.alreadyActivated ?? false,
        nextAction: nextActionFor(personaType, onboardingStatus)
      };
    });
  }

  async switchPersona(userId: string, personaType: PersonaType) {
    return this.safely(async () => {
      const result = await this.store.switchPersona(userId, personaType);
      if (result.status !== "OK") throwForStatus(result.status);
      const onboardingStatus = result.onboardingStatus ?? "NOT_STARTED";

      return {
        activePersona: personaType,
        onboardingStatus,
        alreadyActive: result.alreadyActive ?? false,
        nextAction: nextActionFor(personaType, onboardingStatus)
      };
    });
  }
}
