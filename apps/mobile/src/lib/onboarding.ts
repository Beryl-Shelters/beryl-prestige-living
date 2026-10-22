export const BRAND_SPLASH_DURATION_MS = 6000;
export const RETURNING_SESSION_SPLASH_MS = 900;
export const SPLASH_EXIT_MS = 400;
export const MAX_SESSION_RESTORE_WAIT_MS = 12000;
export const ONBOARDING_INTERVAL_MS = 3500;

export type StartupAuthStatus = "loading" | "signedOut" | "signedIn" | "unavailable";

export function splashDuration(status: StartupAuthStatus, alreadyHandled = false) {
  if (alreadyHandled) return 0;
  return status === "signedOut" ? BRAND_SPLASH_DURATION_MS : RETURNING_SESSION_SPLASH_MS;
}

export function launchDelay(status: StartupAuthStatus, elapsedMs: number) {
  const target = status === "loading" ? MAX_SESSION_RESTORE_WAIT_MS : splashDuration(status);
  return Math.max(0, target - Math.max(0, elapsedMs));
}

export function launchDestination(status: StartupAuthStatus, pathname: string) {
  return status === "signedOut" && pathname === "/" ? "onboarding" : "hidden";
}

export function nextOnboardingSlide(index: number, count: number) {
  return count > 0 ? (index + 1) % count : 0;
}

export function onboardingPage(offset: number, width: number, count: number) {
  if (width <= 0 || count <= 0) return 0;
  return Math.min(count - 1, Math.max(0, Math.round(offset / width)));
}

export function shouldAutoAdvance(focused: boolean, appState: string, reducedMotion: boolean) {
  return focused && appState === "active" && !reducedMotion;
}

