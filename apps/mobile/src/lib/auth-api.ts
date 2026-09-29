import { apiClient } from "./api-client";
import { secureSessionStore } from "./session-store";

export type Customer = { id:string;first_name:string|null;last_name:string|null;email:string;phone_number_normalized:string|null;account_type:string|null;profile_type:string|null;profile_image_url?:string|null };
export type Registration = { firstName:string;lastName:string;email:string;countryCode:string;phoneNumber:string;accountType:"INVESTOR"|"PROPERTY_DEVELOPER"|"LANDLORD"|"REGISTERED_AGENT"|"FREELANCE_AGENT";profileType:"PERSONAL"|"BUSINESS";password:string;confirmPassword:string };

export const authApi = {
  register: (input:Registration) => apiClient.request<{maskedEmail:string}>("/api/v1/auth/register",{method:"POST",body:input,authenticated:false}),
  login: (identifier:string,password:string) => apiClient.request<Record<string,never>>("/api/v1/auth/login",{method:"POST",body:{identifier,password},authenticated:false}),
  verificationContext: () => apiClient.request<{maskedEmail:string}>("/api/v1/auth/verification-context",{authenticated:false,purposes:["verify"]}),
  verifyEmail: async (code:string) => { const data=await apiClient.request<Record<string,never>>("/api/v1/auth/verify-email",{method:"POST",body:{code},authenticated:false,purposes:["verify"]});await secureSessionStore.remove("verify");return data; },
  resendVerification: (identifier?:string) => apiClient.request<{message:string}>("/api/v1/auth/resend-verification",{method:"POST",body:identifier?{identifier}:{},authenticated:false,purposes:["verify"]}),
  me: () => apiClient.request<{customer:Customer}>("/api/v1/auth/me"),
  logout: async () => { try { await apiClient.request("/api/v1/auth/logout",{method:"POST",body:{}}); } finally { await secureSessionStore.clear(); } },
};
