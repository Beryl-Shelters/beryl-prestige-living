import {
  Currency,
  CustomerAccountStatus,
  PersonaOnboardingStatus,
  PersonaType,
  ProfileType
} from "./auth-onboarding.types";

export type PersonaState = {
  type: PersonaType;
  onboardingStatus: PersonaOnboardingStatus;
  activated: true;
};

export type CustomerOnboardingState = {
  accountStatus: CustomerAccountStatus;
  emailVerified: boolean;
  activePersona: PersonaType;
  lastActivePersona: PersonaType;
  personas: PersonaState[];
};

export type BuyerOnboardingInput =
  | { skip: true }
  | {
      skip?: false;
      preferredLocations: string[];
      budgetMin?: number;
      budgetMax?: number;
      currency: Currency;
    };

export type SellerOnboardingInput =
  | { skip: true }
  | {
      skip?: false;
      profileType: ProfileType;
      companyName?: string;
      companyAddress?: string;
    };

export type MutationStatus =
  | "OK"
  | "ACCOUNT_NOT_FOUND"
  | "ACCOUNT_VERIFICATION_REQUIRED"
  | "ACCOUNT_SUSPENDED"
  | "ACCOUNT_LOCKED"
  | "BUYER_PERSONA_NOT_ACTIVE"
  | "SELLER_PERSONA_NOT_ACTIVE"
  | "PERSONA_NOT_ACTIVATED"
  | "ONBOARDING_VALIDATION_ERROR"
  | "INVALID_BUDGET_RANGE";

export type BuyerOnboardingMutation = {
  status: MutationStatus;
  activePersona?: PersonaType;
  onboardingStatus?: PersonaOnboardingStatus;
  preferredLocations?: string[];
  budgetMin?: number | null;
  budgetMax?: number | null;
  currency?: Currency;
  skipped?: boolean;
};

export type SellerOnboardingMutation = {
  status: MutationStatus;
  activePersona?: PersonaType;
  onboardingStatus?: PersonaOnboardingStatus;
  profileType?: ProfileType | null;
  companyName?: string | null;
  companyAddress?: string | null;
  skipped?: boolean;
};

export type PersonaActivationMutation = {
  status: MutationStatus;
  activePersona?: PersonaType;
  personas?: PersonaType[];
  onboardingStatus?: PersonaOnboardingStatus;
  alreadyActivated?: boolean;
};

export type PersonaSwitchMutation = {
  status: MutationStatus;
  activePersona?: PersonaType;
  onboardingStatus?: PersonaOnboardingStatus;
  alreadyActive?: boolean;
};

export interface CustomerOnboardingStore {
  getState(userId: string): Promise<CustomerOnboardingState | null>;
  completeBuyer(
    userId: string,
    input: BuyerOnboardingInput
  ): Promise<BuyerOnboardingMutation>;
  completeSeller(
    userId: string,
    input: SellerOnboardingInput
  ): Promise<SellerOnboardingMutation>;
  activatePersona(
    userId: string,
    personaType: PersonaType
  ): Promise<PersonaActivationMutation>;
  switchPersona(
    userId: string,
    personaType: PersonaType
  ): Promise<PersonaSwitchMutation>;
}

export class CustomerOnboardingInfrastructureError extends Error {}
