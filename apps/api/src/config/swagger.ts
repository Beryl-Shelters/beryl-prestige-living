import swaggerJSDoc from "swagger-jsdoc";
import { env } from "./env";

type HttpMethod = "get" | "post" | "patch" | "delete";
type Schema = Record<string, unknown>;

type Endpoint = {
  method: HttpMethod;
  path: string;
  tag: string;
  summary: string;
  description: string;
  successStatus?: number;
  successMessage: string;
  responseSchema?: string;
  security?: "required" | "optional" | "none";
  roles?: string[];
  pathParams?: Array<{ name: string; description: string }>;
  query?: Array<Record<string, unknown>>;
  bodySchema?: string;
  multipart?: {
    field: string;
    multiple?: boolean;
    schema?: string;
    description: string;
  };
  badRequestMessage?: string;
  forbiddenMessage?: string;
  notFoundMessage?: string;
  successExample?: Record<string, unknown>;
  errorResponses?: Record<
    string,
    {
      description: string;
      message: string;
      code?: string;
      examples?: Record<
        string,
        { summary: string; message: string; code?: string }
      >;
    }
  >;
};

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });

const paginationParameters = [
  {
    name: "page",
    in: "query",
    description: "One-based page number.",
    schema: { type: "integer", minimum: 1, default: 1 },
    example: 1
  },
  {
    name: "limit",
    in: "query",
    description: "Maximum records returned per page.",
    schema: { type: "integer", minimum: 1, default: 10 },
    example: 10
  }
];

const queryParameter = (
  name: string,
  description: string,
  schema: Record<string, unknown> = { type: "string" },
  example?: unknown
) => ({ name, in: "query", description, schema, ...(example === undefined ? {} : { example }) });

const objectSchema = (
  properties: Record<string, unknown>,
  required: string[] = []
): Schema => ({
  type: "object",
  properties,
  ...(required.length ? { required } : {}),
  additionalProperties: false
});

const uuid = { type: "string", format: "uuid" };
const dateTime = { type: "string", format: "date-time" };
const nullableString = { type: "string", nullable: true };

