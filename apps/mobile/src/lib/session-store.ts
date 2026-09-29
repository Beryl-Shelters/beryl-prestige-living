import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

export type SessionPurpose = "account" | "verify" | "forgot" | "recovery" | "oauth";
export interface SessionStore { get(purpose: SessionPurpose): Promise<string | null>; set(purpose: SessionPurpose, value: string): Promise<void>; remove(purpose: SessionPurpose): Promise<void>; clear(): Promise<void>; }
const key = (purpose: SessionPurpose) => `beryl.v2.customer.${purpose}`;

const nativeSessionStore: SessionStore = {
  get: (purpose) => SecureStore.getItemAsync(key(purpose)),
  set: (purpose, value) => SecureStore.setItemAsync(key(purpose), value, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }),
  remove: (purpose) => SecureStore.deleteItemAsync(key(purpose)),
  clear: async () => { await Promise.all((["account","verify","forgot","recovery","oauth"] as SessionPurpose[]).map((purpose) => SecureStore.deleteItemAsync(key(purpose)))); },
};
const webValues=new Map<SessionPurpose,string>();
const webSessionStore:SessionStore={get:async purpose=>webValues.get(purpose)??null,set:async(purpose,value)=>{webValues.set(purpose,value);},remove:async purpose=>{webValues.delete(purpose);},clear:async()=>{webValues.clear();}};
export const secureSessionStore:SessionStore=Platform.OS==="web"?webSessionStore:nativeSessionStore;
