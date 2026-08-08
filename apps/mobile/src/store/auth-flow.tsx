import * as SecureStore from "expo-secure-store";
import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";
import type { VerificationFlow } from "@/types/auth";
const FlowContext = createContext<{ flow: VerificationFlow | null; setFlow: (flow: VerificationFlow | null) => void }>({ flow: null, setFlow: () => undefined });
export function AuthFlowProvider({ children }: { children: ReactNode }) { const [flow, setFlow] = useState<VerificationFlow | null>(null); return <FlowContext.Provider value={{ flow, setFlow }}>{children}</FlowContext.Provider>; }
export const useAuthFlow = () => useContext(FlowContext);
// This boundary is intentionally unused by registration OTP. Future login can persist refresh tokens only here.
export const secureSession = { saveRefreshToken: (token: string) => SecureStore.setItemAsync("beryl_customer_refresh", token), getRefreshToken: () => SecureStore.getItemAsync("beryl_customer_refresh"), clear: () => SecureStore.deleteItemAsync("beryl_customer_refresh") };