const components = {
  securitySchemes: {
    bearerAuth: {
      type: "http",
      scheme: "bearer",
      bearerFormat: "JWT",
      description: "Supabase JWT access token. Enter the token without the Bearer prefix."
    }
  },
  schemas: {
    ErrorResponse: objectSchema(
      {
        success: { type: "boolean", enum: [false], example: false },
        message: { type: "string", example: "Internal server error" },
        code: { type: "string", nullable: true, example: "INVALID_OTP" }
      },
      ["success", "message"]
    ),
    ValidationError: objectSchema(
      {
        success: { type: "boolean", enum: [false], example: false },
        message: { type: "string", enum: ["Validation failed"] },
        errors: {
          type: "object",
          properties: {
            formErrors: { type: "array", items: { type: "string" } },
            fieldErrors: {
              type: "object",
              additionalProperties: { type: "array", items: { type: "string" } }
            }
          }
        }
      },
      ["success", "message", "errors"]
    ),
    Pagination: objectSchema(
      {
        page: { type: "integer", example: 1 },
        limit: { type: "integer", example: 10 },
        total: { type: "integer", example: 25 },
        total_pages: { type: "integer", example: 3 }
      },
      ["page", "limit", "total", "total_pages"]
    ),
    AuthUser: {
      type: "object",
      description: "Supabase authentication user. Sensitive credential fields are omitted.",
      properties: {
        id: uuid,
        email: { type: "string", format: "email" },
        created_at: dateTime,
        updated_at: dateTime
      },
      required: ["id"],
      additionalProperties: true
    },
    UserProfile: {
      type: "object",
      properties: {
        id: uuid,
        first_name: { type: "string" },
        last_name: { type: "string" },
        email: { type: "string", format: "email" },
        phone_number: nullableString,
        role: {
          type: "string",
          enum: ["investor", "property_developer", "landlord", "registered_agent", "freelance_agent", "admin", "support_agent", "super_admin"]
        },
        profile_type: { type: "string", enum: ["personal", "business"] },
        avatar_url: { type: "string", format: "uri", nullable: true },
        bio: nullableString,
        street_address: nullableString,
        city: nullableString,
        state: nullableString,
        country: nullableString,
        zip_code: nullableString,
        agency_name: nullableString,
        company_email: { type: "string", format: "email", nullable: true },
        company_phone_number: nullableString,
        company_bio: nullableString,
        company_street_address: nullableString,
        company_city: nullableString,
        company_state: nullableString,
        company_country: nullableString,
        company_zip_code: nullableString,
        referral_code: nullableString,
        referred_by: { ...uuid, nullable: true },
        verification_status: { type: "string", enum: ["pending", "verified", "rejected"] },
        is_active: { type: "boolean" },
        last_login_at: { ...dateTime, nullable: true },
        created_at: dateTime,
        updated_at: dateTime
      },
      required: ["id", "first_name", "last_name", "email", "role"],
      additionalProperties: true
    },
    AuthResponse: objectSchema({
      user: ref("AuthUser"),
      profile: ref("UserProfile"),
      access_token: { type: "string", description: "JWT access token." },
      refresh_token: { type: "string", description: "Supabase refresh token." },
      session: { type: "object", additionalProperties: true }
    }),
    Property: {
      type: "object",
      properties: {
        id: uuid,
        owner_id: uuid,
        property_code: { type: "string" },
        slug: { type: "string" },
        title: { type: "string" },
        description: { type: "string" },
        category: { type: "string" },
        property_type: { type: "string" },
        property_subtype: nullableString,
        listing_purpose: { type: "string" },
        price: { type: "number", minimum: 0 },
        minimum_down_payment: { type: "number", minimum: 0, nullable: true },
        agency_fee: { type: "number", minimum: 0, nullable: true },
        service_fee: { type: "number", minimum: 0, nullable: true },
        bedrooms: { type: "integer", minimum: 0, nullable: true },
        bathrooms: { type: "integer", minimum: 0, nullable: true },
        toilets: { type: "integer", minimum: 0, nullable: true },
        parking_spaces: { type: "integer", minimum: 0, nullable: true },
        number_of_units: { type: "integer", minimum: 0, nullable: true },
        land_area: { type: "number", minimum: 0, nullable: true },
        land_area_unit: nullableString,
        year_built: { type: "integer", nullable: true },
        country: nullableString,
        state: nullableString,
        city: nullableString,
        local_government: nullableString,
        address: nullableString,
        latitude: { type: "number", nullable: true },
        longitude: { type: "number", nullable: true },
        map_url: nullableString,
        has_lien: { type: "boolean", nullable: true },
        title_document_type: nullableString,
        amenities: { type: "array", items: { type: "string" } },
        thumbnail_url: { type: "string", format: "uri", nullable: true },
        status: { type: "string" },
        is_published: { type: "boolean" },
        views_count: { type: "integer", minimum: 0 },
        shares_count: { type: "integer", minimum: 0 },
        saves_count: { type: "integer", minimum: 0 },
        rejection_reason: nullableString,
        approved_by: { ...uuid, nullable: true },
        approved_at: { ...dateTime, nullable: true },
        property_images: { type: "array", items: ref("PropertyImage") },
        owner: ref("UserProfile"),
        created_at: dateTime,
        updated_at: dateTime
      },
      required: ["id", "owner_id", "title", "description", "category", "property_type", "listing_purpose", "price"],
      additionalProperties: true
    },
    PropertyImage: {
      type: "object",
      properties: {
        id: uuid,
        property_id: uuid,
        image_url: { type: "string", format: "uri", description: "Cloudinary secure URL." },
        cloudinary_public_id: { type: "string", description: "Cloudinary public identifier." },
        alt_text: nullableString,
        is_cover: { type: "boolean" },
        sort_order: { type: "integer", minimum: 0 },
        created_at: dateTime
      },
      required: ["id", "property_id", "image_url"]
    },
    SavedProperty: {
      type: "object",
      properties: { id: uuid, user_id: uuid, property_id: uuid, property: ref("Property"), created_at: dateTime },
      required: ["id", "user_id", "property_id"]
    },
    Inquiry: {
      type: "object",
      properties: {
        id: uuid, property_id: { ...uuid, nullable: true }, user_id: { ...uuid, nullable: true }, inquiry_type: { type: "string" },
        full_name: { type: "string" }, email: { type: "string", format: "email" }, phone_number: { type: "string" },
        message: { type: "string" }, status: { type: "string", enum: ["pending", "contacted", "scheduled", "closed"] },
        assigned_to: { ...uuid, nullable: true }, created_at: dateTime, updated_at: dateTime
      },
      additionalProperties: true
    },
    SupportRequest: {
      type: "object",
      properties: { id: uuid, user_id: uuid, subject: { type: "string" }, priority: { type: "string", enum: ["low", "medium", "high", "urgent"] }, status: { type: "string", enum: ["open", "in_progress", "resolved", "closed"] }, assigned_to: { ...uuid, nullable: true }, created_at: dateTime, updated_at: dateTime },
      additionalProperties: true
    },
    SupportMessage: {
      type: "object",
      properties: { id: uuid, ticket_id: uuid, sender_id: uuid, message: { type: "string" }, attachment_url: { type: "string", format: "uri", nullable: true }, created_at: dateTime },
      additionalProperties: true
    },
    ListingRequest: {
      type: "object",
      properties: { id: uuid, property_id: uuid, listed_by: uuid, title: { type: "string" }, description: { type: "string" }, status: { type: "string", enum: ["pending", "active", "rejected", "expired", "sold", "archived"] }, expires_at: { ...dateTime, nullable: true }, property: ref("Property"), created_at: dateTime, updated_at: dateTime },
      additionalProperties: true
    },
    Report: {
      type: "object",
      properties: { id: uuid, reported_by: uuid, property_id: { ...uuid, nullable: true }, agent_id: { ...uuid, nullable: true }, report_type: { type: "string" }, reason: { type: "string" }, status: { type: "string", enum: ["pending", "under_review", "resolved", "rejected"] }, resolution_note: nullableString, reviewed_by: { ...uuid, nullable: true }, created_at: dateTime, updated_at: dateTime },
      additionalProperties: true
    },
    Mandate: {
      type: "object",
      properties: { id: uuid, user_id: uuid, property_id: { ...uuid, nullable: true }, mandate_type: { type: "string", enum: ["buyer", "seller"] }, full_name: { type: "string" }, email: { type: "string", format: "email" }, phone_number: { type: "string" }, address: { type: "string" }, nationality: nullableString, date_of_birth: nullableString, title_document: nullableString, document_url: { type: "string", format: "uri", nullable: true }, signature_data: nullableString, terms_accepted: { type: "boolean" }, status: { type: "string", enum: ["pending", "under_review", "approved", "rejected"] }, rejection_reason: nullableString, created_at: dateTime, updated_at: dateTime },
      additionalProperties: true
    },
    Transaction: {
      type: "object",
      properties: { id: uuid, property_id: uuid, buyer_id: uuid, seller_id: { ...uuid, nullable: true }, agent_id: { ...uuid, nullable: true }, referral_id: { ...uuid, nullable: true }, amount: { type: "number" }, commission_amount: { type: "number", nullable: true }, referral_commission_amount: { type: "number", nullable: true }, payment_reference: nullableString, payment_method: nullableString, status: { type: "string", enum: ["pending", "paid", "failed", "cancelled", "refunded", "closed"] }, metadata: { type: "object", additionalProperties: true }, created_at: dateTime, updated_at: dateTime },
      additionalProperties: true
    },
    Notification: {
      type: "object",
      properties: { id: uuid, user_id: uuid, type: { type: "string" }, title: { type: "string" }, message: { type: "string" }, metadata: { type: "object", additionalProperties: true }, is_read: { type: "boolean" }, read_at: { ...dateTime, nullable: true }, created_at: dateTime },
      additionalProperties: true
    },
    Referral: {
      type: "object",
      properties: { id: uuid, referrer_id: uuid, registered_user_id: { ...uuid, nullable: true }, property_id: { ...uuid, nullable: true }, referral_code: { type: "string" }, referral_type: { type: "string", enum: ["buyer", "seller"] }, referred_name: nullableString, referred_email: { type: "string", format: "email", nullable: true }, referred_phone: nullableString, notes: nullableString, status: { type: "string", enum: ["pending", "qualified", "converted", "rejected"] }, earned_commission: { type: "number", minimum: 0 }, created_at: dateTime, updated_at: dateTime },
      additionalProperties: true
    },
    Admin: { allOf: [ref("UserProfile")], description: "Profile with an admin or support role." },
    DashboardSummary: { type: "object", additionalProperties: true, description: "Dashboard counters and recent activity computed by the dashboard service." },
    AnalyticsOverview: { type: "object", additionalProperties: true, description: "Property view, share, save, and publication analytics." },
    AuditLog: { type: "object", properties: { id: uuid, actor_id: uuid, action: { type: "string" }, metadata: { type: "object", additionalProperties: true }, created_at: dateTime }, additionalProperties: true },
    StandardSuccessResponse: objectSchema({ success: { type: "boolean", enum: [true] }, message: { type: "string" }, data: { type: "object", additionalProperties: true } }, ["success", "message"]),

    RegisterRequest: objectSchema({ fullName: { type: "string", minLength: 2, example: "Test Customer" }, email: { type: "string", format: "email", description: "Trimmed and normalized to lowercase.", example: "customer@example.com" }, phone: { type: "string", pattern: "^\\+[1-9]\\d{7,14}$", description: "Normalized to E.164. Nigerian local numbers default to +234.", example: "+2348012345678" }, isWhatsAppNumber: { type: "boolean", description: "True when phone is also the WhatsApp number." }, whatsAppNumber: { type: "string", nullable: true, pattern: "^\\+[1-9]\\d{7,14}$", description: "Required only when isWhatsAppNumber is false; otherwise null is accepted." }, gettingStartedAs: { type: "string", enum: ["FIND_PROPERTY", "LIST_PROPERTY"] }, password: { type: "string", format: "password", minLength: 8, pattern: "^(?=.*[A-Za-z])(?=.*\\d).{8,}$", writeOnly: true, description: "At least eight characters, one letter, and one number." }, confirmPassword: { type: "string", format: "password", writeOnly: true, description: "Must match password and is never persisted." } }, ["fullName", "email", "phone", "isWhatsAppNumber", "gettingStartedAs", "password", "confirmPassword"]),
    VerifyCustomerEmailRequest: objectSchema({ email: { type: "string", format: "email", description: "Trimmed and normalized to lowercase." }, otp: { type: "string", pattern: "^\\d{6}$", writeOnly: true, description: "The six-digit registration email verification code." } }, ["email", "otp"]),
    ResendCustomerVerificationRequest: objectSchema({ email: { type: "string", format: "email", description: "Trimmed and normalized to lowercase." } }, ["email"]),
    CustomerRegistrationResult: objectSchema({ accountId: uuid, accountStatus: { type: "string", enum: ["PENDING_VERIFICATION"] }, emailVerified: { type: "boolean", enum: [false] }, nextAction: { type: "string", enum: ["VERIFY_EMAIL"] } }, ["accountId", "accountStatus", "emailVerified", "nextAction"]),
    CustomerEmailVerificationResult: objectSchema({ accountStatus: { type: "string", enum: ["ACTIVE"] }, emailVerified: { type: "boolean", enum: [true] }, activePersona: { type: "string", enum: ["BUYER", "SELLER_DEVELOPER"] }, personas: { type: "array", items: { type: "string", enum: ["BUYER", "SELLER_DEVELOPER"] } }, onboardingStatus: { type: "string", enum: ["NOT_STARTED"] }, nextAction: { type: "string", enum: ["COMPLETE_BUYER_ONBOARDING", "COMPLETE_SELLER_ONBOARDING"] } }, ["accountStatus", "emailVerified", "activePersona", "personas", "onboardingStatus", "nextAction"]),
    LoginRequest: objectSchema({ email: { type: "string", format: "email", example: "ada@example.com" }, password: { type: "string", format: "password", minLength: 1, writeOnly: true, example: "Str0ngPass!" } }, ["email", "password"]),
    UpdateProfileRequest: objectSchema({ first_name: { type: "string", minLength: 2 }, last_name: { type: "string", minLength: 2 }, phone_number: { type: "string", minLength: 7 }, bio: { type: "string", maxLength: 1000 }, street_address: { type: "string" }, city: { type: "string" }, state: { type: "string" }, country: { type: "string" }, zip_code: { type: "string" }, agency_name: { type: "string" }, company_email: { type: "string", format: "email" }, company_phone_number: { type: "string" }, company_bio: { type: "string", maxLength: 1500 }, company_street_address: { type: "string" }, company_city: { type: "string" }, company_state: { type: "string" }, company_country: { type: "string" }, company_zip_code: { type: "string" } }),
    ChangePasswordRequest: objectSchema({ new_password: { type: "string", format: "password", minLength: 8, writeOnly: true, example: "N3wStr0ngPass!" } }, ["new_password"]),
    PropertyInput: objectSchema({ title: { type: "string", minLength: 3 }, description: { type: "string", minLength: 10 }, category: { type: "string" }, property_type: { type: "string" }, property_subtype: { type: "string" }, listing_purpose: { type: "string" }, price: { type: "number", minimum: 0 }, minimum_down_payment: { type: "number", minimum: 0 }, agency_fee: { type: "number", minimum: 0 }, service_fee: { type: "number", minimum: 0 }, bedrooms: { type: "integer", minimum: 0 }, bathrooms: { type: "integer", minimum: 0 }, toilets: { type: "integer", minimum: 0 }, parking_spaces: { type: "integer", minimum: 0 }, number_of_units: { type: "integer", minimum: 0 }, land_area: { type: "number", minimum: 0 }, land_area_unit: { type: "string" }, year_built: { type: "integer" }, country: { type: "string" }, state: { type: "string" }, city: { type: "string" }, local_government: { type: "string" }, address: { type: "string" }, latitude: { type: "number" }, longitude: { type: "number" }, map_url: { type: "string" }, has_lien: { type: "boolean" }, title_document_type: { type: "string" }, amenities: { type: "array", items: { type: "string" } }, thumbnail_url: { type: "string" } }),
    CreatePropertyInput: { allOf: [ref("PropertyInput")], required: ["title", "description", "category", "property_type", "listing_purpose", "price"] },
    UpdatePropertyInput: { allOf: [ref("PropertyInput")], description: "All property fields are optional for updates." },
    CreateInquiryRequest: objectSchema({ property_id: uuid, inquiry_type: { type: "string", minLength: 2 }, full_name: { type: "string", minLength: 2 }, email: { type: "string", format: "email" }, phone_number: { type: "string", minLength: 7 }, message: { type: "string", minLength: 5 } }, ["inquiry_type", "full_name", "email", "phone_number", "message"]),
    UpdateInquiryStatusRequest: objectSchema({ status: { type: "string", enum: ["pending", "contacted", "scheduled", "closed"] }, assigned_to: uuid }, ["status"]),
    CreateSupportTicketRequest: objectSchema({ subject: { type: "string", minLength: 3, maxLength: 200 }, message: { type: "string", minLength: 5 }, priority: { type: "string", enum: ["low", "medium", "high", "urgent"] } }, ["subject", "message"]),
    CreateTicketMessageRequest: objectSchema({ message: { type: "string", minLength: 1 }, attachment_url: { type: "string", format: "uri" } }, ["message"]),
    UpdateTicketStatusRequest: objectSchema({ status: { type: "string", enum: ["open", "in_progress", "resolved", "closed"] } }, ["status"]),
    AssignTicketRequest: objectSchema({ assigned_to: uuid }, ["assigned_to"]),
    CreateListingRequest: objectSchema({ property_id: uuid, title: { type: "string", minLength: 3, maxLength: 200 }, description: { type: "string", minLength: 10 }, expires_at: dateTime }, ["property_id", "title", "description"]),
    UpdateListingRequest: objectSchema({ title: { type: "string", minLength: 3, maxLength: 200 }, description: { type: "string", minLength: 10 }, expires_at: dateTime }),
    UpdateListingStatusRequest: objectSchema({ status: { type: "string", enum: ["pending", "active", "rejected", "expired", "sold", "archived"] } }, ["status"]),
    CreateReportRequest: objectSchema({ property_id: uuid, agent_id: uuid, report_type: { type: "string", minLength: 1 }, reason: { type: "string", minLength: 5 } }, ["report_type", "reason"]),
    ReviewReportRequest: objectSchema({ status: { type: "string", enum: ["pending", "under_review", "resolved", "rejected"] }, resolution_note: { type: "string" } }, ["status"]),
    ReviewMandateRequest: objectSchema({ status: { type: "string", enum: ["pending", "under_review", "approved", "rejected"] }, rejection_reason: { type: "string" } }, ["status"]),
    CreateTransactionRequest: objectSchema({ property_id: uuid, buyer_id: uuid, seller_id: uuid, agent_id: uuid, referral_id: uuid, amount: { type: "number", exclusiveMinimum: 0 }, commission_amount: { type: "number", minimum: 0 }, referral_commission_amount: { type: "number", minimum: 0 }, payment_reference: { type: "string" }, payment_method: { type: "string" }, metadata: { type: "object", additionalProperties: true } }, ["property_id", "buyer_id", "amount"]),
    UpdateTransactionStatusRequest: objectSchema({ status: { type: "string", enum: ["pending", "paid", "failed", "cancelled", "refunded", "closed"] }, payment_reference: { type: "string" }, payment_method: { type: "string" }, commission_amount: { type: "number", minimum: 0 }, referral_commission_amount: { type: "number", minimum: 0 }, metadata: { type: "object", additionalProperties: true } }, ["status"]),
    CreateNotificationRequest: objectSchema({ user_id: uuid, type: { type: "string", minLength: 1 }, title: { type: "string", minLength: 1 }, message: { type: "string", minLength: 1 }, metadata: { type: "object", additionalProperties: true } }, ["user_id", "type", "title", "message"]),
    TrackReferralRequest: objectSchema({ referral_code: { type: "string", minLength: 3 }, property_id: uuid, referral_type: { type: "string", enum: ["buyer", "seller"] }, referred_name: { type: "string" }, referred_email: { type: "string", format: "email" }, referred_phone: { type: "string" }, notes: { type: "string" } }, ["referral_code", "referral_type"]),
    UpdateReferralStatusRequest: objectSchema({ status: { type: "string", enum: ["pending", "qualified", "converted", "rejected"] }, earned_commission: { type: "number", minimum: 0 } }, ["status"]),
    UpdateUserStatusRequest: objectSchema({ is_active: { type: "boolean" } }, ["is_active"]),
    VerifyUserRequest: objectSchema({ verification_status: { type: "string", enum: ["pending", "verified", "rejected"] } }, ["verification_status"]),
    RejectPropertyRequest: objectSchema({ rejection_reason: { type: "string", minLength: 3 } }, ["rejection_reason"]),
    CreateAdminUserRequest: objectSchema({ first_name: { type: "string", minLength: 2 }, last_name: { type: "string", minLength: 2 }, email: { type: "string", format: "email" }, phone_number: { type: "string" }, password: { type: "string", format: "password", minLength: 8, writeOnly: true }, role: { type: "string", enum: ["admin", "support_agent"] } }, ["first_name", "last_name", "email", "password", "role"]),
    UpdateUserRoleRequest: objectSchema({ role: { type: "string", enum: ["investor", "property_developer", "landlord", "registered_agent", "freelance_agent", "admin", "support_agent"] } }, ["role"])
  }
};

