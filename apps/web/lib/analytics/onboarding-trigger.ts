import type { CustomerAnalyticsPersona } from "./customer";

type OnboardingTrigger = { persona: CustomerAnalyticsPersona; source: "signup" | "persona_activation" };
const storageKey = "beryl-onboarding-analytics-trigger";

export function prepareOnboardingAnalyticsTrigger(trigger: OnboardingTrigger) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(storageKey, JSON.stringify(trigger));
}

export function consumeOnboardingAnalyticsTrigger(persona: CustomerAnalyticsPersona): OnboardingTrigger | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(storageKey);
  sessionStorage.removeItem(storageKey);
  try {
    const trigger = JSON.parse(raw ?? "") as OnboardingTrigger;
    return trigger.persona === persona && (trigger.source === "signup" || trigger.source === "persona_activation") ? trigger : null;
  } catch {
    return null;
  }
}
