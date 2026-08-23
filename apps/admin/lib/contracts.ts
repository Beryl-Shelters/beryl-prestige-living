export type ApiEnvelope<T> = { success: boolean; message: string; code?: string; details?: Record<string, unknown>; data?: T };
export type AdminIdentity = { id: string; fullName: string; email: string; department?: string | null; adminRole: string; status: string; requiresPasswordChange: boolean };
export type AdminSessionState = { admin: AdminIdentity; nextAction: "OPEN_ADMIN_DASHBOARD"; accessTokenExpiresIn: number; refreshTokenExpiresIn: number };
export type LoginChallenge = { challengeId: string; maskedEmail: string; otpLength: 6; resendAvailableIn: number; nextAction: "VERIFY_ADMIN_LOGIN_OTP" };
export type LeadStage = "NEW" | "CONTACTED" | "WON" | "LOST";
export type AdminLeadCard = { id: string; referenceId: string; customerName: string; propertyId: string | null; propertyTitle: string | null; propertyReferenceId: string | null; stage: LeadStage; inquiryType: string; receivedAt: string };
export type AdminLeadList = { counts: Record<LeadStage, number>; total: number; items: AdminLeadCard[]; perStageLimit: number; query: string | null };
export type AdminLeadDetail = { id: string; referenceId: string; stage: LeadStage; inquiryType: string; receivedAt: string; updatedAt: string; customer: { id: string | null; fullName: string; email: string; phone: string; emailVerified: boolean; accountStatus: string | null; preferredContactMethod: "WHATSAPP" | "CALL" | "EMAIL" | null; personas: Array<{ type: string; onboardingStatus: string }> }; message: string | null; property: null | { id: string; referenceId: string; title: string; publicLocation: string; askingPrice: number; propertyCategory: string; propertyType: string; marketplaceStatus: string; initialDepositType: string | null; initialDepositValue: number | null; mandateType: string | null; coverImage: null | { id: string; url: string; order: number; isCover: boolean }; seller: null | { fullName: string | null; companyName: string | null } }; history: Array<{ id: string; previousStage: LeadStage; newStage: LeadStage; changedByAdminId: string; createdAt: string }> };
export type AdminCustomerRole = "BUYER" | "SELLER" | "REFERRER";
export type AdminCustomerListItem = { id: string; fullName: string; email: string; phone: string | null; referralCode: string | null; verified: boolean; joinedAt: string; roles: AdminCustomerRole[] };
export type AdminCustomerDirectory = { counts: { totalUsers: number; buyerProfiles: number; sellerProfiles: number; referrerProfiles: number }; items: AdminCustomerListItem[]; pagination: { page: number; limit: number; total: number; totalPages: number } };
export type AdminCustomerDetail = {
  customer: AdminCustomerListItem;
  buyerProfile: { activated: boolean; activatedAt: string | null; preferredAreas: string[]; budgetMin: number | null; budgetMax: number | null; currency: string | null };
  sellerProfile: { activated: boolean; activatedAt: string | null; sellerType: "INDIVIDUAL" | "BUSINESS" | null; companyName: string | null; companyAddress: string | null };
  referrerProfile: { activated: boolean; activatedAt: string | null; referralCode: string | null };
};
export type AdminPropertyImage = { id: string; url: string; order: number; isCover: boolean };
export type AdminPropertyReviewDetail = {
  summary: { id: string; referenceId: string; title: string; status: "IN_REVIEW" | "LIVE" | "REJECTED"; photoCount: number; submittedAt: string | null; reviewedAt: string | null; publishedAt: string | null; rejectedAt: string | null; updatedAt: string };
  property: { id: string; referenceId: string; title: string; description: string | null; propertyCategory: string | null; propertyType: string | null; ownershipType: string | null; publicLocation: string | null; fullAddress: string | null; askingPrice: number; negotiable: boolean; condition: string | null; furnishing: string | null; bedrooms: number | null; bathrooms: number | null; toilets: number | null; parkingSpaces: number | null; numberOfFloors: number | null; parkingCapacity: number | null; amenities: string[]; images: AdminPropertyImage[] };
  seller: null | { id: string; fullName: string | null; email: string | null; phone: string | null; accountStatus: string | null; emailVerified: boolean };
  documents: Array<{ id: string; documentType: string; displayName: string; mimeType: string; sizeBytes: number; uploadedAt: string }>;
  mandate: null | { mandateType: string; sellerFullName: string | null; ownershipConfirmed: boolean; mandateAccepted: boolean; acceptedAt: string | null; agreementVersion: string | null; commissionPercentage: number | null; commissionAmount: number | null };
  rejectionFeedback: string | null;
  history: Array<{ id: string; previousStatus: string; newStatus: string; action: string; reason: string | null; reviewedByAdminId: string; createdAt: string }>;
};