const endpoints: Endpoint[] = [
  { method: "get", path: "/health", tag: "Health", summary: "Check API health", description: "Returns API availability and the current server timestamp.", successMessage: "Beryl Prestige Living API is healthy", responseSchema: "StandardSuccessResponse" },

  { method: "post", path: "/auth/register", tag: "Authentication", summary: "Register a customer", description: "Creates one pending customer account without a legacy role. Email is lowercased, phones are normalized to E.164 with +234 as the default country code, and the account remains inactive until email OTP verification. whatsAppNumber is required only when isWhatsAppNumber is false. Password and OTP values are never returned.", successStatus: 201, successMessage: "Registration successful. Please verify your email.", responseSchema: "CustomerRegistrationResult", bodySchema: "RegisterRequest", successExample: { accountId: "550e8400-e29b-41d4-a716-446655440000", accountStatus: "PENDING_VERIFICATION", emailVerified: false, nextAction: "VERIFY_EMAIL" }, errorResponses: { "409": { description: "Normalized email or phone already belongs to an account", message: "An account with these details already exists. Please log in or reset your password.", code: "ACCOUNT_ALREADY_EXISTS" }, "503": { description: "Registration, configuration, or mail delivery is unavailable", message: "Unable to complete registration", code: "REGISTRATION_UNAVAILABLE", examples: { unavailable: { summary: "Registration infrastructure unavailable", message: "Unable to complete registration", code: "REGISTRATION_UNAVAILABLE" }, notConfigured: { summary: "OTP verification is not configured", message: "Customer verification is temporarily unavailable", code: "CUSTOMER_AUTH_NOT_CONFIGURED" } } } } },
  { method: "post", path: "/auth/verify-email", tag: "Authentication", summary: "Verify customer registration email", description: "Validates the active registration OTP. The code expires, permits at most three attempts, and cannot be consumed or superseded twice. Success atomically confirms the managed Auth email, activates the account, creates the initial persona with NOT_STARTED onboarding, and upserts the single Admin Portal customer record.", successMessage: "Email verified successfully", responseSchema: "CustomerEmailVerificationResult", bodySchema: "VerifyCustomerEmailRequest", successExample: { accountStatus: "ACTIVE", emailVerified: true, activePersona: "BUYER", personas: ["BUYER"], onboardingStatus: "NOT_STARTED", nextAction: "COMPLETE_BUYER_ONBOARDING" }, errorResponses: { "400": { description: "OTP is invalid, expired, or superseded", message: "Invalid verification code", code: "INVALID_OTP", examples: { invalid: { summary: "Invalid OTP", message: "Invalid verification code", code: "INVALID_OTP" }, expired: { summary: "Expired OTP", message: "Verification code has expired", code: "OTP_EXPIRED" }, superseded: { summary: "Superseded OTP", message: "Verification code is no longer valid", code: "OTP_SUPERSEDED" } } }, "409": { description: "OTP was already consumed", message: "Verification code has already been used", code: "OTP_CONSUMED" }, "429": { description: "Maximum OTP attempts or endpoint rate limit exceeded", message: "Maximum verification attempts exceeded", code: "OTP_MAX_ATTEMPTS", examples: { attempts: { summary: "Maximum OTP attempts reached", message: "Maximum verification attempts exceeded", code: "OTP_MAX_ATTEMPTS" }, rateLimit: { summary: "Endpoint rate limit reached", message: "Too many requests, please try again later", code: "RATE_LIMIT_EXCEEDED" } } }, "503": { description: "Verification infrastructure or OTP configuration is unavailable", message: "Unable to verify email", code: "VERIFICATION_UNAVAILABLE", examples: { unavailable: { summary: "Verification infrastructure unavailable", message: "Unable to verify email", code: "VERIFICATION_UNAVAILABLE" }, notConfigured: { summary: "OTP verification is not configured", message: "Customer verification is temporarily unavailable", code: "CUSTOMER_AUTH_NOT_CONFIGURED" } } } } },
  { method: "post", path: "/auth/resend-verification-otp", tag: "Authentication", summary: "Resend customer registration OTP", description: "For an eligible unverified account, invalidates the previous live OTP and sends a replacement after the cooldown. Missing, verified, and cooldown states intentionally receive the same generic 202 response to prevent account enumeration; during cooldown no new OTP is created or sent.", successStatus: 202, successMessage: "If verification is available for this email, a new code will be sent.", bodySchema: "ResendCustomerVerificationRequest", errorResponses: { "429": { description: "Endpoint rate limit exceeded. Domain resend cooldown returns the generic 202 response.", message: "Too many requests, please try again later", code: "RATE_LIMIT_EXCEEDED" }, "503": { description: "Mail delivery, verification infrastructure, or OTP configuration is unavailable", message: "Unable to process verification request", code: "VERIFICATION_UNAVAILABLE", examples: { mailDelivery: { summary: "Mail delivery failed", message: "Unable to send verification email", code: "MAIL_DELIVERY_FAILED" }, unavailable: { summary: "Verification infrastructure unavailable", message: "Unable to process verification request", code: "VERIFICATION_UNAVAILABLE" }, notConfigured: { summary: "OTP verification is not configured", message: "Customer verification is temporarily unavailable", code: "CUSTOMER_AUTH_NOT_CONFIGURED" } } } } },
  { method: "post", path: "/auth/login", tag: "Authentication", summary: "Log in", description: "Authenticates email and password and returns Supabase session tokens and the profile.", successMessage: "Login successful", responseSchema: "AuthResponse", bodySchema: "LoginRequest", badRequestMessage: "Invalid login credentials" },
  { method: "post", path: "/auth/logout", tag: "Authentication", summary: "Log out", description: "Acknowledges logout for the authenticated user. Token invalidation remains client/Supabase managed.", successMessage: "Logout successful", security: "required" },
  { method: "get", path: "/auth/me", tag: "Authentication", summary: "Get current user", description: "Returns the authenticated Supabase user and profile.", successMessage: "Current user fetched successfully", responseSchema: "UserProfile", security: "required", notFoundMessage: "Profile not found" },

  { method: "get", path: "/profiles/me", tag: "Profile", summary: "Get my profile", description: "Returns the authenticated user's profile.", successMessage: "Profile fetched successfully", responseSchema: "UserProfile", security: "required", notFoundMessage: "Profile not found" },
  { method: "patch", path: "/profiles/me", tag: "Profile", summary: "Update my profile", description: "Updates the editable profile fields. Email, role, referral, verification, activity, and timestamp fields are blocked.", successMessage: "Profile updated successfully", responseSchema: "UserProfile", security: "required", bodySchema: "UpdateProfileRequest", badRequestMessage: "Profile update failed" },
  { method: "patch", path: "/profiles/me/password", tag: "Profile", summary: "Change my password", description: "Changes the authenticated user's Supabase password.", successMessage: "Password changed successfully", security: "required", bodySchema: "ChangePasswordRequest" },
  { method: "patch", path: "/profiles/me/avatar", tag: "Profile", summary: "Upload profile avatar", description: "Uploads one JPG, PNG, or WEBP image to Cloudinary. Maximum file size: 5 MB.", successMessage: "Avatar updated successfully", responseSchema: "UserProfile", security: "required", multipart: { field: "avatar", description: "Required avatar image (image/jpeg, image/png, or image/webp; max 5 MB)." }, badRequestMessage: "Avatar image is required" },

  { method: "get", path: "/properties", tag: "Properties", summary: "List properties", description: "Lists published properties by default. Supplying status switches to that exact status.", successMessage: "Properties fetched successfully", responseSchema: "Property", query: [...paginationParameters, queryParameter("search", "Search title, description, or property code."), queryParameter("city", "Case-insensitive city filter."), queryParameter("state", "Case-insensitive state filter."), queryParameter("country", "Case-insensitive country filter."), queryParameter("property_type", "Exact property type filter."), queryParameter("listing_purpose", "Exact listing purpose filter."), queryParameter("status", "Exact status filter; bypasses the default published-only condition."), queryParameter("min_price", "Minimum price.", { type: "number", minimum: 0 }), queryParameter("max_price", "Maximum price.", { type: "number", minimum: 0 }), queryParameter("sort", "Sort order.", { type: "string", enum: ["price_asc", "price_desc"] })] },
  { method: "post", path: "/properties", tag: "Properties", summary: "Create a property", description: "Creates a pending, unpublished property. Allowed roles: property_developer, landlord, registered_agent, freelance_agent, admin, super_admin.", successStatus: 201, successMessage: "Property created successfully", responseSchema: "Property", security: "required", roles: ["property_developer", "landlord", "registered_agent", "freelance_agent", "admin", "super_admin"], bodySchema: "CreatePropertyInput" },
  { method: "get", path: "/properties/{id}", tag: "Properties", summary: "Get a property", description: "Returns a property with images and owner details.", successMessage: "Property fetched successfully", responseSchema: "Property", pathParams: [{ name: "id", description: "Property UUID." }], notFoundMessage: "Property not found" },
  { method: "patch", path: "/properties/{id}", tag: "Properties", summary: "Update a property", description: "Updates a property when the authenticated user is its owner or an admin.", successMessage: "Property updated successfully", responseSchema: "Property", security: "required", pathParams: [{ name: "id", description: "Property UUID." }], bodySchema: "UpdatePropertyInput", forbiddenMessage: "You are not allowed to update this property", notFoundMessage: "Property not found" },
  { method: "delete", path: "/properties/{id}", tag: "Properties", summary: "Archive a property", description: "Soft-deletes a property by setting status to archived and is_published to false. Owner or admin only.", successMessage: "Property archived successfully", responseSchema: "Property", security: "required", pathParams: [{ name: "id", description: "Property UUID." }], forbiddenMessage: "You are not allowed to delete this property", notFoundMessage: "Property not found" },
  { method: "post", path: "/properties/{id}/images", tag: "Property Images", summary: "Upload property images", description: "Uploads 1–10 JPG, PNG, or WEBP images to Cloudinary. Each file is limited to 5 MB. Property owner or admin only.", successStatus: 201, successMessage: "Property images uploaded successfully", responseSchema: "PropertyImage", security: "required", pathParams: [{ name: "id", description: "Property UUID." }], multipart: { field: "images", multiple: true, description: "Required image files (1–10; image/jpeg, image/png, or image/webp; max 5 MB each)." }, badRequestMessage: "At least one property image is required", forbiddenMessage: "You are not allowed to manage this property", notFoundMessage: "Property not found" },
  { method: "delete", path: "/properties/images/{imageId}", tag: "Property Images", summary: "Delete a property image", description: "Deletes the Cloudinary asset and database row. Property owner or admin only.", successMessage: "Property image deleted successfully", security: "required", pathParams: [{ name: "imageId", description: "Property image UUID." }], forbiddenMessage: "You are not allowed to manage this property", notFoundMessage: "Property image not found" },
  { method: "get", path: "/properties/saved/me", tag: "Saved Properties", summary: "List my saved properties", description: "Returns the authenticated user's saved properties with property images.", successMessage: "Saved properties fetched successfully", responseSchema: "SavedProperty", security: "required", query: paginationParameters },
  { method: "post", path: "/properties/{id}/save", tag: "Saved Properties", summary: "Save a property", description: "Adds a property to the authenticated user's saved properties.", successStatus: 201, successMessage: "Property saved successfully", responseSchema: "SavedProperty", security: "required", pathParams: [{ name: "id", description: "Property UUID." }], badRequestMessage: "Property already saved", notFoundMessage: "Property not found" },
  { method: "delete", path: "/properties/{id}/save", tag: "Saved Properties", summary: "Unsave a property", description: "Removes a property from the authenticated user's saved properties.", successMessage: "Property removed from saved properties successfully", security: "required", pathParams: [{ name: "id", description: "Property UUID." }], notFoundMessage: "Property is not saved" },

  { method: "post", path: "/analytics/properties/{id}/view", tag: "Analytics", summary: "Track a property view", description: "Tracks a view. A bearer token is optional and, when valid, associates the view with the user.", successMessage: "View tracked successfully", responseSchema: "AnalyticsOverview", security: "optional", pathParams: [{ name: "id", description: "Property UUID." }], notFoundMessage: "Property not found" },
  { method: "post", path: "/analytics/properties/{id}/share", tag: "Analytics", summary: "Track a property share", description: "Increments the property's share count.", successMessage: "Share tracked successfully", responseSchema: "AnalyticsOverview", pathParams: [{ name: "id", description: "Property UUID." }], notFoundMessage: "Property not found" },
  { method: "get", path: "/analytics/properties/{id}/stats", tag: "Analytics", summary: "Get property statistics", description: "Returns property statistics to the owner or an admin.", successMessage: "Property stats fetched successfully", responseSchema: "AnalyticsOverview", security: "required", pathParams: [{ name: "id", description: "Property UUID." }], forbiddenMessage: "You are not allowed to view this property analytics", notFoundMessage: "Property not found" },
  { method: "get", path: "/analytics/my-properties", tag: "Analytics", summary: "Get my property analytics", description: "Lists analytics counters for properties owned by the authenticated property professional or admin.", successMessage: "My property analytics fetched successfully", responseSchema: "AnalyticsOverview", security: "required", roles: ["property_developer", "landlord", "registered_agent", "freelance_agent", "admin", "super_admin"], query: paginationParameters },
  { method: "get", path: "/analytics/dashboard", tag: "Analytics", summary: "Get admin analytics dashboard", description: "Returns aggregate property analytics. Admin or Super Admin only.", successMessage: "Admin dashboard analytics fetched successfully", responseSchema: "AnalyticsOverview", security: "required", roles: ["admin", "super_admin"] },

  { method: "get", path: "/referrals/me", tag: "Referrals", summary: "Get referral dashboard", description: "Returns the user's referral code, link, and referral totals.", successMessage: "Referral dashboard fetched successfully", responseSchema: "AnalyticsOverview", security: "required", notFoundMessage: "Profile not found" },
  { method: "get", path: "/referrals/me/list", tag: "Referrals", summary: "List my referrals", description: "Returns paginated referrals created through the authenticated user's code.", successMessage: "Referral list fetched successfully", responseSchema: "Referral", security: "required", query: paginationParameters },
  { method: "post", path: "/referrals/property/{propertyId}/share-link", tag: "Referrals", summary: "Generate property referral link", description: "Generates a share URL using the user's referral code and the property ID.", successMessage: "Property referral link generated successfully", responseSchema: "AnalyticsOverview", security: "required", pathParams: [{ name: "propertyId", description: "Property UUID." }], notFoundMessage: "Property not found" },
  { method: "post", path: "/referrals/seller/share-link", tag: "Referrals", summary: "Generate seller referral link", description: "Generates a seller registration share URL using the user's referral code.", successMessage: "Seller referral link generated successfully", responseSchema: "AnalyticsOverview", security: "required", notFoundMessage: "Profile not found" },
  { method: "post", path: "/referrals/track", tag: "Referrals", summary: "Track a referral", description: "Creates a referral from a valid code. Authentication is optional and self-referral is rejected.", successStatus: 201, successMessage: "Referral tracked successfully", responseSchema: "Referral", security: "optional", bodySchema: "TrackReferralRequest", badRequestMessage: "Self-referral is not allowed", notFoundMessage: "Invalid referral code" },
  { method: "patch", path: "/referrals/{id}/status", tag: "Referrals", summary: "Update referral status", description: "Updates referral status and optional commission. Admin or Super Admin only.", successMessage: "Referral status updated successfully", responseSchema: "Referral", security: "required", roles: ["admin", "super_admin"], pathParams: [{ name: "id", description: "Referral UUID." }], bodySchema: "UpdateReferralStatusRequest", notFoundMessage: "Referral not found" },

  { method: "post", path: "/inquiries", tag: "Inquiries", summary: "Submit an inquiry", description: "Submits a property or general inquiry. A bearer token is optional and associates the inquiry with a user when valid.", successStatus: 201, successMessage: "Inquiry submitted successfully", responseSchema: "Inquiry", security: "optional", bodySchema: "CreateInquiryRequest", notFoundMessage: "Property not found" },
  { method: "get", path: "/inquiries/me", tag: "Inquiries", summary: "List my inquiries", description: "Returns the authenticated user's inquiries.", successMessage: "Inquiries fetched successfully", responseSchema: "Inquiry", security: "required", query: paginationParameters },
  { method: "get", path: "/inquiries/{id}", tag: "Inquiries", summary: "Get an inquiry", description: "Returns an inquiry to its owner or authorized staff.", successMessage: "Inquiry fetched successfully", responseSchema: "Inquiry", security: "required", pathParams: [{ name: "id", description: "Inquiry UUID." }], forbiddenMessage: "You are not allowed to view this inquiry", notFoundMessage: "Inquiry not found" },
  { method: "patch", path: "/inquiries/{id}/status", tag: "Inquiries", summary: "Update inquiry status", description: "Updates inquiry status and assignment. Admin, support agent, or Super Admin only.", successMessage: "Inquiry status updated successfully", responseSchema: "Inquiry", security: "required", roles: ["admin", "support_agent", "super_admin"], pathParams: [{ name: "id", description: "Inquiry UUID." }], bodySchema: "UpdateInquiryStatusRequest", notFoundMessage: "Inquiry not found" },

  { method: "post", path: "/support/tickets", tag: "Support", summary: "Create a support ticket", description: "Creates a support ticket for the authenticated user.", successStatus: 201, successMessage: "Support ticket created successfully", responseSchema: "SupportRequest", security: "required", bodySchema: "CreateSupportTicketRequest", notFoundMessage: "Profile not found" },
  { method: "get", path: "/support/tickets/me", tag: "Support", summary: "List my support tickets", description: "Returns the authenticated user's support tickets.", successMessage: "Support tickets fetched successfully", responseSchema: "SupportRequest", security: "required", query: paginationParameters },
  { method: "get", path: "/support/admin/tickets", tag: "Support", summary: "List all support tickets", description: "Returns support tickets with optional filters. Admin, support agent, or Super Admin only.", successMessage: "All support tickets fetched successfully", responseSchema: "SupportRequest", security: "required", roles: ["admin", "support_agent", "super_admin"], query: [...paginationParameters, queryParameter("status", "Exact ticket status.", { type: "string", enum: ["open", "in_progress", "resolved", "closed"] }), queryParameter("priority", "Exact ticket priority.", { type: "string", enum: ["low", "medium", "high", "urgent"] }), queryParameter("assigned_to", "Assigned profile UUID.", uuid)] },
  { method: "get", path: "/support/tickets/{id}", tag: "Support", summary: "Get a support ticket", description: "Returns a ticket and its messages to its owner or authorized staff.", successMessage: "Support ticket fetched successfully", responseSchema: "SupportRequest", security: "required", pathParams: [{ name: "id", description: "Support ticket UUID." }], forbiddenMessage: "You are not allowed to view this support ticket", notFoundMessage: "Support ticket not found" },
  { method: "post", path: "/support/tickets/{id}/messages", tag: "Support", summary: "Reply to a support ticket", description: "Adds a message to a ticket when the user owns it or is authorized staff.", successStatus: 201, successMessage: "Ticket message sent successfully", responseSchema: "SupportMessage", security: "required", pathParams: [{ name: "id", description: "Support ticket UUID." }], bodySchema: "CreateTicketMessageRequest", forbiddenMessage: "You are not allowed to reply to this ticket", notFoundMessage: "Support ticket not found" },
  { method: "patch", path: "/support/tickets/{id}/status", tag: "Support", summary: "Update ticket status", description: "Admin, support agent, or Super Admin only.", successMessage: "Support ticket status updated successfully", responseSchema: "SupportRequest", security: "required", roles: ["admin", "support_agent", "super_admin"], pathParams: [{ name: "id", description: "Support ticket UUID." }], bodySchema: "UpdateTicketStatusRequest", notFoundMessage: "Support ticket not found" },
  { method: "patch", path: "/support/tickets/{id}/assign", tag: "Support", summary: "Assign a support ticket", description: "Assigns a ticket to an admin or support agent. Admin or Super Admin only.", successMessage: "Support ticket assigned successfully", responseSchema: "SupportRequest", security: "required", roles: ["admin", "super_admin"], pathParams: [{ name: "id", description: "Support ticket UUID." }], bodySchema: "AssignTicketRequest", badRequestMessage: "Ticket can only be assigned to admin or support staff", notFoundMessage: "Support ticket not found" },

  { method: "get", path: "/listings", tag: "Listings", summary: "List listings", description: "Lists active listings by default, with optional exact status and text search.", successMessage: "Listings fetched successfully", responseSchema: "ListingRequest", query: [...paginationParameters, queryParameter("status", "Exact listing status."), queryParameter("search", "Search listing title or description.")] },
  { method: "get", path: "/listings/me", tag: "Listings", summary: "List my listings", description: "Returns listings created by the authenticated user.", successMessage: "My listings fetched successfully", responseSchema: "ListingRequest", security: "required", query: paginationParameters },
  { method: "post", path: "/listings", tag: "Listings", summary: "Create a listing", description: "Creates a pending listing for a property owned by the user or manageable by an admin.", successStatus: 201, successMessage: "Listing created successfully", responseSchema: "ListingRequest", security: "required", roles: ["property_developer", "landlord", "registered_agent", "freelance_agent", "admin", "super_admin"], bodySchema: "CreateListingRequest", forbiddenMessage: "You are not allowed to create listing for this property", notFoundMessage: "Property not found" },
  { method: "get", path: "/listings/{id}", tag: "Listings", summary: "Get a listing", description: "Returns a listing with property and listing-user details.", successMessage: "Listing fetched successfully", responseSchema: "ListingRequest", pathParams: [{ name: "id", description: "Listing UUID." }], notFoundMessage: "Listing not found" },
  { method: "patch", path: "/listings/{id}", tag: "Listings", summary: "Update a listing", description: "Updates editable listing fields for its creator or an admin. Status must use the status endpoint.", successMessage: "Listing updated successfully", responseSchema: "ListingRequest", security: "required", pathParams: [{ name: "id", description: "Listing UUID." }], bodySchema: "UpdateListingRequest", forbiddenMessage: "You are not allowed to update this listing", notFoundMessage: "Listing not found" },
  { method: "patch", path: "/listings/{id}/status", tag: "Listings", summary: "Update listing status", description: "Admin or Super Admin only.", successMessage: "Listing status updated successfully", responseSchema: "ListingRequest", security: "required", roles: ["admin", "super_admin"], pathParams: [{ name: "id", description: "Listing UUID." }], bodySchema: "UpdateListingStatusRequest", notFoundMessage: "Listing not found" },
  { method: "delete", path: "/listings/{id}", tag: "Listings", summary: "Archive a listing", description: "Soft-deletes a listing by setting its status to archived. Creator or admin only.", successMessage: "Listing archived successfully", responseSchema: "ListingRequest", security: "required", pathParams: [{ name: "id", description: "Listing UUID." }], forbiddenMessage: "You are not allowed to delete this listing", notFoundMessage: "Listing not found" },

  { method: "post", path: "/reports", tag: "Reports", summary: "Submit a report", description: "Submits a property or agent report. Supply at least one of property_id or agent_id.", successStatus: 201, successMessage: "Report submitted successfully", responseSchema: "Report", security: "required", bodySchema: "CreateReportRequest", notFoundMessage: "Property not found" },
  { method: "get", path: "/reports/me", tag: "Reports", summary: "List my reports", description: "Returns reports submitted by the authenticated user.", successMessage: "Reports fetched successfully", responseSchema: "Report", security: "required", query: paginationParameters },
  { method: "get", path: "/reports/admin", tag: "Reports", summary: "List reports for review", description: "Admin, support agent, or Super Admin only. Supports exact status and report type filters.", successMessage: "Admin reports fetched successfully", responseSchema: "Report", security: "required", roles: ["admin", "support_agent", "super_admin"], query: [...paginationParameters, queryParameter("status", "Exact report status."), queryParameter("report_type", "Exact report type.")] },
  { method: "get", path: "/reports/{id}", tag: "Reports", summary: "Get a report", description: "Returns a report to its submitter or authorized staff.", successMessage: "Report fetched successfully", responseSchema: "Report", security: "required", pathParams: [{ name: "id", description: "Report UUID." }], forbiddenMessage: "Forbidden", notFoundMessage: "Report not found" },
  { method: "patch", path: "/reports/{id}/review", tag: "Reports", summary: "Review a report", description: "Updates report status and an optional resolution note. Admin, support agent, or Super Admin only.", successMessage: "Report reviewed successfully", responseSchema: "Report", security: "required", roles: ["admin", "support_agent", "super_admin"], pathParams: [{ name: "id", description: "Report UUID." }], bodySchema: "ReviewReportRequest", notFoundMessage: "Report not found" },
  { method: "delete", path: "/reports/{id}", tag: "Reports", summary: "Delete a report", description: "Deletes a report when requested by its submitter or authorized staff.", successMessage: "Report deleted successfully", security: "required", pathParams: [{ name: "id", description: "Report UUID." }], forbiddenMessage: "Forbidden", notFoundMessage: "Report not found" },

  { method: "post", path: "/mandates", tag: "Mandates", summary: "Submit a mandate", description: "Submits mandate fields and an optional document image. The shared upload middleware accepts one JPG, PNG, or WEBP file up to 5 MB.", successStatus: 201, successMessage: "Mandate submitted successfully", responseSchema: "Mandate", security: "required", multipart: { field: "document", schema: "CreateMandateMultipart", description: "Optional mandate document image (image/jpeg, image/png, or image/webp; max 5 MB)." }, badRequestMessage: "Terms must be accepted", notFoundMessage: "Property not found" },
  { method: "get", path: "/mandates/me", tag: "Mandates", summary: "List my mandates", description: "Returns mandates submitted by the authenticated user.", successMessage: "Mandates fetched successfully", responseSchema: "Mandate", security: "required", query: paginationParameters },
  { method: "get", path: "/mandates/admin", tag: "Mandates", summary: "List mandates for review", description: "Admin, support agent, or Super Admin only.", successMessage: "Admin mandates fetched successfully", responseSchema: "Mandate", security: "required", roles: ["admin", "support_agent", "super_admin"], query: [...paginationParameters, queryParameter("status", "Exact mandate status."), queryParameter("mandate_type", "Exact mandate type.", { type: "string", enum: ["buyer", "seller"] })] },
  { method: "get", path: "/mandates/{id}", tag: "Mandates", summary: "Get a mandate", description: "Returns a mandate to its submitter or authorized staff.", successMessage: "Mandate fetched successfully", responseSchema: "Mandate", security: "required", pathParams: [{ name: "id", description: "Mandate UUID." }], forbiddenMessage: "You are not allowed to view this mandate", notFoundMessage: "Mandate not found" },
  { method: "patch", path: "/mandates/{id}/review", tag: "Mandates", summary: "Review a mandate", description: "Admin, support agent, or Super Admin only.", successMessage: "Mandate reviewed successfully", responseSchema: "Mandate", security: "required", roles: ["admin", "support_agent", "super_admin"], pathParams: [{ name: "id", description: "Mandate UUID." }], bodySchema: "ReviewMandateRequest", notFoundMessage: "Mandate not found" },
  { method: "delete", path: "/mandates/{id}", tag: "Mandates", summary: "Delete a mandate", description: "Deletes a pending mandate for its submitter, or permits authorized staff according to the service.", successMessage: "Mandate deleted successfully", security: "required", pathParams: [{ name: "id", description: "Mandate UUID." }], forbiddenMessage: "You are not allowed to delete this mandate", notFoundMessage: "Mandate not found" },

  { method: "post", path: "/transactions", tag: "Transactions", summary: "Create a transaction", description: "Creates a transaction after validating all referenced records. Admin or Super Admin only.", successStatus: 201, successMessage: "Transaction created successfully", responseSchema: "Transaction", security: "required", roles: ["admin", "super_admin"], bodySchema: "CreateTransactionRequest", forbiddenMessage: "Only admin users can create transactions", notFoundMessage: "Property not found" },
  { method: "get", path: "/transactions/me", tag: "Transactions", summary: "List my transactions", description: "Returns transactions where the authenticated user is buyer, seller, or agent.", successMessage: "Transactions fetched successfully", responseSchema: "Transaction", security: "required", query: paginationParameters },
  { method: "get", path: "/transactions/admin", tag: "Transactions", summary: "List all transactions", description: "Admin or Super Admin only. Supports exact status, property, and buyer filters.", successMessage: "Admin transactions fetched successfully", responseSchema: "Transaction", security: "required", roles: ["admin", "super_admin"], query: [...paginationParameters, queryParameter("status", "Exact transaction status."), queryParameter("property_id", "Property UUID.", uuid), queryParameter("buyer_id", "Buyer profile UUID.", uuid)] },
  { method: "get", path: "/transactions/{id}", tag: "Transactions", summary: "Get a transaction", description: "Returns a transaction to a participant or an admin.", successMessage: "Transaction fetched successfully", responseSchema: "Transaction", security: "required", pathParams: [{ name: "id", description: "Transaction UUID." }], forbiddenMessage: "You are not allowed to view this transaction", notFoundMessage: "Transaction not found" },
  { method: "patch", path: "/transactions/{id}/status", tag: "Transactions", summary: "Update transaction status", description: "Admin or Super Admin only.", successMessage: "Transaction status updated successfully", responseSchema: "Transaction", security: "required", roles: ["admin", "super_admin"], pathParams: [{ name: "id", description: "Transaction UUID." }], bodySchema: "UpdateTransactionStatusRequest", notFoundMessage: "Transaction not found" },

  { method: "get", path: "/notifications/me", tag: "Notifications", summary: "List my notifications", description: "Returns notifications for the authenticated user with optional read-state and type filters.", successMessage: "Notifications fetched successfully", responseSchema: "Notification", security: "required", query: [...paginationParameters, queryParameter("is_read", "Filter by read state.", { type: "boolean" }), queryParameter("type", "Exact notification type.")] },
  { method: "get", path: "/notifications/unread-count", tag: "Notifications", summary: "Get unread count", description: "Returns the number of unread notifications for the authenticated user.", successMessage: "Unread notification count fetched successfully", responseSchema: "AnalyticsOverview", security: "required" },
  { method: "patch", path: "/notifications/read-all", tag: "Notifications", summary: "Mark all notifications read", description: "Marks every notification for the authenticated user as read.", successMessage: "All notifications marked as read successfully", security: "required" },
  { method: "post", path: "/notifications/admin/send", tag: "Notifications", summary: "Send a notification", description: "Sends a notification to a profile. Admin or Super Admin only.", successStatus: 201, successMessage: "Notification sent successfully", responseSchema: "Notification", security: "required", roles: ["admin", "super_admin"], bodySchema: "CreateNotificationRequest", notFoundMessage: "User profile not found" },
  { method: "patch", path: "/notifications/{id}/read", tag: "Notifications", summary: "Mark a notification read", description: "Marks one notification as read when it belongs to the authenticated user.", successMessage: "Notification marked as read successfully", responseSchema: "Notification", security: "required", pathParams: [{ name: "id", description: "Notification UUID." }], forbiddenMessage: "You are not allowed to update this notification", notFoundMessage: "Notification not found" },
  { method: "delete", path: "/notifications/{id}", tag: "Notifications", summary: "Delete a notification", description: "Deletes one notification when it belongs to the authenticated user.", successMessage: "Notification deleted successfully", security: "required", pathParams: [{ name: "id", description: "Notification UUID." }], forbiddenMessage: "You are not allowed to delete this notification", notFoundMessage: "Notification not found" },

  { method: "get", path: "/admin/dashboard", tag: "Admin", summary: "Get admin dashboard", description: "Returns platform totals. Admin or Super Admin only.", successMessage: "Admin dashboard fetched successfully", responseSchema: "DashboardSummary", security: "required", roles: ["admin", "super_admin"] },
  { method: "get", path: "/admin/users", tag: "Admin", summary: "List users", description: "Admin or Super Admin only. Supports role, verification, and text search filters.", successMessage: "Users fetched successfully", responseSchema: "UserProfile", security: "required", roles: ["admin", "super_admin"], query: [...paginationParameters, queryParameter("role", "Exact role."), queryParameter("verification_status", "Exact verification status.", { type: "string", enum: ["pending", "verified", "rejected"] }), queryParameter("search", "Search first name, last name, email, or phone number.")] },
  { method: "get", path: "/admin/users/{id}", tag: "Admin", summary: "Get a user", description: "Returns a profile and related activity. Admin or Super Admin only.", successMessage: "User fetched successfully", responseSchema: "UserProfile", security: "required", roles: ["admin", "super_admin"], pathParams: [{ name: "id", description: "User profile UUID." }], notFoundMessage: "User profile not found" },
  { method: "patch", path: "/admin/users/{id}/status", tag: "Admin", summary: "Update user activity status", description: "Activates or deactivates a user profile. Admin or Super Admin only.", successMessage: "User account status updated successfully", responseSchema: "UserProfile", security: "required", roles: ["admin", "super_admin"], pathParams: [{ name: "id", description: "User profile UUID." }], bodySchema: "UpdateUserStatusRequest", notFoundMessage: "User profile not found" },
  { method: "patch", path: "/admin/users/{id}/verify", tag: "Admin", summary: "Update user verification", description: "Changes verification status. Admin or Super Admin only.", successMessage: "User verification status updated successfully", responseSchema: "UserProfile", security: "required", roles: ["admin", "super_admin"], pathParams: [{ name: "id", description: "User profile UUID." }], bodySchema: "VerifyUserRequest", notFoundMessage: "User profile not found" },
  { method: "get", path: "/admin/properties/pending", tag: "Admin", summary: "List pending properties", description: "Admin or Super Admin only.", successMessage: "Pending properties fetched successfully", responseSchema: "Property", security: "required", roles: ["admin", "super_admin"], query: paginationParameters },
  { method: "patch", path: "/admin/properties/{id}/approve", tag: "Admin", summary: "Approve a property", description: "Publishes a pending property and notifies its owner. Admin or Super Admin only.", successMessage: "Property approved successfully", responseSchema: "Property", security: "required", roles: ["admin", "super_admin"], pathParams: [{ name: "id", description: "Property UUID." }], notFoundMessage: "Property not found" },
  { method: "patch", path: "/admin/properties/{id}/reject", tag: "Admin", summary: "Reject a property", description: "Rejects a property with a reason and notifies its owner. Admin or Super Admin only.", successMessage: "Property rejected successfully", responseSchema: "Property", security: "required", roles: ["admin", "super_admin"], pathParams: [{ name: "id", description: "Property UUID." }], bodySchema: "RejectPropertyRequest", notFoundMessage: "Property not found" },
  { method: "get", path: "/admin/listings/pending", tag: "Admin", summary: "List pending listings", description: "Admin or Super Admin only.", successMessage: "Pending listings fetched successfully", responseSchema: "ListingRequest", security: "required", roles: ["admin", "super_admin"], query: paginationParameters },
  { method: "get", path: "/admin/reports/pending", tag: "Admin", summary: "List pending reports", description: "Admin or Super Admin only.", successMessage: "Pending reports fetched successfully", responseSchema: "Report", security: "required", roles: ["admin", "super_admin"], query: paginationParameters },
  { method: "get", path: "/admin/mandates/pending", tag: "Admin", summary: "List pending mandates", description: "Admin or Super Admin only.", successMessage: "Pending mandates fetched successfully", responseSchema: "Mandate", security: "required", roles: ["admin", "super_admin"], query: paginationParameters },

  { method: "post", path: "/admin/super-admin/users", tag: "Super Admin", summary: "Create an admin user", description: "Creates an admin or support-agent auth user and profile. Super Admin only.", successStatus: 201, successMessage: "Admin user created successfully", responseSchema: "Admin", security: "required", roles: ["super_admin"], bodySchema: "CreateAdminUserRequest" },
  { method: "patch", path: "/admin/super-admin/users/{id}/role", tag: "Super Admin", summary: "Update a user role", description: "Changes a user's role; super_admin cannot be assigned through this API. Super Admin only.", successMessage: "User role updated successfully", responseSchema: "UserProfile", security: "required", roles: ["super_admin"], pathParams: [{ name: "id", description: "User profile UUID." }], bodySchema: "UpdateUserRoleRequest", badRequestMessage: "Cannot assign super_admin role through API", notFoundMessage: "User profile not found" },
  { method: "delete", path: "/admin/super-admin/users/{id}", tag: "Super Admin", summary: "Deactivate a user", description: "Deactivates a user profile. Super Admin only.", successMessage: "User deactivated successfully", responseSchema: "UserProfile", security: "required", roles: ["super_admin"], pathParams: [{ name: "id", description: "User profile UUID." }], notFoundMessage: "User profile not found" },
  { method: "get", path: "/admin/super-admin/audit-logs", tag: "Super Admin", summary: "List audit logs", description: "Super Admin only. Supports exact action and actor filters.", successMessage: "Audit logs fetched successfully", responseSchema: "AuditLog", security: "required", roles: ["super_admin"], query: [...paginationParameters, queryParameter("action", "Exact audit action."), queryParameter("actor_id", "Actor profile UUID.", uuid)] },
  { method: "get", path: "/admin/super-admin/system-stats", tag: "Super Admin", summary: "Get system statistics", description: "Returns system-wide totals. Super Admin only.", successMessage: "System stats fetched successfully", responseSchema: "DashboardSummary", security: "required", roles: ["super_admin"] },

  { method: "get", path: "/dashboard/overview", tag: "Dashboard", summary: "Get dashboard overview", description: "Returns the authenticated user's dashboard totals.", successMessage: "Dashboard overview fetched successfully", responseSchema: "DashboardSummary", security: "required" },
  { method: "get", path: "/dashboard/investments", tag: "Dashboard", summary: "Get investment summary", description: "Returns monthly data by default or yearly data when period=yearly.", successMessage: "Investment summary fetched successfully", responseSchema: "DashboardSummary", security: "required", query: [queryParameter("period", "Aggregation period.", { type: "string", enum: ["monthly", "yearly"], default: "monthly" })] },
  { method: "get", path: "/dashboard/recent-messages", tag: "Dashboard", summary: "Get recent messages", description: "Returns the authenticated user's recent support and inquiry messages.", successMessage: "Recent messages fetched successfully", responseSchema: "DashboardSummary", security: "required" },
  { method: "get", path: "/dashboard/recent-properties", tag: "Dashboard", summary: "Get recent properties", description: "Returns recently relevant properties for the authenticated user.", successMessage: "Recent properties fetched successfully", responseSchema: "Property", security: "required" },
  { method: "get", path: "/dashboard/admin-summary", tag: "Dashboard", summary: "Get admin dashboard summary", description: "Returns platform dashboard totals. Admin or Super Admin only.", successMessage: "Admin dashboard summary fetched successfully", responseSchema: "DashboardSummary", security: "required", roles: ["admin", "super_admin"] }
];

