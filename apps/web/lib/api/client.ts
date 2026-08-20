import axios from "axios";
import type {
  ApiSuccess,
  CustomerSessionState,
  ForgotPasswordResult,
  LoginResult,
  MarketplaceSearchParams,
  MarketplaceSearchResult,
  MarketplaceInterestRequest,
  MarketplaceInterestResult,
  MarketplacePropertyDetailResult,
  MarketplaceSavedPropertyMutation,
  MarketplaceSavedPropertyListResult,
  SellerListingListResult,
  SellerListingManagementResult,
  SellerListingStatus,
  SellerDraft,
  SellerDraftResult,
  SellerReopenResult,
  SellerPropertyReviewResult,
  SellerSalesMandateInput,
  SellerSalesMandateResult,
  SellerSubmissionResult,
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
  register: (body: RegisterRequest, analyticsDistinctId?: string) => client.post<ApiSuccess<RegisterResult>>("/register", body, { headers: analyticsDistinctId ? { "x-beryl-analytics-distinct-id": analyticsDistinctId } : undefined }).then(dataOf),
  verifyEmail: (body: { email: string; otp: string }) => client.post<ApiSuccess<VerifyEmailResult>>("/verify-email", body).then(dataOf),
  resendVerificationOtp: (body: { email: string }) => client.post<ApiSuccess<{ resendAvailableIn: number }>>("/resend-verification-otp", body).then(dataOf),
  login: (body: { identifier: string; password: string }, analyticsDistinctId?: string) => client.post<ApiSuccess<LoginResult>>("/login", body, { headers: analyticsDistinctId ? { "x-beryl-analytics-distinct-id": analyticsDistinctId } : undefined }).then(dataOf),
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
  saveProperty: (propertyId: string) => client.post<ApiSuccess<MarketplaceSavedPropertyMutation>>(`/properties/${propertyId}/save`, {}).then(dataOf),
  unsaveProperty: (propertyId: string) => client.delete<ApiSuccess<never>>(`/properties/${propertyId}/save`).then(dataOf),
  savedProperties: (params: { page?: number; limit?: number } = {}) => client.get<ApiSuccess<MarketplaceSavedPropertyListResult>>("/properties/saved/me", { params }).then(dataOf),
  expressMarketplaceInterest: (propertyId: string, body: MarketplaceInterestRequest) => client.post<ApiSuccess<MarketplaceInterestResult>>(`/marketplace/properties/${propertyId}/interest`, body).then(dataOf),
  sellerListings: (params: { status: SellerListingStatus; page: number; limit: number }) => client.get<ApiSuccess<SellerListingListResult>>("/marketplace/seller/properties", { params }).then(dataOf),
  sellerListingManagement: (propertyId: string) => client.get<ApiSuccess<SellerListingManagementResult>>(`/marketplace/seller/properties/${propertyId}/management`).then(dataOf),
  createSellerDraft: (body: Partial<SellerDraft>) => client.post<ApiSuccess<SellerDraftResult>>("/marketplace/seller/properties", body).then(dataOf),
  sellerDraft: (propertyId: string) => client.get<ApiSuccess<SellerDraftResult>>(`/marketplace/seller/properties/${propertyId}`).then(dataOf),
  saveSellerDraft: (propertyId: string, body: Partial<SellerDraft>) => client.patch<ApiSuccess<SellerDraftResult>>(`/marketplace/seller/properties/${propertyId}`, body).then(dataOf),
  reopenSellerProperty: (propertyId: string) => client.post<ApiSuccess<SellerReopenResult>>(`/marketplace/seller/properties/${propertyId}/reopen`, {}).then(dataOf),
  uploadSellerImages: (propertyId: string, body: FormData) => client.post(`/marketplace/seller/properties/${propertyId}/images`, body, { headers: { "content-type": "multipart/form-data" } }).then(dataOf),
  deleteSellerImage: (propertyId: string, imageId: string) => client.delete(`/marketplace/seller/properties/${propertyId}/images/${imageId}`).then(dataOf),
  reorderSellerImages: (propertyId: string, imageIds: string[]) => client.patch(`/marketplace/seller/properties/${propertyId}/images`, { imageIds }).then(dataOf),
  setSellerCover: (propertyId: string, imageId: string) => client.patch(`/marketplace/seller/properties/${propertyId}/images/${imageId}`, {}).then(dataOf),
  uploadSellerDocument: (propertyId: string, body: FormData) => client.post(`/marketplace/seller/properties/${propertyId}/documents`, body, { headers: { "content-type": "multipart/form-data" } }).then(dataOf),
  deleteSellerDocument: (propertyId: string, documentId: string) => client.delete(`/marketplace/seller/properties/${propertyId}/documents/${documentId}`).then(dataOf),
  sellerMandate: (propertyId: string) => client.get<ApiSuccess<SellerSalesMandateResult>>(`/marketplace/seller/properties/${propertyId}/mandate`).then(dataOf),
  saveSellerMandate: (propertyId: string, body: SellerSalesMandateInput) => client.put<ApiSuccess<SellerSalesMandateResult>>(`/marketplace/seller/properties/${propertyId}/mandate`, body).then(dataOf),
  sellerReview: (propertyId: string) => client.get<ApiSuccess<SellerPropertyReviewResult>>(`/marketplace/seller/properties/${propertyId}/review`).then(dataOf),
  submitSellerProperty: (propertyId: string) => client.post<ApiSuccess<SellerSubmissionResult>>(`/marketplace/seller/properties/${propertyId}/submit`, {}).then(dataOf),
  session: () => axios.get<ApiSuccess<CustomerSessionState>>("/api/session").then(dataOf)
};

export const marketplaceApi = {
  search: (params: MarketplaceSearchParams) => axios
    .get<ApiSuccess<MarketplaceSearchResult>>("/api/marketplace", { params })
    .then(dataOf),
  detail: (propertyId: string) => axios
    .get<ApiSuccess<MarketplacePropertyDetailResult>>(`/api/marketplace/${propertyId}`)
    .then(dataOf)
};
