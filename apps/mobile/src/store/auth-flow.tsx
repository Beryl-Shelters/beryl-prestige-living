import * as SecureStore from "expo-secure-store";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode, SetStateAction } from "react";
import type { Href } from "expo-router";
import { ApiError, getAuthenticated, post, request } from "@/api/client";
import { customerPersonaForAnalytics, identifyCustomerAnalytics, resetCustomerAnalytics, trackCustomerEvent, updateCustomerAnalyticsPersona } from "@/analytics/customer";
import type { CustomerSession, NextAction, OnboardingStatus, Persona, PersonaList, PersonaMutation, ResetFlow, VerificationFlow } from "@/types/auth";

const FlowContext = createContext<{ flow: VerificationFlow | null; setFlow: (flow: SetStateAction<VerificationFlow | null>) => void }>({ flow: null, setFlow: () => undefined });
const ResetFlowContext = createContext<{ resetFlow: ResetFlow | null; setResetFlow: (flow: SetStateAction<ResetFlow | null>) => void }>({ resetFlow: null, setResetFlow: () => undefined });
const ACCESS_KEY = "beryl_customer_access_token";
const REFRESH_KEY = "beryl_customer_refresh_token";
const SESSION_STATE_KEY = "beryl_customer_session_state";
type CachedSessionState = Pick<CustomerSession, "activePersona" | "personas" | "nextAction">;
const actionRoutes: Record<NextAction, Href> = { VERIFY_EMAIL: "/verify-email", COMPLETE_BUYER_ONBOARDING: "/buyer", COMPLETE_SELLER_ONBOARDING: "/seller", OPEN_BUYER_DASHBOARD: "/buyer-dashboard", OPEN_SELLER_DASHBOARD: "/seller-dashboard" };
const accountIdFromAccessToken = (token?: string | null) => { try { const payload = token?.split(".")[1]; if (!payload) return undefined; const json = globalThis.atob(payload.replace(/-/g, "+").replace(/_/g, "/")); const sub = (JSON.parse(json) as { sub?: unknown }).sub; return typeof sub === "string" ? sub : undefined; } catch { return undefined; } };

export function AuthFlowProvider({ children }: { children: ReactNode }) { const [flow, setFlow] = useState<VerificationFlow | null>(null); const [resetFlow, setResetFlow] = useState<ResetFlow | null>(null); return <FlowContext.Provider value={{ flow, setFlow }}><ResetFlowContext.Provider value={{ resetFlow, setResetFlow }}>{children}</ResetFlowContext.Provider></FlowContext.Provider>; }
export const useAuthFlow = () => useContext(FlowContext);
export const useResetFlow = () => useContext(ResetFlowContext);
export const secureSession = { save: async (accessToken: string, refreshToken: string) => Promise.all([SecureStore.setItemAsync(ACCESS_KEY, accessToken), SecureStore.setItemAsync(REFRESH_KEY, refreshToken)]), restore: async () => Promise.all([SecureStore.getItemAsync(ACCESS_KEY), SecureStore.getItemAsync(REFRESH_KEY)]), saveState: async (state: CachedSessionState) => SecureStore.setItemAsync(SESSION_STATE_KEY, JSON.stringify(state)), restoreState: async (): Promise<CachedSessionState | null> => { const value=await SecureStore.getItemAsync(SESSION_STATE_KEY); try { return value?JSON.parse(value) as CachedSessionState:null; } catch { return null; } }, clear: async () => Promise.all([SecureStore.deleteItemAsync(ACCESS_KEY), SecureStore.deleteItemAsync(REFRESH_KEY), SecureStore.deleteItemAsync(SESSION_STATE_KEY)]) };

