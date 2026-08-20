export type GettingStartedAs = "FIND_PROPERTY" | "LIST_PROPERTY";
export type PersonaType = "BUYER" | "SELLER_DEVELOPER";
export type OnboardingStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";
export type NextAction =
  | "VERIFY_EMAIL"
  | "COMPLETE_BUYER_ONBOARDING"
  | "COMPLETE_SELLER_ONBOARDING"
  | "OPEN_BUYER_DASHBOARD"
  | "OPEN_SELLER_DASHBOARD"
  | "ACTIVATE_BUYER_PERSONA"
  | "ACTIVATE_SELLER_PERSONA"
  | "VERIFY_PASSWORD_RESET_OTP"
  | "SET_NEW_PASSWORD"
  | "LOGIN";

export type ApiSuccess<T> = { success: true; message: string; data: T };
export type ApiError = {
  success: false;
  message: string;
  code?: string;
  attemptsRemaining?: number;
  retryAfter?: number;
  errors?: { formErrors?: string[]; fieldErrors?: Record<string, string[]> };
  missingSections?: string[];
  missingFields?: string[];
};

export type PersonaState = {
  type: PersonaType;
  onboardingStatus: OnboardingStatus;
  activated?: boolean;
  isActive?: boolean;
  nextAction?: NextAction;
};

export type CustomerIdentity = {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  accountStatus: "ACTIVE";
  emailVerified: true;
};

export type CustomerSessionState = {
  user: CustomerIdentity;
  activePersona: PersonaType;
  personas: PersonaState[];
  nextAction: NextAction;
};

export type RegisterRequest = {
  gettingStartedAs: GettingStartedAs;
  fullName: string;
  email: string;
  phone: string;
  isWhatsAppNumber: boolean;
  whatsAppNumber?: string | null;
  password: string;
  confirmPassword: string;
};

export type RegisterResult = {
  verificationRequired: true;
  maskedEmail: string;
  otpLength: 6;
  resendAvailableIn: number;
  nextAction: "VERIFY_EMAIL";
};

export type VerifyEmailResult = {
  accountStatus: "ACTIVE";
  emailVerified: true;
  activePersona: PersonaType;
  personas: PersonaType[];
  onboardingStatus: "NOT_STARTED";
  nextAction: NextAction;
};

export type LoginResult = CustomerSessionState & {
  accessTokenExpiresIn: number;
  refreshTokenExpiresIn: number;
};

export type ForgotPasswordResult = {
  otpLength: 6;
  resendAvailableIn: number;
  nextAction: "VERIFY_PASSWORD_RESET_OTP";
};

export type ResetOtpResult = {
  expiresIn: number;
  nextAction: "SET_NEW_PASSWORD";
};

export type SessionsInvalidatedResult = {
  sessionsInvalidated: true;
  nextAction: "LOGIN";
};

export type PersonaMutationResult = {
  activePersona: PersonaType;
  personas?: PersonaType[];
  onboardingStatus: OnboardingStatus;
  alreadyActivated?: boolean;
  alreadyActive?: boolean;
  nextAction: NextAction;
};

export type MarketplaceSort =
  | "DEFAULT"
  | "PRICE_HIGH_TO_LOW"
  | "PRICE_LOW_TO_HIGH"
  | "BEDS"
  | "MOST_RECENT";

export type MarketplacePropertyCategory = "RESIDENTIAL" | "COMMERCIAL";

export type MarketplaceCoverImage = {
  id: string;
  url: string;
};

export type MarketplacePropertyCard = {
  id: string;
  referenceId: string;
  title: string;
  askingPrice: number;
  negotiable: boolean;
  propertyType: string;
  propertyCategory: MarketplacePropertyCategory;
  publicLocation: string;
  bedrooms: number | null;
  bathrooms: number | null;
  toilets: number | null;
  parkingSpaces: number | null;
  coverImage: MarketplaceCoverImage | null;
  photoCount: number;
  verified: boolean;
  publishedAt: string | null;
  saved: boolean;
};