const successResponse = (endpoint: Endpoint) => ({
  description: endpoint.successMessage,
  content: {
    "application/json": {
      schema: {
        type: "object",
        properties: {
          success: { type: "boolean", enum: [true] },
          message: { type: "string", enum: [endpoint.successMessage] },
          ...(endpoint.responseSchema ? { data: ref(endpoint.responseSchema) } : {})
        },
        required: ["success", "message"]
      },
      example: {
        success: true,
        message: endpoint.successMessage,
        ...(endpoint.responseSchema
          ? { data: endpoint.successExample ?? {} }
          : {})
      }
    }
  }
});

const errorResponse = (
  description: string,
  message: string,
  validation = false,
  code?: string,
  examples?: Record<
    string,
    { summary: string; message: string; code?: string }
  >
) => ({
  description,
  content: {
    "application/json": {
      schema: validation ? ref("ValidationError") : ref("ErrorResponse"),
      ...(examples
        ? {
            examples: Object.fromEntries(
              Object.entries(examples).map(([name, example]) => [
                name,
                {
                  summary: example.summary,
                  value: {
                    success: false,
                    message: example.message,
                    ...(example.code ? { code: example.code } : {})
                  }
                }
              ])
            )
          }
        : {
            example: validation
              ? { success: false, message: "Validation failed", errors: { formErrors: [], fieldErrors: {} } }
              : { success: false, message, ...(code ? { code } : {}) }
          })
    }
  }
});

