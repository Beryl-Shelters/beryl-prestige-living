import * as SecureStore from "expo-secure-store";
import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";

const REFERRAL_TRACKING_KEY = "beryl_referral_tracking_token";
export const referralTrackingSession = {
  save: (token: string) => SecureStore.setItemAsync(REFERRAL_TRACKING_KEY, token),
  restore: () => SecureStore.getItemAsync(REFERRAL_TRACKING_KEY),
  clear: () => SecureStore.deleteItemAsync(REFERRAL_TRACKING_KEY)
};

type TrackingIdentity = { fullName: string; phone: string };
type ReferralFlowValue = {
  trackingIdentity: TrackingIdentity | null;
  setTrackingIdentity: (value: TrackingIdentity | null) => void;
};
const ReferralFlowContext = createContext<ReferralFlowValue | null>(null);

export function ReferralFlowProvider({ children }: { children: ReactNode }) {
  const [trackingIdentity, setTrackingIdentity] = useState<TrackingIdentity | null>(null);
  return <ReferralFlowContext.Provider value={{ trackingIdentity, setTrackingIdentity }}>{children}</ReferralFlowContext.Provider>;
}

export const useReferralFlow = () => {
  const value = useContext(ReferralFlowContext);
  if (!value) throw new Error("ReferralFlowProvider is required");
  return value;
};
