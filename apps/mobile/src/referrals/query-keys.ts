export const referralQueryKeys = {
  all: ["mobile-referrals"] as const,
  context: (authenticated: boolean) => ["mobile-referrals", "context", authenticated] as const,
  dashboard: (authenticated: boolean) => ["mobile-referrals", "dashboard", authenticated] as const,
  banks: ["mobile-referrals", "banks"] as const,
  payout: (authenticated: boolean) => ["mobile-referrals", "payout", authenticated] as const
};
