import { supabaseAdmin } from "../../config/supabase";
import {
  CustomerAccountStatus,
  Currency,
  PersonaOnboardingStatus,
  PersonaType,
  ProfileType
} from "./auth-onboarding.types";
import {
  BuyerOnboardingInput,
  BuyerOnboardingMutation,
  CustomerOnboardingInfrastructureError,
  CustomerOnboardingState,
  CustomerOnboardingStore,
  MutationStatus,
  PersonaActivationMutation,
  PersonaSwitchMutation,
  SellerOnboardingInput,
  SellerOnboardingMutation
} from "./customer-onboarding.types";

const infrastructureFailure = () =>
  new CustomerOnboardingInfrastructureError(
    "Customer onboarding storage failed"
  );

const nullableNumber = (value: unknown) =>
  value === null || value === undefined ? null : Number(value);

export class SupabaseCustomerOnboardingStore
  implements CustomerOnboardingStore
{
  async getState(userId: string): Promise<CustomerOnboardingState | null> {
    const [profileResult, personasResult] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select(
          "account_status, email_verified_at, active_persona, last_active_persona"
        )
        .eq("id", userId)
        .maybeSingle(),
      supabaseAdmin
        .from("user_personas")
        .select("persona_type, onboarding_status, activated_at")
        .eq("user_id", userId)
        .order("activated_at", { ascending: true })
    ]);

    if (profileResult.error || personasResult.error) throw infrastructureFailure();
    if (!profileResult.data) return null;

    const profile = profileResult.data as Record<string, unknown>;
    if (!profile.active_persona || !profile.last_active_persona) {
      throw infrastructureFailure();
    }

    return {
      accountStatus: profile.account_status as CustomerAccountStatus,
      emailVerified: Boolean(profile.email_verified_at),
      activePersona: profile.active_persona as PersonaType,
      lastActivePersona: profile.last_active_persona as PersonaType,
      personas: (personasResult.data ?? []).map((persona) => ({
        type: persona.persona_type as PersonaType,
        onboardingStatus:
          persona.onboarding_status as PersonaOnboardingStatus,
        activated: true as const
      }))
    };
  }

  async completeBuyer(
    userId: string,
    input: BuyerOnboardingInput
  ): Promise<BuyerOnboardingMutation> {
    const skip = input.skip === true;
    const { data, error } = await supabaseAdmin
      .rpc("complete_customer_buyer_onboarding", {
        p_user_id: userId,
        p_skip: skip,
        p_preferred_locations: skip ? null : input.preferredLocations,
        p_budget_min: skip ? null : input.budgetMin ?? null,
        p_budget_max: skip ? null : input.budgetMax ?? null,
        p_currency: skip ? "NGN" : input.currency
      })
      .single();

    if (error || !data) throw infrastructureFailure();
    const row = data as Record<string, unknown>;

    return {
      status: row.result_status as MutationStatus,
      activePersona: row.result_active_persona as PersonaType | undefined,
      onboardingStatus:
        row.result_onboarding_status as PersonaOnboardingStatus | undefined,
      preferredLocations: row.result_preferred_locations as string[] | undefined,
      budgetMin: nullableNumber(row.result_budget_min),
      budgetMax: nullableNumber(row.result_budget_max),
      currency: row.result_currency as Currency | undefined,
      skipped: row.result_skipped as boolean | undefined
    };
  }

  async completeSeller(
    userId: string,
    input: SellerOnboardingInput
  ): Promise<SellerOnboardingMutation> {
    const skip = input.skip === true;
    const { data, error } = await supabaseAdmin
      .rpc("complete_customer_seller_onboarding", {
        p_user_id: userId,
        p_skip: skip,
        p_profile_type: skip ? null : input.profileType,
        p_company_name: skip ? null : input.companyName ?? null,
        p_company_address: skip ? null : input.companyAddress ?? null
      })
      .single();

    if (error || !data) throw infrastructureFailure();
    const row = data as Record<string, unknown>;

    return {
      status: row.result_status as MutationStatus,
      activePersona: row.result_active_persona as PersonaType | undefined,
      onboardingStatus:
        row.result_onboarding_status as PersonaOnboardingStatus | undefined,
      profileType: row.result_profile_type as ProfileType | null | undefined,
      companyName: row.result_company_name as string | null | undefined,
      companyAddress: row.result_company_address as string | null | undefined,
      skipped: row.result_skipped as boolean | undefined
    };
  }

  async activatePersona(
    userId: string,
    personaType: PersonaType
  ): Promise<PersonaActivationMutation> {
    const { data, error } = await supabaseAdmin
      .rpc("activate_customer_persona", {
        p_user_id: userId,
        p_persona_type: personaType
      })
      .single();

    if (error || !data) throw infrastructureFailure();
    const row = data as Record<string, unknown>;

    return {
      status: row.result_status as MutationStatus,
      activePersona: row.result_active_persona as PersonaType | undefined,
      personas: row.result_personas as PersonaType[] | undefined,
      onboardingStatus:
        row.result_onboarding_status as PersonaOnboardingStatus | undefined,
      alreadyActivated: row.result_already_activated as boolean | undefined
    };
  }

  async switchPersona(
    userId: string,
    personaType: PersonaType
  ): Promise<PersonaSwitchMutation> {
    const { data, error } = await supabaseAdmin
      .rpc("switch_customer_active_persona", {
        p_user_id: userId,
        p_persona_type: personaType
      })
      .single();

    if (error || !data) throw infrastructureFailure();
    const row = data as Record<string, unknown>;

    return {
      status: row.result_status as MutationStatus,
      activePersona: row.result_active_persona as PersonaType | undefined,
      onboardingStatus:
        row.result_onboarding_status as PersonaOnboardingStatus | undefined,
      alreadyActive: row.result_already_active as boolean | undefined
    };
  }
}
