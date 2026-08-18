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
  bedrooms?: number;
  sort: MarketplaceSort;
  page: number;
  limit: number;
};