type SessionContextValue = { isAuthenticated: boolean; isHydrating: boolean; customer: CustomerSession["user"]; activePersona: CustomerSession["activePersona"] | null; personas: CustomerSession["personas"]; nextAction: NextAction | null; accessToken: string | null; establishSession: (session: CustomerSession) => Promise<void>; clearSession: () => Promise<void>; restoreSession: () => Promise<OnboardingStatus | null>; refreshOnboardingStatus: () => Promise<OnboardingStatus | null>; fetchPersonas: () => Promise<PersonaList | null>; activatePersona: (personaType: Persona["type"]) => Promise<PersonaMutation>; switchPersona: (personaType: Persona["type"]) => Promise<PersonaMutation>; updatePersonaState: (status: OnboardingStatus) => void; routeFromNextAction: (action: NextAction) => Href; authenticatedRequest: <T>(path:string, method:"GET"|"POST"|"PATCH", body?:unknown)=>Promise<import("@/types/auth").ApiEnvelope<T>>; logout: () => Promise<void>; };
const SessionContext = createContext<SessionContextValue | null>(null);

export function CustomerSessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<CustomerSession | null>(null);
  const [isHydrating, setHydrating] = useState(true);
  const refreshInFlight = useRef<Promise<string | null> | null>(null);
  const clearSession = async () => { await secureSession.clear(); setSession(null); };
  const refreshAccessToken = async () => {
    if (refreshInFlight.current) return refreshInFlight.current;
    refreshInFlight.current = (async () => { const [, refreshToken] = await secureSession.restore(); if (!refreshToken) { await clearSession(); return null; } try { const result = await post<{accessToken:string;refreshToken:string}>("/auth/refresh", { refreshToken }); const next=result.data; if (!next?.accessToken || !next.refreshToken) throw new Error("Refresh response was incomplete"); await secureSession.save(next.accessToken,next.refreshToken); setSession(current=>current?{...current,accessToken:next.accessToken,refreshToken:next.refreshToken}:current); return next.accessToken; } catch { await clearSession(); return null; } finally { refreshInFlight.current=null; } })();
    return refreshInFlight.current;
  };
  const authenticatedRequest: SessionContextValue["authenticatedRequest"] = async (path, method, body) => { const token=session?.accessToken; if (!token) throw new ApiError("SESSION_NOT_FOUND",undefined,"Your session has expired. Please log in again."); try { return await request(path,method,body,token); } catch (error) { const api=error as ApiError; if (api.code!=="INVALID_ACCESS_TOKEN" && !(api instanceof ApiError && /401/.test(api.message))) throw error; const next=await refreshAccessToken(); if (!next) throw new ApiError("SESSION_EXPIRED",undefined,"Your session has expired. Please log in again."); return request(path,method,body,next); } };
  const logout = async () => { const active=session?.accessToken; const [,refreshToken]=await secureSession.restore(); await trackCustomerEvent("Logout", {}); await resetCustomerAnalytics(); try { if (active&&refreshToken) await request("/auth/logout","POST",{refreshToken},active); } finally { await clearSession(); } };
  const updatePersonaState = (status: OnboardingStatus) => { const nextState={activePersona:status.activePersona,personas:status.personas,nextAction:status.nextAction}; setSession((current) => current ? { ...current, ...nextState } : current); void secureSession.saveState(nextState); void updateCustomerAnalyticsPersona(customerPersonaForAnalytics(status.activePersona)); };
  const fetchPersonas = async () => { const response=await authenticatedRequest<PersonaList>("/personas","GET"); const data=response.data??null; if(data) setSession(current=>current?{...current,activePersona:data.activePersona,personas:data.personas}:current); return data; };
  const applyMutation = async (path:"/personas/activate"|"/personas/active", personaType:Persona["type"]) => { const previous=session?.activePersona; const response=await authenticatedRequest<PersonaMutation>(path,path==="/personas/activate"?"POST":"PATCH",{personaType}); if(!response.data) throw new Error("Persona update was not returned"); const mutation=response.data; const list=await fetchPersonas().catch(()=>null); setSession(current=>current?{...current,activePersona:mutation.activePersona,personas:list?.personas??current.personas.map(item=>item.type===personaType?{...item,activated:true,isActive:item.type===mutation.activePersona,onboardingStatus:mutation.onboardingStatus}:item),nextAction:mutation.nextAction}:current); await updateCustomerAnalyticsPersona(customerPersonaForAnalytics(mutation.activePersona)); if(path==="/personas/active"&&previous&&previous!==mutation.activePersona) void trackCustomerEvent("Persona Switched",{from_persona:customerPersonaForAnalytics(previous),to_persona:customerPersonaForAnalytics(mutation.activePersona)}); return mutation; };
  const activatePersona = (personaType:Persona["type"]) => applyMutation("/personas/activate",personaType);
  const switchPersona = (personaType:Persona["type"]) => applyMutation("/personas/active",personaType);
  const refreshOnboardingStatus = async () => { const token=session?.accessToken; if(!token)return null; const response=await authenticatedRequest<OnboardingStatus>("/onboarding/status","GET"); const status=response.data??null; if(status)updatePersonaState(status); return status; };
  const restoreSession = async () => {
    const [accessToken, refreshToken] = await secureSession.restore();
    if (!accessToken || !refreshToken) { setHydrating(false); return null; }
    try {
      let response; try { response=await getAuthenticated<OnboardingStatus>("/onboarding/status", accessToken); } catch (error) { const api=error as ApiError; if (api.code!=="INVALID_ACCESS_TOKEN") throw error; const next=await refreshAccessToken(); if(!next) return null; response=await getAuthenticated<OnboardingStatus>("/onboarding/status",next); }
      const status = response.data ?? null;
      const [currentAccessToken,currentRefreshToken]=await secureSession.restore();
      if (status && currentAccessToken && currentRefreshToken) { const nextState={ activePersona: status.activePersona, personas: status.personas, nextAction: status.nextAction }; setSession({ accessToken: currentAccessToken, refreshToken: currentRefreshToken, user: null, ...nextState }); await secureSession.saveState(nextState); }
      return status;
    } catch { await clearSession(); return null; } finally { setHydrating(false); }
  };
  const restoreCachedSession = async () => { const [[accessToken,refreshToken],cachedState]=await Promise.all([secureSession.restore(),secureSession.restoreState()]); if(!accessToken||!refreshToken){setHydrating(false);return;} if(cachedState){setSession({accessToken,refreshToken,user:null,...cachedState});setHydrating(false);void restoreSession();return;} await restoreSession(); };
  useEffect(() => { void restoreCachedSession(); }, []);
  const value = useMemo<SessionContextValue>(() => ({ isAuthenticated: Boolean(session), isHydrating, customer: session?.user ?? null, activePersona: session?.activePersona ?? null, personas: session?.personas ?? [], nextAction: session?.nextAction ?? null, accessToken: session?.accessToken ?? null, establishSession: async (next) => { await Promise.all([secureSession.save(next.accessToken, next.refreshToken),secureSession.saveState({activePersona:next.activePersona,personas:next.personas,nextAction:next.nextAction})]); setSession(next); setHydrating(false); if(next.user) await identifyCustomerAnalytics(next.user.id,customerPersonaForAnalytics(next.activePersona)); }, clearSession, restoreSession, refreshOnboardingStatus, fetchPersonas, activatePersona, switchPersona, updatePersonaState, routeFromNextAction: (action) => actionRoutes[action] ?? "/login", authenticatedRequest, logout }), [session, isHydrating]);
  useEffect(() => { const accountId=session?.user?.id??accountIdFromAccessToken(session?.accessToken); if(accountId&&session) void identifyCustomerAnalytics(accountId, customerPersonaForAnalytics(session.activePersona)); }, [session?.user?.id, session?.accessToken, session?.activePersona]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
export const useCustomerSession = () => { const context = useContext(SessionContext); if (!context) throw new Error("CustomerSessionProvider is required"); return context; };