export type MarketplacePagination = {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
};

export type MarketplaceSearchResult = {
  properties: MarketplacePropertyCard[];
  pagination: MarketplacePagination;
};

export type MarketplaceSearchParams = {
  q?: string;
  location?: string;
  minPrice?: number;
  maxPrice?: number;
  propertyType?: string;
  category?: MarketplacePropertyCategory;
  condition?: string;
  furnishing?: string;
  bedrooms?: number | "5+";
  sort: MarketplaceSort;
  page: number;
  limit: number;
};

export type MarketplaceGalleryImage = {
  id: string;
  url: string;
  order: number;
  isCover: boolean;
};

export type MarketplaceInitialDeposit = {
  type: "AMOUNT" | "PERCENTAGE" | null;
  value: number | null;
};

export type MarketplacePropertyDetail = {
  id: string;
  referenceId: string;
  title: string;
  description: string;
  askingPrice: number;
  negotiable: boolean;
  propertyType: string;
  propertyCategory: MarketplacePropertyCategory;
  publicLocation: string;
  bedrooms: number | null;
  bathrooms: number | null;
  toilets: number | null;
  parkingSpaces: number | null;
  numberOfFloors: number | null;
  parkingCapacity: number | null;
  condition: string | null;
  furnishing: string | null;
  initialDeposit: MarketplaceInitialDeposit | null;
  amenities: string[];
  images: MarketplaceGalleryImage[];
  photoCount: number;
  verified: boolean;
  publishedAt: string | null;
  saved: boolean;
};

export type MarketplacePropertyDetailResult = { property: MarketplacePropertyDetail };

export type MarketplaceSavedPropertyMutation = {
  saved_property: { id: string; propertyId: string; savedAt: string };
};

export type MarketplaceSavedProperty = {
  id: string;
  propertyId: string;
  savedAt: string;
  property: MarketplacePropertyCard;
};

export type MarketplaceSavedPropertyListResult = {
  saved_properties: MarketplaceSavedProperty[];
  pagination: MarketplacePagination;
};

export type MarketplaceInterestContactMethod = "WHATSAPP" | "CALL" | "EMAIL";

export type MarketplaceInterestRequest = {
  preferredContactMethod: MarketplaceInterestContactMethod;
  message?: string;
};

export type MarketplaceInterestResult = {
  inquiryId: string;
  propertyId: string;
  referenceId: string;
  title: string;
  askingPrice: number;
  preferredContactMethod: MarketplaceInterestContactMethod;
  submittedAt: string;
  nextAction: "KEEP_BROWSING";
};