const paths: Record<string, Record<string, unknown>> = {};

for (const endpoint of endpoints) {
  const security = endpoint.security ?? "none";
  const responses: Record<string, unknown> = {
    [String(endpoint.successStatus ?? 200)]: successResponse(endpoint),
    "500": errorResponse("Internal server error", "Internal server error"),
    "429": errorResponse("Rate limit exceeded", "Too many requests, please try again later")
  };

  if (endpoint.bodySchema) {
    responses["400"] = errorResponse("Request validation failed", "Validation failed", true);
  } else if (endpoint.badRequestMessage) {
    responses["400"] = errorResponse("Bad request", endpoint.badRequestMessage);
  }

  if (security === "required") {
    responses["401"] = errorResponse("Authentication failed", "Authentication token missing");
  }

  if (endpoint.roles?.length || endpoint.forbiddenMessage) {
    responses["403"] = errorResponse("Insufficient permission", endpoint.forbiddenMessage ?? "You do not have permission to perform this action");
  }

  if (endpoint.notFoundMessage) {
    responses["404"] = errorResponse("Resource not found", endpoint.notFoundMessage);
  }

  for (const [status, response] of Object.entries(endpoint.errorResponses ?? {})) {
    responses[status] = errorResponse(
      response.description,
      response.message,
      false,
      response.code,
      response.examples
    );
  }

  const parameters = [
    ...(endpoint.pathParams ?? []).map((parameter) => ({
      name: parameter.name,
      in: "path",
      required: true,
      description: parameter.description,
      schema: uuid,
      example: "550e8400-e29b-41d4-a716-446655440000"
    })),
    ...(endpoint.query ?? [])
  ];

  let requestBody: Record<string, unknown> | undefined;

  if (endpoint.bodySchema) {
    requestBody = {
      required: true,
      content: { "application/json": { schema: ref(endpoint.bodySchema) } }
    };
  }

  if (endpoint.multipart) {
    const fileSchema = endpoint.multipart.multiple
      ? { type: "array", minItems: 1, maxItems: 10, items: { type: "string", format: "binary" } }
      : { type: "string", format: "binary" };

    const mandateFields = endpoint.multipart.field === "document"
      ? {
          property_id: uuid,
          mandate_type: { type: "string", enum: ["buyer", "seller"] },
          full_name: { type: "string", minLength: 2 },
          email: { type: "string", format: "email" },
          phone_number: { type: "string", minLength: 7 },
          address: { type: "string", minLength: 3 },
          nationality: { type: "string" },
          date_of_birth: { type: "string" },
          title_document: { type: "string" },
          signature_data: { type: "string" },
          terms_accepted: { type: "boolean" }
        }
      : {};

    requestBody = {
      required: true,
      content: {
        "multipart/form-data": {
          schema: {
            type: "object",
            properties: { ...mandateFields, [endpoint.multipart.field]: fileSchema },
            required: endpoint.multipart.field === "document"
              ? ["mandate_type", "full_name", "email", "phone_number", "address", "terms_accepted"]
              : [endpoint.multipart.field]
          },
          encoding: endpoint.multipart.multiple
            ? { [endpoint.multipart.field]: { contentType: "image/jpeg, image/png, image/webp" } }
            : undefined
        }
      },
      description: endpoint.multipart.description
    };
  }

  const roleDescription = endpoint.roles?.length
    ? ` Required role(s): ${endpoint.roles.join(", ")}.`
    : "";

  const operation = {
    tags: [endpoint.tag],
    summary: endpoint.summary,
    description: `${endpoint.description}${roleDescription}`,
    operationId: `${endpoint.method}_${endpoint.path.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "")}`,
    ...(parameters.length ? { parameters } : {}),
    ...(requestBody ? { requestBody } : {}),
    security: security === "required"
      ? [{ bearerAuth: [] }]
      : security === "optional"
        ? [{}, { bearerAuth: [] }]
        : [],
    responses
  };

  paths[endpoint.path] = paths[endpoint.path] ?? {};
  paths[endpoint.path][endpoint.method] = operation;
}

const normalizeApiServer = (baseUrl: string) => {
  const normalized = baseUrl.replace(/\/$/, "");
  return normalized.endsWith("/api/v1") ? normalized : `${normalized}/api/v1`;
};

const servers = [
  { url: `http://localhost:${env.port}/api/v1`, description: "Local development server" },
  ...(env.apiBaseUrl ? [{ url: normalizeApiServer(env.apiBaseUrl), description: "Production server" }] : [])
];

const options: swaggerJSDoc.OAS3Options = {
  definition: {
    openapi: "3.0.3",
    info: {
      title: "Beryl Prestige Living API",
      version: "1.0.0",
      description: "Backend API documentation for the Beryl Prestige Living web and mobile applications."
    },
    servers,
    tags: [
      "Health", "Authentication", "Profile", "Properties", "Property Images", "Saved Properties", "Analytics",
      "Referrals", "Inquiries", "Support", "Listings", "Reports", "Mandates", "Transactions", "Notifications",
      "Admin", "Super Admin", "Dashboard"
    ].map((name) => ({ name })),
    components,
    paths
  },
  apis: []
};

export const swaggerSpec = swaggerJSDoc(options);
