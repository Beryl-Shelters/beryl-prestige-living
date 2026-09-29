import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import { authApi, type Customer } from "@/lib/auth-api";
import { setUnauthorizedHandler } from "@/lib/api-client";
import { secureSessionStore } from "@/lib/session-store";
import { restoreCustomerSession } from "@/lib/session-lifecycle";

type AuthStatus = "loading" | "signedOut" | "signedIn" | "unavailable";
type AuthContextValue = {
  status: AuthStatus; customer: Customer | null; restore: () => Promise<void>;
  login: (identifier:string,password:string) => Promise<void>; verifyEmail: (code:string) => Promise<void>; logout: () => Promise<void>;
};
const AuthContext=createContext<AuthContextValue|null>(null);

export function AuthProvider({children}:PropsWithChildren){
  const [status,setStatus]=useState<AuthStatus>("loading");const [customer,setCustomer]=useState<Customer|null>(null);
  const signedOut=useCallback(async()=>{await secureSessionStore.remove("account");setCustomer(null);setStatus("signedOut");},[]);
  const restore=useCallback(async()=>{setStatus("loading");const result=await restoreCustomerSession(secureSessionStore,async()=>(await authApi.me()).customer);setCustomer(result.customer);setStatus(result.status);},[]);
  useEffect(()=>{setUnauthorizedHandler(signedOut);queueMicrotask(()=>void restore());return()=>setUnauthorizedHandler(undefined);},[restore,signedOut]);
  const login=useCallback(async(identifier:string,password:string)=>{await authApi.login(identifier,password);await restore();},[restore]);
  const verifyEmail=useCallback(async(code:string)=>{await authApi.verifyEmail(code);await restore();},[restore]);
  const logout=useCallback(async()=>{try{await authApi.logout();}finally{setCustomer(null);setStatus("signedOut");}},[]);
  const value=useMemo(()=>({status,customer,restore,login,verifyEmail,logout}),[status,customer,restore,login,verifyEmail,logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(){const value=useContext(AuthContext);if(!value)throw new Error("useAuth must be used within AuthProvider");return value;}