export type SellerListingStatus = "ALL" | "DRAFT" | "IN_REVIEW" | "LIVE" | "REJECTED";
export type SellerListingStep = "PROPERTY_INFORMATION" | "PHOTOS_DOCUMENTS" | "SALES_MANDATE" | "REVIEW";
export type SellerListingNextAction = "CONTINUE_PROPERTY_INFORMATION" | "CONTINUE_PHOTOS_DOCUMENTS" | "CONTINUE_SALES_MANDATE" | "CONTINUE_REVIEW" | "EDIT_REJECTED_LISTING" | "VIEW_REVIEW_STATUS" | "VIEW_LIVE_LISTING" | "VIEW_REJECTION";
export type SellerListingImage = { id: string; url: string; order: number; isCover: boolean };
export type SellerListingSummary = {
  id: string; referenceId: string; title: string | null; askingPrice: number | null; status: Exclude<SellerListingStatus, "ALL">;
  currentStep: SellerListingStep | null; coverImage: SellerListingImage | null; photoCount: number; updatedAt: string;
  submittedAt: string | null; reviewedAt: string | null; publishedAt: string | null; rejectedAt: string | null;
  rejectionReason: string | null; rejectionFeedback: string | null;
  reviewProgress: { submitted: boolean; reviewing: boolean; live: boolean } | null; nextAction: SellerListingNextAction;
};
export type SellerListingCounts = { all: number; draft: number; inReview: number; live: number; rejected: number };
export type SellerListingListResult = { counts: SellerListingCounts; items: SellerListingSummary[]; pagination: MarketplacePagination };
export type SellerListingManagement = {
  summary: SellerListingSummary;
  property: SellerListingSummary & { description: string | null; propertyCategory: string | null; propertyType: string | null; publicLocation: string | null; fullAddress: string | null; images: SellerListingImage[] };
  documents: { id: string; documentType: string; displayName: string; mimeType: string; sizeBytes: number; uploadedAt: string }[];
  mandate: { mandateType: string; sellerFullName: string; ownershipConfirmed: boolean; mandateAccepted: boolean; acceptedAt: string | null } | null;
  reviewHistory: { id: string; previousStatus: string; newStatus: string; action: string; reason: string | null; createdAt: string }[];
};
export type SellerListingManagementResult = { management: SellerListingManagement };
export type SellerDraft = { id: string; title?: string; description?: string; propertyCategory?: "RESIDENTIAL" | "COMMERCIAL"; propertyType?: string; ownershipType?: "PERSONAL" | "THIRD_PARTY"; publicLocation?: string; fullAddress?: string; askingPrice?: number; negotiable?: boolean; initialDepositType?: "AMOUNT" | "PERCENTAGE" | null; initialDepositValue?: number | null; condition?: string; furnishing?: string | null; bedrooms?: number | null; bathrooms?: number | null; toilets?: number | null; parkingSpaces?: number | null; numberOfFloors?: number | null; parkingCapacity?: number | null; amenities?: string[]; currentStep?: "PROPERTY_INFORMATION" | "PHOTOS_DOCUMENTS" | "SALES_MANDATE" | "REVIEW"; images: SellerListingImage[]; documents: { id: string; documentType: string; displayName: string; mimeType: string; sizeBytes: number; uploadedAt: string }[] };
export type SellerDraftResult = { property: SellerDraft };
export type SellerReopenResult = {
  propertyId: string;
  referenceId: string;
  status: "DRAFT";
  currentStep: "REVIEW";
  rejectionReason: string | null;
  rejectedAt: string | null;
  reviewedAt: string | null;
  nextAction: "EDIT_REJECTED_LISTING";
};
export type SellerSalesMandateInput = {
  mandateType: "EXCLUSIVE" | "OPEN";
  sellerFullName: string;
  ownershipConfirmed: boolean;
  mandateAccepted: boolean;
};
export type SellerSalesMandate = SellerSalesMandateInput & {
  acceptedAt: string | null;
  agreementVersion: string | null;
  commissionPercentage: number | null;
  commissionAmount: number | null;
};
export type SellerSalesMandateResult = { mandate: SellerSalesMandate | null };
export type SellerPropertyReview = {
  buyerPreview: {
    id: string;
    referenceId: string;
    title: string | null;
    description: string | null;
    propertyType: string | null;
    propertyCategory: string | null;
    publicLocation: string | null;
    askingPrice: number | null;
    negotiable: boolean;
    initialDeposit: { type: string | null; value: number | null } | null;
    condition: string | null;
    furnishing: string | null;
    bedrooms: number | null;
    bathrooms: number | null;
    toilets: number | null;
    parkingSpaces: number | null;
    numberOfFloors: number | null;
    parkingCapacity: number | null;
    amenities: string[];
    images: SellerListingImage[];
    coverImage: SellerListingImage | null;
    photoCount: number;
  };
  sellerPrivate: { fullAddress: string | null };
  mandate: SellerSalesMandate | null;
  currentStep: SellerListingStep | null;
  status: Exclude<SellerListingStatus, "ALL">;
  validation: { missingSections: string[]; missingFields: string[] };
};
export type SellerPropertyReviewResult = { review: SellerPropertyReview };
export type SellerSubmissionResult = {
  propertyId: string;
  referenceId: string;
  status: "IN_REVIEW";
  submittedAt: string;
  nextAction: "OPEN_MY_LISTINGS";
};
