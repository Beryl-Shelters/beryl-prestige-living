import axios from "axios";
import type {
  ApiSuccess,
  CustomerSessionState,
  ForgotPasswordResult,
  LoginResult,
  PersonaMutationResult,
  PersonaState,
  RegisterRequest,
  RegisterResult,
  ResetOtpResult,
  SessionsInvalidatedResult,
  VerifyEmailResult
} from "../contracts";

const client = axios.create({ baseURL: "/api/customer", headers: { "content-type": "application/json" } });
const dataOf = <T>(response: { data: ApiSuccess<T> }) => response.data;

export const customerApi = {
  register: (body: RegisterRequest) => client.post<ApiSuccess<RegisterResult>>("/register", body).then(dataOf),
  verifyEmail: (body: { email: string; otp: string }) => client.post<ApiSuccess<VerifyEmailResult>>("/verify-email", body).then(dataOf),
  resendVerificationOtp: (body: { email: string }) => client.post<ApiSuccess<{ resendAvailableIn: number }>>("/resend-verification-otp", body).then(dataOf),
  login: (body: { identifier: string; password: string }) => client.post<ApiSuccess<LoginResult>>("/login", body).then(dataOf),
  forgotPassword: (body: { email: string }) => client.post<ApiSuccess<ForgotPasswordResult>>("/forgot-password", body).then(dataOf),
  verifyResetOtp: (body: { email: string; otp: string }) => client.post<ApiSuccess<ResetOtpResult>>("/verify-password-reset-otp", body).then(dataOf),
  resetPassword: (body: { newPassword: string; confirmPassword: string }) => client.post<ApiSuccess<SessionsInvalidatedResult>>("/reset-password", body).then(dataOf),
  refresh: () => client.post<ApiSuccess<{ refreshed: true }>>("/refresh", {}).then(dataOf),
  logout: () => client.post<ApiSuccess<never>>("/logout", {}).then(dataOf),
  changePassword: (body: { currentPassword: string; newPassword: string; confirmPassword: string }) => client.patch<ApiSuccess<SessionsInvalidatedResult>>("/change-password", body).then(dataOf),
  onboardingStatus: () => client.get<ApiSuccess<CustomerSessionState>>("/onboarding/status").then(dataOf),
  buyerOnboarding: (body: { skip: true } | { preferredLocations: string[]; budgetMin?: number; budgetMax?: number; currency: string }) => client.patch<ApiSuccess<{ nextAction: string }>>("/onboarding/buyer", body).then(dataOf),
  sellerOnboarding: (body: { skip: true } | { profileType: "INDIVIDUAL" | "BUSINESS"; companyName?: string; companyAddress?: string }) => client.patch<ApiSuccess<{ nextAction: string }>>("/onboarding/seller", body).then(dataOf),
  personas: () => client.get<ApiSuccess<{ activePersona: string; personas: PersonaState[] }>>("/personas").then(dataOf),
  activatePersona: (personaType: string) => client.post<ApiSuccess<PersonaMutationResult>>("/personas/activate", { personaType }).then(dataOf),
  switchPersona: (personaType: string) => client.patch<ApiSuccess<PersonaMutationResult>>("/personas/active", { personaType }).then(dataOf),
  session: () => axios.get<ApiSuccess<CustomerSessionState>>("/api/session").then(dataOf)
};
