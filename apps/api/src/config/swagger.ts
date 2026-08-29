import swaggerJSDoc from "swagger-jsdoc";
import { env } from "./env";

type HttpMethod = "get" | "post" | "put" | "patch" | "delete";
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
    fields?: Record<string, unknown>;
    requiredFields?: string[];
    contentType?: string;
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
        {
          summary: string;
          message: string;
          code?: string;
          details?: Record<string, unknown>;
        }
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
      description: "Access token for the endpoint's authentication domain. Customer endpoints require a Beryl customer access token; Admin endpoints require an Admin access token. Enter it without the Bearer prefix."
    }
  },
  schemas: {
    ErrorResponse: objectSchema(
      {
        success: { type: "boolean", enum: [false], example: false },
        message: { type: "string", example: "Internal server error" },
        code: { type: "string", nullable: true, example: "INVALID_OTP" },
        attemptsRemaining: { type: "integer", minimum: 0, nullable: true },
        retryAfter: { type: "integer", minimum: 1, nullable: true }
      },
      ["success", "message"]
    ),
    ValidationError: objectSchema(
      {
        success: { type: "boolean", enum: [false], example: false },
        message: { type: "string", enum: ["Validation failed"] },
        code: {
          type: "string",
          enum: [
            "ONBOARDING_VALIDATION_ERROR",
            "INVALID_BUDGET_RANGE",
            "INVALID_PERSONA_TYPE",
            "PASSWORD_VALIDATION_ERROR",
            "NEW_PASSWORD_SAME_AS_CURRENT"
          ]
        },
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
    MarketplaceDraftRequest: objectSchema({ title: { type: "string", nullable: true }, description: { type: "string", nullable: true }, propertyCategory: { type: "string", enum: ["RESIDENTIAL", "COMMERCIAL"], nullable: true, description: "Public API value. Persisted through the legacy lowercase database enum mapping." }, propertyType: { type: "string", enum: ["APARTMENT", "MINI_FLAT", "SELF_CONTAIN_STUDIO", "DUPLEX", "DETACHED_HOUSE", "SEMI_DETACHED_HOUSE", "TERRACE", "BUNGALOW"], nullable: true }, ownershipType: { type: "string", enum: ["PERSONAL", "THIRD_PARTY"], nullable: true }, publicLocation: nullableString, fullAddress: { type: "string", nullable: true, description: "Private: returned only to the owning Seller." }, askingPrice: { type: "number", minimum: 0, nullable: true }, negotiable: { type: "boolean", nullable: true }, initialDepositType: { type: "string", enum: ["AMOUNT", "PERCENTAGE"], nullable: true }, initialDepositValue: { type: "number", minimum: 0, nullable: true, description: "For PERCENTAGE, must not exceed 100." }, condition: { type: "string", enum: ["OFF_PLAN", "UNDER_CONSTRUCTION", "NEWLY_BUILT", "FAIRLY_USED"], nullable: true }, furnishing: { type: "string", enum: ["FULLY_FURNISHED", "SEMI_FURNISHED", "UNFURNISHED"], nullable: true }, bedrooms: { type: "integer", minimum: 0, nullable: true }, bathrooms: { type: "integer", minimum: 0, nullable: true }, toilets: { type: "integer", minimum: 0, nullable: true }, parkingSpaces: { type: "integer", minimum: 0, nullable: true }, numberOfFloors: { type: "integer", minimum: 0, nullable: true }, parkingCapacity: { type: "integer", minimum: 0, nullable: true }, currentStep: { type: "string", enum: ["PROPERTY_INFORMATION", "PHOTOS_DOCUMENTS", "SALES_MANDATE", "REVIEW"], description: "REVIEW records navigation to Step 4; it does not submit the listing." }, amenities: { type: "array", maxItems: 50, items: { type: "string", maxLength: 80 } } }),
    MarketplaceImageOrderRequest: objectSchema({ imageIds: { type: "array", minItems: 1, items: uuid } }, ["imageIds"]),
    MarketplacePropertyDocument: objectSchema({ id: uuid, documentType: { type: "string", enum: ["OWNERSHIP_PAPERS", "SURVEY_PLAN", "DEED", "CERTIFICATE_OF_OCCUPANCY", "OTHER"] }, displayName: { type: "string", maxLength: 180 }, mimeType: { type: "string", enum: ["application/pdf"] }, sizeBytes: { type: "integer", minimum: 0, maximum: 10485760 }, uploadedAt: dateTime }, ["id", "documentType", "displayName", "mimeType", "sizeBytes", "uploadedAt"]),
    MarketplaceDocumentUploadResult: objectSchema({ document: ref("MarketplacePropertyDocument") }, ["document"]),
    MarketplaceSellerDraftResult: objectSchema({ property: { allOf: [ref("Property"), { type: "object", properties: { documents: { type: "array", items: ref("MarketplacePropertyDocument"), description: "Private supporting-document metadata visible only to the owning Seller. Provider identifiers and URLs are never returned." } }, required: ["documents"] }] } }, ["property"]),
    MarketplaceSalesMandateRequest: objectSchema({ mandateType: { type: "string", enum: ["EXCLUSIVE", "OPEN"] }, sellerFullName: { type: "string", minLength: 2, maxLength: 180 }, ownershipConfirmed: { type: "boolean", description: "Must be true when mandateAccepted is true." }, mandateAccepted: { type: "boolean", description: "Explicit Seller acknowledgment. acceptedAt is generated by the server when first accepted." } }, ["mandateType", "sellerFullName", "ownershipConfirmed", "mandateAccepted"]),
    MarketplaceSalesMandate: objectSchema({ mandateType: { type: "string", enum: ["EXCLUSIVE", "OPEN"] }, sellerFullName: { type: "string" }, ownershipConfirmed: { type: "boolean" }, mandateAccepted: { type: "boolean" }, acceptedAt: { ...dateTime, nullable: true, readOnly: true }, agreementVersion: { type: "string", nullable: true, readOnly: true, description: "Server-controlled Product/legal configuration; null until configured." }, commissionPercentage: { type: "number", nullable: true, readOnly: true, minimum: 0, maximum: 100, description: "Authoritative server-controlled commercial term; never accepted from the client." }, commissionAmount: { type: "number", nullable: true, readOnly: true, minimum: 0, description: "Authoritative server-controlled commercial term; never accepted from the client." } }, ["mandateType", "sellerFullName", "ownershipConfirmed", "mandateAccepted", "acceptedAt", "agreementVersion", "commissionPercentage", "commissionAmount"]),
    MarketplaceSalesMandateResult: objectSchema({ mandate: ref("MarketplaceSalesMandate") }, ["mandate"]),
    MarketplaceReviewImage: objectSchema({ id: uuid, url: { type: "string", format: "uri" }, order: { type: "integer", minimum: 0 }, isCover: { type: "boolean" } }, ["id", "url", "order", "isCover"]),
    MarketplaceReviewValidation: objectSchema({ missingSections: { type: "array", items: { type: "string", enum: ["PROPERTY_INFORMATION", "PHOTOS", "SALES_MANDATE"] } }, missingFields: { type: "array", items: { type: "string" } } }, ["missingSections", "missingFields"]),
    MarketplaceBuyerPreview: objectSchema({ id: uuid, referenceId: { type: "string" }, title: nullableString, description: nullableString, propertyType: nullableString, propertyCategory: nullableString, publicLocation: nullableString, askingPrice: { type: "number", nullable: true, minimum: 0 }, negotiable: { type: "boolean" }, initialDeposit: { type: "object", nullable: true, properties: { type: { type: "string", enum: ["AMOUNT", "PERCENTAGE"], nullable: true }, value: { type: "number", nullable: true, minimum: 0 } }, additionalProperties: false }, condition: nullableString, furnishing: nullableString, bedrooms: { type: "number", nullable: true }, bathrooms: { type: "number", nullable: true }, toilets: { type: "number", nullable: true }, parkingSpaces: { type: "number", nullable: true }, numberOfFloors: { type: "number", nullable: true }, parkingCapacity: { type: "number", nullable: true }, amenities: { type: "array", items: { type: "string" } }, images: { type: "array", items: ref("MarketplaceReviewImage") }, coverImage: { allOf: [ref("MarketplaceReviewImage")], nullable: true }, photoCount: { type: "integer", minimum: 0, maximum: 10 } }, ["id", "referenceId", "images", "coverImage", "photoCount"]),
    MarketplacePropertyReview: objectSchema({ buyerPreview: ref("MarketplaceBuyerPreview"), sellerPrivate: objectSchema({ fullAddress: { type: "string", nullable: true, description: "Private Seller-only edit summary; never part of buyerPreview." } }, ["fullAddress"]), mandate: { allOf: [ref("MarketplaceSalesMandate")], nullable: true }, currentStep: { type: "string", enum: ["PROPERTY_INFORMATION", "PHOTOS_DOCUMENTS", "SALES_MANDATE", "REVIEW"] }, status: { type: "string", enum: ["DRAFT"] }, validation: ref("MarketplaceReviewValidation") }, ["buyerPreview", "sellerPrivate", "mandate", "currentStep", "status", "validation"]),
    MarketplacePropertyReviewResult: objectSchema({ review: ref("MarketplacePropertyReview") }, ["review"]),
    MarketplaceSubmissionResult: objectSchema({ propertyId: uuid, referenceId: { type: "string" }, status: { type: "string", enum: ["IN_REVIEW"] }, submittedAt: dateTime, nextAction: { type: "string", enum: ["OPEN_MY_LISTINGS"] } }, ["propertyId", "referenceId", "status", "submittedAt", "nextAction"]),
    MarketplaceReopenResult: objectSchema({ propertyId: uuid, referenceId: { type: "string" }, status: { type: "string", enum: ["DRAFT"] }, currentStep: { type: "string", enum: ["REVIEW"] }, rejectionReason: nullableString, rejectedAt: dateTime, reviewedAt: dateTime, nextAction: { type: "string", enum: ["EDIT_REJECTED_LISTING"] } }, ["propertyId", "referenceId", "status", "currentStep", "rejectionReason", "rejectedAt", "reviewedAt", "nextAction"]),
    MarketplacePublicCoverImage: objectSchema({ id: uuid, url: { type: "string", format: "uri" } }, ["id", "url"]),
    MarketplacePublicPropertyCard: objectSchema({ id: uuid, referenceId: { type: "string" }, title: { type: "string" }, askingPrice: { type: "number", minimum: 0 }, negotiable: { type: "boolean" }, propertyType: { type: "string" }, propertyCategory: { type: "string", enum: ["RESIDENTIAL", "COMMERCIAL"] }, publicLocation: { type: "string" }, bedrooms: { type: "number", nullable: true }, bathrooms: { type: "number", nullable: true }, toilets: { type: "number", nullable: true }, parkingSpaces: { type: "number", nullable: true }, coverImage: { allOf: [ref("MarketplacePublicCoverImage")], nullable: true }, photoCount: { type: "integer", minimum: 0, maximum: 10 }, verified: { type: "boolean", description: "True because only listings that completed Admin review and reached authoritative Marketplace LIVE are returned." }, publishedAt: { ...dateTime, nullable: true }, saved: { type: "boolean", description: "False anonymously; enriched with one canonical saved_properties query for a valid customer session." } }, ["id", "referenceId", "title", "askingPrice", "negotiable", "propertyType", "propertyCategory", "publicLocation", "bedrooms", "bathrooms", "toilets", "parkingSpaces", "coverImage", "photoCount", "verified", "publishedAt", "saved"]),
    MarketplacePublicPropertyList: objectSchema({ properties: { type: "array", items: ref("MarketplacePublicPropertyCard") }, pagination: ref("Pagination") }, ["properties", "pagination"]),
    MarketplacePublicDetailImage: objectSchema({ id: uuid, url: { type: "string", format: "uri" }, order: { type: "integer", minimum: 0 }, isCover: { type: "boolean" } }, ["id", "url", "order", "isCover"]),
    MarketplacePublicInitialDeposit: objectSchema({ type: { type: "string", enum: ["AMOUNT", "PERCENTAGE"], nullable: true }, value: { type: "number", minimum: 0, nullable: true } }, ["type", "value"]),
    MarketplacePublicPropertyDetail: objectSchema({ id: uuid, referenceId: { type: "string" }, title: { type: "string" }, description: { type: "string" }, askingPrice: { type: "number", minimum: 0 }, negotiable: { type: "boolean" }, propertyType: { type: "string" }, propertyCategory: { type: "string", enum: ["RESIDENTIAL", "COMMERCIAL"] }, publicLocation: { type: "string" }, bedrooms: { type: "number", nullable: true }, bathrooms: { type: "number", nullable: true }, toilets: { type: "number", nullable: true }, parkingSpaces: { type: "number", nullable: true }, numberOfFloors: { type: "number", nullable: true }, parkingCapacity: { type: "number", nullable: true }, condition: { type: "string", nullable: true }, furnishing: { type: "string", nullable: true }, initialDeposit: { allOf: [ref("MarketplacePublicInitialDeposit")], nullable: true }, amenities: { type: "array", items: { type: "string" } }, images: { type: "array", items: ref("MarketplacePublicDetailImage") }, photoCount: { type: "integer", minimum: 0, maximum: 10 }, verified: { type: "boolean", description: "Uses the same authoritative Marketplace LIVE/Admin approval interpretation as public search." }, publishedAt: { ...dateTime, nullable: true }, saved: { type: "boolean", description: "False anonymously; enriched from canonical saved_properties for a valid customer session." } }, ["id", "referenceId", "title", "description", "askingPrice", "negotiable", "propertyType", "propertyCategory", "publicLocation", "bedrooms", "bathrooms", "toilets", "parkingSpaces", "numberOfFloors", "parkingCapacity", "condition", "furnishing", "initialDeposit", "amenities", "images", "photoCount", "verified", "publishedAt", "saved"]),
    MarketplacePublicPropertyDetailResult: objectSchema({ property: ref("MarketplacePublicPropertyDetail") }, ["property"]),
    MarketplaceInterestRequest: objectSchema({ contactMethod: { type: "string", enum: ["WHATSAPP", "CALL", "EMAIL"] }, message: { type: "string", minLength: 1, maxLength: 1000, nullable: true, description: "Optional Buyer message. Blank-only input is treated as omitted." } }, ["contactMethod"]),
    MarketplaceInterestResult: objectSchema({ inquiryId: uuid, propertyId: uuid, referenceId: { type: "string" }, title: { type: "string" }, askingPrice: { type: "number", minimum: 0 }, preferredContactMethod: { type: "string", enum: ["WHATSAPP", "CALL", "EMAIL"] }, submittedAt: dateTime, nextAction: { type: "string", enum: ["KEEP_BROWSING"] } }, ["inquiryId", "propertyId", "referenceId", "title", "askingPrice", "preferredContactMethod", "submittedAt", "nextAction"]),
    MarketplaceSavedPropertyMutation: objectSchema({ id: uuid, propertyId: uuid, savedAt: dateTime }, ["id", "propertyId", "savedAt"]),
    MarketplaceSavedProperty: objectSchema({ id: uuid, propertyId: uuid, savedAt: dateTime, property: { allOf: [ref("MarketplacePublicPropertyCard"), { type: "object", properties: { saved: { type: "boolean", enum: [true] } }, required: ["saved"] }] } }, ["id", "propertyId", "savedAt", "property"]),
    MarketplaceSavedPropertyList: objectSchema({ saved_properties: { type: "array", items: ref("MarketplaceSavedProperty") }, pagination: ref("Pagination") }, ["saved_properties", "pagination"]),
    MarketplaceSellerPropertySummary: objectSchema({ id: uuid, referenceId: { type: "string" }, title: nullableString, askingPrice: { type: "number", minimum: 0, nullable: true }, status: { type: "string", enum: ["DRAFT", "IN_REVIEW", "LIVE", "REJECTED"] }, currentStep: { type: "string", enum: ["PROPERTY_INFORMATION", "PHOTOS_DOCUMENTS", "SALES_MANDATE", "REVIEW"], nullable: true }, coverImage: { allOf: [ref("MarketplaceReviewImage")], nullable: true }, photoCount: { type: "integer", minimum: 0, maximum: 10 }, updatedAt: dateTime, submittedAt: { ...dateTime, nullable: true }, reviewedAt: { ...dateTime, nullable: true }, publishedAt: { ...dateTime, nullable: true, description: "Null until an authoritative Marketplace publication timestamp exists." }, rejectedAt: { ...dateTime, nullable: true, description: "Preserved authoritative timestamp of the most recent rejection." }, rejectionReason: { type: "string", nullable: true, description: "Seller-safe current rejection feedback, preserved while correcting and resubmitting." }, rejectionFeedback: { type: "string", nullable: true, description: "Compatibility alias of rejectionReason." }, reviewProgress: { type: "object", nullable: true, properties: { submitted: { type: "boolean" }, reviewing: { type: "boolean" }, live: { type: "boolean" } }, additionalProperties: false }, nextAction: { type: "string", enum: ["CONTINUE_PROPERTY_INFORMATION", "CONTINUE_PHOTOS_DOCUMENTS", "CONTINUE_SALES_MANDATE", "CONTINUE_REVIEW", "EDIT_REJECTED_LISTING", "VIEW_REVIEW_STATUS", "VIEW_LIVE_LISTING", "VIEW_REJECTION"] } }, ["id", "referenceId", "status", "currentStep", "coverImage", "photoCount", "updatedAt", "submittedAt", "reviewedAt", "publishedAt", "rejectedAt", "rejectionReason", "rejectionFeedback", "reviewProgress", "nextAction"]),
    MarketplaceSellerStatusCounts: objectSchema({ all: { type: "integer", minimum: 0 }, draft: { type: "integer", minimum: 0 }, inReview: { type: "integer", minimum: 0 }, live: { type: "integer", minimum: 0 }, rejected: { type: "integer", minimum: 0 } }, ["all", "draft", "inReview", "live", "rejected"]),
    MarketplaceSellerPropertyList: objectSchema({ counts: ref("MarketplaceSellerStatusCounts"), items: { type: "array", items: ref("MarketplaceSellerPropertySummary") }, pagination: ref("Pagination") }, ["counts", "items", "pagination"]),
    MarketplaceDraftDeletion: objectSchema({ propertyId: uuid, deleted: { type: "boolean", enum: [true] } }, ["propertyId", "deleted"]),
    MarketplaceSellerManagementProperty: objectSchema({ id: uuid, referenceId: { type: "string" }, status: { type: "string", enum: ["DRAFT", "IN_REVIEW", "LIVE", "REJECTED"] }, currentStep: { type: "string", enum: ["PROPERTY_INFORMATION", "PHOTOS_DOCUMENTS", "SALES_MANDATE", "REVIEW"], nullable: true }, title: nullableString, description: nullableString, propertyCategory: nullableString, propertyType: nullableString, ownershipType: nullableString, publicLocation: nullableString, fullAddress: { type: "string", nullable: true, description: "Private and visible only to the owning Seller." }, askingPrice: { type: "number", minimum: 0, nullable: true }, images: { type: "array", items: ref("MarketplaceReviewImage") }, submittedAt: { ...dateTime, nullable: true }, reviewedAt: { ...dateTime, nullable: true }, publishedAt: { ...dateTime, nullable: true }, rejectedAt: { ...dateTime, nullable: true }, rejectionReason: { type: "string", nullable: true }, rejectionFeedback: { type: "string", nullable: true } }, ["id", "referenceId", "status", "currentStep", "images", "submittedAt", "reviewedAt", "publishedAt", "rejectedAt", "rejectionReason", "rejectionFeedback"]),
    MarketplaceSellerReviewHistory: objectSchema({ id: uuid, previousStatus: { type: "string" }, newStatus: { type: "string", enum: ["LIVE", "REJECTED"] }, action: { type: "string", enum: ["APPROVED", "REJECTED"] }, reason: nullableString, createdAt: dateTime }, ["id", "previousStatus", "newStatus", "action", "reason", "createdAt"]),
    MarketplaceSellerManagement: objectSchema({ summary: ref("MarketplaceSellerPropertySummary"), property: ref("MarketplaceSellerManagementProperty"), documents: { type: "array", items: ref("MarketplacePropertyDocument"), description: "Safe document metadata only; no URLs or provider identifiers." }, mandate: { allOf: [ref("MarketplaceSalesMandate")], nullable: true }, reviewHistory: { type: "array", items: ref("MarketplaceSellerReviewHistory"), description: "Seller-safe prior Admin decisions without reviewer identity or internal Admin data." } }, ["summary", "property", "documents", "mandate", "reviewHistory"]),
    MarketplaceSellerManagementResult: objectSchema({ management: ref("MarketplaceSellerManagement") }, ["management"]),
    AdminMarketplaceSellerSummary: objectSchema({ id: uuid, fullName: nullableString }, ["id", "fullName"]),
    AdminMarketplaceReviewSummary: objectSchema({ id: uuid, referenceId: { type: "string" }, title: nullableString, propertyType: nullableString, propertyCategory: nullableString, publicLocation: nullableString, askingPrice: { type: "number", nullable: true }, status: { type: "string", enum: ["IN_REVIEW", "LIVE", "REJECTED"] }, mandateType: { type: "string", enum: ["EXCLUSIVE", "OPEN"], nullable: true }, sellerSummary: { allOf: [ref("AdminMarketplaceSellerSummary")], nullable: true }, coverImage: { allOf: [ref("MarketplaceReviewImage")], nullable: true }, photoCount: { type: "integer", minimum: 0 }, submittedAt: { ...dateTime, nullable: true }, reviewedAt: { ...dateTime, nullable: true }, publishedAt: { ...dateTime, nullable: true }, rejectedAt: { ...dateTime, nullable: true }, updatedAt: dateTime }, ["id", "referenceId", "status", "mandateType", "photoCount", "submittedAt", "reviewedAt", "publishedAt", "rejectedAt", "updatedAt"]),
    AdminMarketplaceReviewCounts: objectSchema({ all: { type: "integer" }, inReview: { type: "integer" }, live: { type: "integer" }, rejected: { type: "integer" } }, ["all", "inReview", "live", "rejected"]),
    AdminMarketplaceReviewQueue: objectSchema({ counts: ref("AdminMarketplaceReviewCounts"), items: { type: "array", items: ref("AdminMarketplaceReviewSummary") }, pagination: ref("Pagination") }, ["counts", "items", "pagination"]),
    AdminMarketplaceReviewHistory: objectSchema({ id: uuid, previousStatus: { type: "string" }, newStatus: { type: "string", enum: ["LIVE", "REJECTED"] }, action: { type: "string", enum: ["APPROVED", "REJECTED"] }, reason: nullableString, reviewedByAdminId: uuid, createdAt: dateTime }, ["id", "previousStatus", "newStatus", "action", "reason", "reviewedByAdminId", "createdAt"]),
    AdminMarketplaceReviewDetail: objectSchema({ summary: ref("AdminMarketplaceReviewSummary"), property: { type: "object", additionalProperties: true, description: "Complete operational property data, including private fullAddress and ordered photos, visible only to authenticated Admin staff." }, seller: { type: "object", nullable: true, additionalProperties: true }, documents: { type: "array", items: ref("MarketplacePropertyDocument"), description: "Safe metadata only. Use the Admin document-access operation for a short-lived signed URL." }, mandate: { allOf: [ref("MarketplaceSalesMandate")], nullable: true }, rejectionFeedback: nullableString, history: { type: "array", items: ref("AdminMarketplaceReviewHistory") } }, ["summary", "property", "seller", "documents", "mandate", "rejectionFeedback", "history"]),
    AdminMarketplaceReviewDetailResult: objectSchema({ review: ref("AdminMarketplaceReviewDetail") }, ["review"]),
    AdminMarketplaceDocumentAccess: objectSchema({ url: { type: "string", format: "uri", description: "Signed authenticated-provider URL valid for five minutes." }, expiresAt: dateTime }, ["url", "expiresAt"]),
    AdminMarketplaceDocumentAccessResult: objectSchema({ access: ref("AdminMarketplaceDocumentAccess") }, ["access"]),
    AdminMarketplaceRejectRequest: objectSchema({ reason: { type: "string", minLength: 3, maxLength: 1000 } }, ["reason"]),
    AdminMarketplaceReviewDecision: objectSchema({ propertyId: uuid, referenceId: { type: "string" }, status: { type: "string", enum: ["LIVE", "REJECTED"] }, reviewedAt: dateTime, publishedAt: { ...dateTime, nullable: true }, rejectedAt: { ...dateTime, nullable: true }, rejectionReason: nullableString, nextAction: { type: "string", enum: ["VIEW_LIVE_LISTING", "VIEW_REJECTION"] } }, ["propertyId", "referenceId", "status", "reviewedAt", "publishedAt", "rejectedAt", "rejectionReason", "nextAction"]),
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
    AdminStaff: objectSchema({ id: uuid, fullName: { type: "string" }, email: { type: "string", format: "email" }, phone: nullableString, department: { type: "string", enum: ["TECH", "MANAGEMENT"] }, adminRole: { type: "string", enum: ["ADMIN", "SUPER_ADMIN"] }, status: { type: "string", enum: ["PENDING", "ACTIVE", "SUSPENDED", "LOCKED"] }, requiresPasswordChange: { type: "boolean" }, createdAt: dateTime, updatedAt: dateTime }, ["id", "fullName", "email", "department", "adminRole", "status", "requiresPasswordChange", "createdAt", "updatedAt"]),
    AdminStaffList: { type: "array", items: ref("AdminStaff") },
    AdminInvitationResult: objectSchema({ adminId: uuid, email: { type: "string", description: "Masked invited email." }, status: { type: "string", enum: ["PENDING"] }, invitationExpiresIn: { type: "integer", minimum: 1 } }, ["adminId", "email", "status", "invitationExpiresIn"]),
    AdminActivationChallenge: objectSchema({ challengeId: uuid, maskedEmail: { type: "string" }, otpLength: { type: "integer", enum: [6] }, resendAvailableIn: { type: "integer", minimum: 1 }, nextAction: { type: "string", enum: ["VERIFY_ADMIN_ACTIVATION_OTP"] } }, ["challengeId", "maskedEmail", "otpLength", "resendAvailableIn", "nextAction"]),
    AdminInvitationRequest: objectSchema({ fullName: { type: "string", minLength: 2 }, email: { type: "string", format: "email" }, phone: { type: "string", example: "+2348012345678" }, department: { type: "string", enum: ["TECH", "MANAGEMENT"] }, adminRole: { type: "string", enum: ["ADMIN", "SUPER_ADMIN"] } }, ["fullName", "email", "department", "adminRole"]),
    AdminActivationRequest: objectSchema({ invitationToken: { type: "string", writeOnly: true, description: "Token from the invitation link; never log it." }, temporaryPassword: { type: "string", format: "password", writeOnly: true } }, ["invitationToken", "temporaryPassword"]),
    AdminOtpVerificationRequest: objectSchema({ challengeId: uuid, otp: { type: "string", pattern: "^[0-9]{6}$", writeOnly: true, example: "123456" } }, ["challengeId", "otp"]),
    AdminResendOtpRequest: objectSchema({ challengeId: uuid }, ["challengeId"]),
    AdminSetPasswordRequest: objectSchema({ setupToken: { type: "string", writeOnly: true }, newPassword: { type: "string", format: "password", writeOnly: true, minLength: 8 }, confirmPassword: { type: "string", format: "password", writeOnly: true, minLength: 8 } }, ["setupToken", "newPassword", "confirmPassword"]),
    AdminFirstPasswordChangeRequest: objectSchema({ changePasswordToken: { type: "string", writeOnly: true, description: "Short-lived restricted proof from Admin login OTP verification." }, currentPassword: { type: "string", format: "password", writeOnly: true }, newPassword: { type: "string", format: "password", writeOnly: true, minLength: 8, description: "At least eight characters, including a letter and a number." }, confirmPassword: { type: "string", format: "password", writeOnly: true } }, ["changePasswordToken", "currentPassword", "newPassword", "confirmPassword"]),
    AdminRefreshRequest: objectSchema({ refreshToken: { type: "string", writeOnly: true, description: "Current Admin refresh token. It is rotated on success." } }, ["refreshToken"]),
    AdminChangePasswordRequest: objectSchema({ currentPassword: { type: "string", format: "password", writeOnly: true }, newPassword: { type: "string", format: "password", writeOnly: true, minLength: 8, description: "At least eight characters with uppercase, lowercase, number, and special character." }, confirmPassword: { type: "string", format: "password", writeOnly: true } }, ["currentPassword", "newPassword", "confirmPassword"]),
    AdminLoginRequest: objectSchema({ email: { type: "string", format: "email" }, password: { type: "string", format: "password", writeOnly: true } }, ["email", "password"]),
    AdminStatusRequest: objectSchema({ status: { type: "string", enum: ["ACTIVE", "SUSPENDED", "LOCKED"] } }, ["status"]),
    DashboardSummary: { type: "object", additionalProperties: true, description: "Dashboard counters and recent activity computed by the dashboard service." },
    AnalyticsOverview: { type: "object", additionalProperties: true, description: "Property view, share, save, and publication analytics." },
    AuditLog: { type: "object", properties: { id: uuid, actor_id: uuid, action: { type: "string" }, metadata: { type: "object", additionalProperties: true }, created_at: dateTime }, additionalProperties: true },
    StandardSuccessResponse: objectSchema({ success: { type: "boolean", enum: [true] }, message: { type: "string" }, data: { type: "object", additionalProperties: true } }, ["success", "message"]),

    RegisterRequest: objectSchema({ fullName: { type: "string", minLength: 2, example: "Test Customer" }, email: { type: "string", format: "email", description: "Trimmed and normalized to lowercase.", example: "customer@example.com" }, phone: { type: "string", pattern: "^\\+[1-9]\\d{7,14}$", description: "Normalized to E.164. Nigerian local numbers default to +234.", example: "+2348012345678" }, isWhatsAppNumber: { type: "boolean", description: "Required. When true, the normalized phone value is persisted as the WhatsApp number." }, whatsAppNumber: { type: "string", nullable: true, pattern: "^\\+[1-9]\\d{7,14}$", description: "Required and normalized when isWhatsAppNumber is false; null is accepted when it is true." }, gettingStartedAs: { type: "string", enum: ["FIND_PROPERTY", "LIST_PROPERTY"] }, password: { type: "string", format: "password", minLength: 8, pattern: "^(?=.*[A-Z])(?=.*[a-z])(?=.*\\d)(?=.*[^A-Za-z0-9]).{8,}$", writeOnly: true, description: "At least eight characters with uppercase, lowercase, number, and special character." }, confirmPassword: { type: "string", format: "password", writeOnly: true, description: "Must match password and is never persisted." } }, ["fullName", "email", "phone", "isWhatsAppNumber", "gettingStartedAs", "password", "confirmPassword"]),
    VerifyCustomerEmailRequest: objectSchema({ email: { type: "string", format: "email", description: "Trimmed and normalized to lowercase." }, otp: { type: "string", pattern: "^\\d{6}$", writeOnly: true, description: "The six-digit registration email verification code." } }, ["email", "otp"]),
    ResendCustomerVerificationRequest: objectSchema({ email: { type: "string", format: "email", description: "Trimmed and normalized to lowercase." } }, ["email"]),
    CustomerRegistrationResult: objectSchema({ verificationRequired: { type: "boolean", enum: [true] }, maskedEmail: { type: "string", example: "c***r@example.com" }, otpLength: { type: "integer", enum: [6] }, resendAvailableIn: { type: "integer", minimum: 1, example: 60 }, nextAction: { type: "string", enum: ["VERIFY_EMAIL"] } }, ["verificationRequired", "maskedEmail", "otpLength", "resendAvailableIn", "nextAction"]),
    CustomerEmailVerificationResult: objectSchema({ accountStatus: { type: "string", enum: ["ACTIVE"] }, emailVerified: { type: "boolean", enum: [true] }, activePersona: { type: "string", enum: ["BUYER", "SELLER_DEVELOPER"] }, personas: { type: "array", items: { type: "string", enum: ["BUYER", "SELLER_DEVELOPER"] } }, onboardingStatus: { type: "string", enum: ["NOT_STARTED"] }, nextAction: { type: "string", enum: ["COMPLETE_BUYER_ONBOARDING", "COMPLETE_SELLER_ONBOARDING"] } }, ["accountStatus", "emailVerified", "activePersona", "personas", "onboardingStatus", "nextAction"]),
    ResendCustomerVerificationResult: objectSchema({ resendAvailableIn: { type: "integer", minimum: 1, example: 60 } }, ["resendAvailableIn"]),
    BuyerOnboardingRequest: {
      oneOf: [
        objectSchema({ skip: { type: "boolean", enum: [true] } }, ["skip"]),
        objectSchema(
          {
            skip: { type: "boolean", enum: [false], default: false },
            preferredLocations: {
              type: "array",
              minItems: 1,
              maxItems: 10,
              uniqueItems: true,
              items: { type: "string", minLength: 1, maxLength: 120 },
              description: "Trimmed and deduplicated case-insensitively."
            },
            budgetMin: { type: "number", minimum: 0 },
            budgetMax: {
              type: "number",
              minimum: 0,
              description: "Must be greater than or equal to budgetMin when both are supplied."
            },
            currency: {
              type: "string",
              enum: ["NGN", "USD", "GBP", "EUR"],
              default: "NGN"
            }
          },
          ["preferredLocations"]
        )
      ],
      description: "Send either skip=true by itself or the Buyer preference form."
    },
    SellerOnboardingRequest: {
      oneOf: [
        objectSchema({ skip: { type: "boolean", enum: [true] } }, ["skip"]),
        objectSchema(
          {
            skip: { type: "boolean", enum: [false], default: false },
            profileType: { type: "string", enum: ["INDIVIDUAL", "BUSINESS"] },
            companyName: {
              type: "string",
              minLength: 2,
              maxLength: 160,
              description: "Required when profileType is BUSINESS; ignored for INDIVIDUAL."
            },
            companyAddress: {
              type: "string",
              minLength: 2,
              maxLength: 500,
              description: "Required when profileType is BUSINESS; ignored for INDIVIDUAL."
            }
          },
          ["profileType"]
        )
      ],
      description: "Send either skip=true by itself or the Seller/Developer form. BUSINESS requires companyName and companyAddress."
    },
    PersonaTypeRequest: objectSchema(
      {
        personaType: {
          type: "string",
          enum: ["BUYER", "SELLER_DEVELOPER"]
        }
      },
      ["personaType"]
    ),
    PersonaState: objectSchema(
      {
        type: { type: "string", enum: ["BUYER", "SELLER_DEVELOPER"] },
        activated: { type: "boolean" },
        onboardingStatus: {
          type: "string",
          enum: ["NOT_STARTED", "IN_PROGRESS", "COMPLETED"]
        },
        isActive: { type: "boolean" },
        missingOnboardingSteps: { type: "array", items: { type: "string" } },
        nextAction: { type: "string" }
      },
      ["type", "activated", "onboardingStatus"]
    ),
    OnboardingStatusResult: objectSchema(
      {
        accountStatus: {
          type: "string",
          enum: ["PENDING_VERIFICATION", "ACTIVE", "SUSPENDED", "LOCKED"]
        },
        emailVerified: { type: "boolean" },
        activePersona: { type: "string", enum: ["BUYER", "SELLER_DEVELOPER"] },
        lastActivePersona: { type: "string", enum: ["BUYER", "SELLER_DEVELOPER"] },
        personas: { type: "array", items: ref("PersonaState") },
        missingOnboardingSteps: { type: "array", items: { type: "string" } },
        nextAction: { type: "string" },
        dashboardAccess: { type: "boolean" }
      },
      ["accountStatus", "emailVerified", "activePersona", "lastActivePersona", "personas", "missingOnboardingSteps", "nextAction", "dashboardAccess"]
    ),
    BuyerOnboardingResult: objectSchema(
      {
        activePersona: { type: "string", enum: ["BUYER"] },
        onboardingStatus: { type: "string", enum: ["COMPLETED"] },
        preferredLocations: { type: "array", items: { type: "string" } },
        budgetMin: { type: "number", nullable: true },
        budgetMax: { type: "number", nullable: true },
        currency: { type: "string", enum: ["NGN", "USD", "GBP", "EUR"] },
        skipped: { type: "boolean" },
        nextAction: { type: "string", enum: ["OPEN_BUYER_DASHBOARD"] }
      },
      ["activePersona", "onboardingStatus", "preferredLocations", "currency", "skipped", "nextAction"]
    ),
    SellerOnboardingResult: objectSchema(
      {
        activePersona: { type: "string", enum: ["SELLER_DEVELOPER"] },
        onboardingStatus: { type: "string", enum: ["COMPLETED"] },
        profileType: { type: "string", enum: ["INDIVIDUAL", "BUSINESS"], nullable: true },
        companyName: { type: "string", nullable: true },
        companyAddress: { type: "string", nullable: true },
        skipped: { type: "boolean" },
        nextAction: { type: "string", enum: ["OPEN_SELLER_DASHBOARD"] }
      },
      ["activePersona", "onboardingStatus", "skipped", "nextAction"]
    ),
    PersonaListResult: objectSchema(
      {
        activePersona: { type: "string", enum: ["BUYER", "SELLER_DEVELOPER"] },
        personas: { type: "array", items: ref("PersonaState"), minItems: 2, maxItems: 2 }
      },
      ["activePersona", "personas"]
    ),
    PersonaMutationResult: objectSchema(
      {
        activePersona: { type: "string", enum: ["BUYER", "SELLER_DEVELOPER"] },
        personas: { type: "array", items: { type: "string", enum: ["BUYER", "SELLER_DEVELOPER"] } },
        onboardingStatus: { type: "string", enum: ["NOT_STARTED", "IN_PROGRESS", "COMPLETED"] },
        alreadyActivated: { type: "boolean" },
        alreadyActive: { type: "boolean" },
        nextAction: { type: "string" }
      },
      ["activePersona", "onboardingStatus", "nextAction"]
    ),
    CustomerLoginRequest: objectSchema({ identifier: { type: "string", description: "Normalized email address or E.164 phone number. Nigerian local phone numbers default to +234.", example: "customer@example.com" }, password: { type: "string", format: "password", minLength: 1, writeOnly: true } }, ["identifier", "password"]),
    ForgotCustomerPasswordRequest: objectSchema({ email: { type: "string", format: "email", description: "Trimmed and normalized to lowercase." } }, ["email"]),
    VerifyCustomerPasswordResetRequest: objectSchema({ email: { type: "string", format: "email", description: "Trimmed and normalized to lowercase." }, otp: { type: "string", pattern: "^\\d{6}$", writeOnly: true, description: "Six-digit password-reset code delivered by email." } }, ["email", "otp"]),
    ResetCustomerPasswordRequest: objectSchema({ resetToken: { type: "string", minLength: 32, writeOnly: true, description: "Short-lived, single-use proof returned after OTP verification." }, newPassword: { type: "string", format: "password", minLength: 8, pattern: "^(?=.*[A-Z])(?=.*[a-z])(?=.*\\d)(?=.*[^A-Za-z0-9]).{8,}$", writeOnly: true }, confirmPassword: { type: "string", format: "password", writeOnly: true, description: "Must match newPassword." } }, ["resetToken", "newPassword", "confirmPassword"]),
    CustomerRefreshRequest: objectSchema({ refreshToken: { type: "string", minLength: 32, writeOnly: true, description: "Current customer refresh token. Successful refresh rotates this token." } }, ["refreshToken"]),
    CustomerLogoutRequest: objectSchema({ refreshToken: { type: "string", minLength: 32, writeOnly: true, description: "Refresh token bound to the customer access-token session." } }, ["refreshToken"]),
    ChangeCustomerPasswordRequest: objectSchema({ currentPassword: { type: "string", format: "password", minLength: 1, writeOnly: true }, newPassword: { type: "string", format: "password", minLength: 8, pattern: "^(?=.*[A-Z])(?=.*[a-z])(?=.*\\d)(?=.*[^A-Za-z0-9]).{8,}$", writeOnly: true }, confirmPassword: { type: "string", format: "password", writeOnly: true, description: "Must match newPassword." } }, ["currentPassword", "newPassword", "confirmPassword"]),
    CustomerSessionResult: objectSchema({ accessToken: { type: "string", readOnly: true, description: "Short-lived customer access token." }, refreshToken: { type: "string", readOnly: true, description: "Rotating customer refresh token. Store securely." }, accessTokenExpiresIn: { type: "integer", minimum: 1, description: "Access-token lifetime in seconds." }, refreshTokenExpiresIn: { type: "integer", minimum: 1, description: "Refresh-token lifetime in seconds." } }, ["accessToken", "refreshToken", "accessTokenExpiresIn", "refreshTokenExpiresIn"]),
    CustomerLoginResult: objectSchema({ user: objectSchema({ id: uuid, fullName: { type: "string" }, email: { type: "string", format: "email" }, phone: { type: "string", nullable: true }, accountStatus: { type: "string", enum: ["ACTIVE"] }, emailVerified: { type: "boolean", enum: [true] } }, ["id", "fullName", "email", "accountStatus", "emailVerified"]), activePersona: { type: "string", enum: ["BUYER", "SELLER_DEVELOPER"] }, personas: { type: "array", items: { type: "object", properties: { type: { type: "string", enum: ["BUYER", "SELLER_DEVELOPER"] }, onboardingStatus: { type: "string", enum: ["NOT_STARTED", "IN_PROGRESS", "COMPLETED"] } }, required: ["type", "onboardingStatus"], additionalProperties: false } }, nextAction: { type: "string" }, accessToken: { type: "string", readOnly: true }, refreshToken: { type: "string", readOnly: true }, accessTokenExpiresIn: { type: "integer", minimum: 1 }, refreshTokenExpiresIn: { type: "integer", minimum: 1 } }, ["user", "activePersona", "personas", "nextAction", "accessToken", "refreshToken", "accessTokenExpiresIn", "refreshTokenExpiresIn"]),
    ForgotCustomerPasswordResult: objectSchema({ otpLength: { type: "integer", enum: [6] }, resendAvailableIn: { type: "integer", minimum: 1 }, nextAction: { type: "string", enum: ["VERIFY_PASSWORD_RESET_OTP"] } }, ["otpLength", "resendAvailableIn", "nextAction"]),
    VerifyCustomerPasswordResetResult: objectSchema({ resetToken: { type: "string", readOnly: true, description: "Short-lived single-use password-reset proof." }, expiresIn: { type: "integer", minimum: 1, description: "Reset-proof lifetime in seconds." }, nextAction: { type: "string", enum: ["SET_NEW_PASSWORD"] } }, ["resetToken", "expiresIn", "nextAction"]),
    SessionsInvalidatedResult: objectSchema({ sessionsInvalidated: { type: "boolean", enum: [true] }, nextAction: { type: "string", enum: ["LOGIN"] } }, ["sessionsInvalidated", "nextAction"]),
    UpdateProfileRequest: objectSchema({ first_name: { type: "string", minLength: 2 }, last_name: { type: "string", minLength: 2 }, phone_number: { type: "string", minLength: 7 }, bio: { type: "string", maxLength: 1000 }, street_address: { type: "string" }, city: { type: "string" }, state: { type: "string" }, country: { type: "string" }, zip_code: { type: "string" }, agency_name: { type: "string" }, company_email: { type: "string", format: "email" }, company_phone_number: { type: "string" }, company_bio: { type: "string", maxLength: 1500 }, company_street_address: { type: "string" }, company_city: { type: "string" }, company_state: { type: "string" }, company_country: { type: "string" }, company_zip_code: { type: "string" } }),
    ChangePasswordRequest: objectSchema({ new_password: { type: "string", format: "password", minLength: 8, writeOnly: true, example: "N3wStr0ngPass!" } }, ["new_password"]),
    PropertyInput: objectSchema({ title: { type: "string", minLength: 3 }, description: { type: "string", minLength: 10 }, category: { type: "string" }, property_type: { type: "string" }, property_subtype: { type: "string" }, listing_purpose: { type: "string" }, price: { type: "number", minimum: 0 }, minimum_down_payment: { type: "number", minimum: 0 }, agency_fee: { type: "number", minimum: 0 }, service_fee: { type: "number", minimum: 0 }, bedrooms: { type: "integer", minimum: 0 }, bathrooms: { type: "integer", minimum: 0 }, toilets: { type: "integer", minimum: 0 }, parking_spaces: { type: "integer", minimum: 0 }, number_of_units: { type: "integer", minimum: 0 }, land_area: { type: "number", minimum: 0 }, land_area_unit: { type: "string" }, year_built: { type: "integer" }, country: { type: "string" }, state: { type: "string" }, city: { type: "string" }, local_government: { type: "string" }, address: { type: "string" }, latitude: { type: "number" }, longitude: { type: "number" }, map_url: { type: "string" }, has_lien: { type: "boolean" }, title_document_type: { type: "string" }, amenities: { type: "array", items: { type: "string" } }, thumbnail_url: { type: "string" } }),
    CreatePropertyInput: { allOf: [ref("PropertyInput")], required: ["title", "description", "category", "property_type", "listing_purpose", "price"] },
    UpdatePropertyInput: { allOf: [ref("PropertyInput")], description: "All property fields are optional for updates." },
    CreateInquiryRequest: objectSchema({ property_id: uuid, inquiry_type: { type: "string", minLength: 2 }, full_name: { type: "string", minLength: 2 }, email: { type: "string", format: "email" }, phone_number: { type: "string", minLength: 7 }, message: { type: "string", minLength: 5 } }, ["inquiry_type", "full_name", "email", "phone_number", "message"]),
    AdminLeadStage: { type: "string", enum: ["NEW", "CONTACTED", "WON", "LOST"] },
    AdminLeadCard: objectSchema({ id: uuid, referenceId: { type: "string", example: "ENQ-1036A9C2" }, customerName: { type: "string" }, propertyId: { ...uuid, nullable: true }, propertyTitle: nullableString, propertyReferenceId: nullableString, stage: ref("AdminLeadStage"), inquiryType: { type: "string" }, receivedAt: dateTime }, ["id", "referenceId", "customerName", "stage", "inquiryType", "receivedAt"]),
    AdminLeadList: objectSchema({ counts: objectSchema({ NEW: { type: "integer", minimum: 0 }, CONTACTED: { type: "integer", minimum: 0 }, WON: { type: "integer", minimum: 0 }, LOST: { type: "integer", minimum: 0 } }, ["NEW", "CONTACTED", "WON", "LOST"]), total: { type: "integer", minimum: 0 }, items: { type: "array", items: ref("AdminLeadCard") }, perStageLimit: { type: "integer", minimum: 1, maximum: 50 }, query: nullableString }, ["counts", "total", "items", "perStageLimit", "query"]),
    AdminLeadDetail: { type: "object", description: "Operational Admin lead detail. Customer contact information is limited to the inquiry/customer profile; Seller-private documents and full addresses are excluded.", additionalProperties: true },
    UpdateAdminLeadStageRequest: objectSchema({ stage: ref("AdminLeadStage"), expectedStage: ref("AdminLeadStage") }, ["stage", "expectedStage"]),
    AdminLeadStageUpdate: objectSchema({ leadId: uuid, previousStage: ref("AdminLeadStage"), stage: ref("AdminLeadStage"), changedAt: dateTime }, ["leadId", "previousStage", "stage", "changedAt"]),
    AdminUserRole: { type: "string", enum: ["BUYER", "SELLER", "REFERRER"] },
    AdminUserCounts: objectSchema({ totalUsers: { type: "integer", minimum: 0 }, buyerProfiles: { type: "integer", minimum: 0 }, sellerProfiles: { type: "integer", minimum: 0 }, referrerProfiles: { type: "integer", minimum: 0 } }, ["totalUsers", "buyerProfiles", "sellerProfiles", "referrerProfiles"]),
    AdminUserListItem: objectSchema({ id: uuid, fullName: { type: "string" }, email: { type: "string", format: "email" }, phone: nullableString, referralCode: nullableString, verified: { type: "boolean" }, joinedAt: dateTime, roles: { type: "array", items: ref("AdminUserRole") } }, ["id", "fullName", "email", "phone", "referralCode", "verified", "joinedAt", "roles"]),
    AdminUsersDirectory: objectSchema({ counts: ref("AdminUserCounts"), items: { type: "array", items: ref("AdminUserListItem") }, pagination: ref("Pagination") }, ["counts", "items", "pagination"]),
    AdminUserProfileState: objectSchema({ activated: { type: "boolean" }, activatedAt: { ...dateTime, nullable: true } }, ["activated", "activatedAt"]),
    AdminUserDetail: { type: "object", description: "Explicit read-only Admin customer DTO containing identity and bounded Buyer, Seller, and Referrer profile state. Credentials, provider metadata, and session data are excluded.", additionalProperties: false, properties: { customer: ref("AdminUserListItem"), buyerProfile: { allOf: [ref("AdminUserProfileState")], properties: { preferredAreas: { type: "array", items: { type: "string" } }, budgetMin: { type: "number", nullable: true }, budgetMax: { type: "number", nullable: true }, currency: nullableString } }, sellerProfile: { allOf: [ref("AdminUserProfileState")], properties: { sellerType: { type: "string", enum: ["INDIVIDUAL", "BUSINESS"], nullable: true }, companyName: nullableString, companyAddress: nullableString } }, referrerProfile: { allOf: [ref("AdminUserProfileState")], properties: { referralCode: nullableString } } }, required: ["customer", "buyerProfile", "sellerProfile", "referrerProfile"] },
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
    TrackReferralRequest: { ...objectSchema({ referral_code: { type: "string", minLength: 3 }, property_id: uuid, referral_type: { type: "string", enum: ["buyer", "seller"] }, referred_name: { type: "string" }, referred_email: { type: "string", format: "email" }, referred_phone: { type: "string" }, notes: { type: "string" } }, ["referral_code", "referral_type"]), anyOf: [{ required: ["referred_email"] }, { required: ["referred_phone"] }] },
    UpdateReferralStatusRequest: objectSchema({ status: { type: "string", enum: ["pending", "qualified", "converted", "rejected"] }, earned_commission: { type: "number", minimum: 0 } }, ["status"]),
    ReferralPurpose: { type: "string", enum: ["BUYING", "SELLING"] },
    ReferralLifecycle: { type: "string", enum: ["NEW", "CONTACTED", "IN_PROGRESS", "COMPLETED", "LOST"] },
    ReferralPaymentStatus: { type: "string", enum: ["NOT_ELIGIBLE", "OUTSTANDING", "PAID"] },
    DirectReferralRequest: objectSchema({
      referrer: objectSchema({ fullName: { type: "string", minLength: 2, maxLength: 100 }, phone: { type: "string", pattern: "^\\+[1-9]\\d{7,14}$" } }, ["fullName", "phone"]),
      referred: objectSchema({ fullName: { type: "string", minLength: 2, maxLength: 100 }, contactMethod: { type: "string", enum: ["WHATSAPP", "CALL", "EMAIL"] }, phone: { type: "string", pattern: "^\\+[1-9]\\d{7,14}$" }, email: { type: "string", format: "email" } }, ["fullName", "contactMethod"]),
      purpose: ref("ReferralPurpose"), notes: { type: "string", maxLength: 600 }, privateReferrerDisclosure: { type: "boolean", default: false }, consent: { type: "boolean", enum: [true] }, referralCode: { type: "string", pattern: "^[A-Z0-9-]{5,40}$" }
    }, ["referred", "purpose", "consent"]),
    DirectReferralResult: objectSchema({ referral: objectSchema({ id: uuid, referenceId: { type: "string", example: "REF-2608-0001" }, referredFirstName: { type: "string" }, purpose: ref("ReferralPurpose"), status: ref("ReferralLifecycle"), submittedAt: dateTime }, ["id", "referenceId", "referredFirstName", "purpose", "status", "submittedAt"]), referrer: objectSchema({ referralCode: { type: "string" }, referralLink: { type: "string", format: "uri" } }, ["referralCode", "referralLink"]), nextAction: { type: "string", enum: ["OPEN_REFERRAL_DASHBOARD", "REQUEST_TRACKING_CODE"] }, trackingAvailable: { type: "boolean" } }, ["referral", "referrer", "nextAction", "trackingAvailable"]),
    ReferralContext: objectSchema({ authenticated: { type: "boolean" }, referrer: { nullable: true, allOf: [objectSchema({ fullName: { type: "string" }, referralCode: { type: "string" }, referralLink: { type: "string", format: "uri" } }, ["fullName", "referralCode", "referralLink"])] } }, ["authenticated", "referrer"]),
    ReferralLinkResolution: objectSchema({ valid: { type: "boolean", enum: [true] }, referralCode: { type: "string" } }, ["valid", "referralCode"]),
    ReferralTrackingRequestResult: objectSchema({ accepted: { type: "boolean", enum: [true] }, resendAvailableIn: { type: "integer", minimum: 1, description: "Cooldown in seconds. The same generic shape is used for known and unknown phone numbers." } }, ["accepted", "resendAvailableIn"]),
    ReferralTrackingSessionResult: objectSchema({ trackingToken: { type: "string", description: "Opaque referral-only token. The Web BFF immediately stores it in a narrow HttpOnly cookie." }, expiresIn: { type: "integer", minimum: 1, description: "Session lifetime in seconds." } }, ["trackingToken", "expiresIn"]),
    ReferralDashboardItem: objectSchema({ id: uuid, referenceId: { type: "string" }, referredName: { type: "string" }, purpose: ref("ReferralPurpose"), contactMethod: { type: "string", enum: ["WHATSAPP", "CALL", "EMAIL"] }, status: ref("ReferralLifecycle"), statusLabel: { type: "string" }, rewardAmount: { type: "number", nullable: true }, paymentStatus: ref("ReferralPaymentStatus"), submittedAt: dateTime }, ["id", "referenceId", "referredName", "purpose", "status", "statusLabel", "rewardAmount", "paymentStatus", "submittedAt"]),
    ReferralDashboard: objectSchema({ referrer: objectSchema({ fullName: { type: "string" }, referralCode: { type: "string" }, referralLink: { type: "string", format: "uri" } }, ["fullName", "referralCode", "referralLink"]), summary: objectSchema({ referralCount: { type: "integer" }, completedCount: { type: "integer" }, earnedAmount: { type: "number" }, outstandingAmount: { type: "number" } }, ["referralCount", "completedCount", "earnedAmount", "outstandingAmount"]), referrals: { type: "array", items: ref("ReferralDashboardItem") }, pagination: objectSchema({ page: { type: "integer" }, limit: { type: "integer" }, total: { type: "integer" }, totalPages: { type: "integer" } }, ["page", "limit", "total", "totalPages"]) }, ["referrer", "summary", "referrals", "pagination"]),
    ReferralTrackingRequest: objectSchema({ fullName: { type: "string", minLength: 2 }, phone: { type: "string", pattern: "^\\+[1-9]\\d{7,14}$" } }, ["fullName", "phone"]),
    ReferralTrackingVerifyRequest: objectSchema({ phone: { type: "string", pattern: "^\\+[1-9]\\d{7,14}$" }, otp: { type: "string", pattern: "^\\d{6}$", writeOnly: true } }, ["phone", "otp"]),
    ReferralPayoutRequest: objectSchema({ bankCode: { type: "string" }, accountNumber: { type: "string", pattern: "^\\d{10}$", writeOnly: true }, accountName: { type: "string", minLength: 2, maxLength: 100 } }, ["bankCode", "accountNumber", "accountName"]),
    ReferralPayoutDetails: objectSchema({ payoutDetails: { nullable: true, allOf: [objectSchema({ bankCode: { type: "string" }, bankName: { type: "string" }, accountName: { type: "string" }, maskedAccountNumber: { type: "string", example: "••••••1234" }, updatedAt: dateTime }, ["bankCode", "bankName", "accountName", "maskedAccountNumber", "updatedAt"])] } }, ["payoutDetails"]),
    ReferralBankDirectory: objectSchema({ banks: { type: "array", items: objectSchema({ code: { type: "string" }, name: { type: "string" } }, ["code", "name"]) }, authoritativeCompleteDirectory: { type: "boolean", enum: [false] }, accountNameResolutionAvailable: { type: "boolean", enum: [false] } }, ["banks", "authoritativeCompleteDirectory", "accountNameResolutionAvailable"]),
    AdminReferrerDirectory: objectSchema({
      summary: objectSchema({ totalReferrers: { type: "integer" }, totalReferrals: { type: "integer" }, completedReferrals: { type: "integer" }, earnedAmount: { type: "number" }, outstandingAmount: { type: "number" } }, ["totalReferrers", "totalReferrals", "completedReferrals", "earnedAmount", "outstandingAmount"]),
      filterCounts: objectSchema({ all: { type: "integer" }, owed: { type: "integer" }, fullyPaid: { type: "integer" } }, ["all", "owed", "fullyPaid"]),
      items: { type: "array", items: objectSchema({ id: uuid, customerId: { ...uuid, nullable: true }, fullName: { type: "string" }, phone: nullableString, email: nullableString, referralCode: { type: "string" }, joinedAt: dateTime, referralCount: { type: "integer" }, completedCount: { type: "integer" }, earnedAmount: { type: "number" }, outstandingAmount: { type: "number" }, payoutStatus: { type: "string", enum: ["ON_FILE", "MISSING", "NOT_NEEDED"] } }, ["id", "customerId", "fullName", "phone", "email", "referralCode", "joinedAt", "referralCount", "completedCount", "earnedAmount", "outstandingAmount", "payoutStatus"]) },
      pagination: ref("Pagination")
    }, ["summary", "filterCounts", "items", "pagination"]),
    AdminReferrerDetailResult: objectSchema({ referrer: objectSchema({
      identity: objectSchema({ id: uuid, customerId: { ...uuid, nullable: true }, fullName: { type: "string" }, phone: nullableString, email: nullableString, referralCode: { type: "string" }, joinedAt: dateTime, identityType: { type: "string", enum: ["CUSTOMER_LINKED", "REFERRAL_ONLY"] } }, ["id", "customerId", "fullName", "phone", "email", "referralCode", "joinedAt", "identityType"]),
      linkedCustomer: { type: "object", nullable: true, properties: { id: uuid, fullName: { type: "string" }, email: { type: "string", format: "email" } } },
      summary: objectSchema({ referrals: { type: "integer" }, completed: { type: "integer" }, earnedAmount: { type: "number" }, outstandingAmount: { type: "number" } }, ["referrals", "completed", "earnedAmount", "outstandingAmount"]),
      payout: objectSchema({ status: { type: "string", enum: ["ON_FILE", "MISSING", "NOT_NEEDED"] }, bankName: nullableString, accountName: nullableString, maskedAccountNumber: nullableString, updatedAt: { ...dateTime, nullable: true } }, ["status", "bankName", "accountName", "maskedAccountNumber", "updatedAt"]),
      referrals: { type: "array", items: objectSchema({ id: uuid, referenceId: { type: "string" }, referredFullName: { type: "string" }, purpose: ref("ReferralPurpose"), createdAt: dateTime, completedAt: { ...dateTime, nullable: true }, lifecycleStatus: ref("ReferralLifecycle"), rewardAmount: { type: "number", nullable: true }, paymentStatus: ref("ReferralPaymentStatus"), payment: { type: "object", nullable: true, description: "Safe payment and receipt metadata only; no storage provider identifier or persistent URL." } }, ["id", "referenceId", "referredFullName", "purpose", "createdAt", "completedAt", "lifecycleStatus", "rewardAmount", "paymentStatus", "payment"]) }
    }, ["identity", "linkedCustomer", "summary", "payout", "referrals"]) }, ["referrer"]),
    AdminReferralPaymentPreparationResult: objectSchema({ payment: objectSchema({ referrer: objectSchema({ id: uuid, fullName: { type: "string" } }, ["id", "fullName"]), referral: objectSchema({ id: uuid, referenceId: { type: "string" }, referredFullName: { type: "string" } }, ["id", "referenceId", "referredFullName"]), amount: { type: "number" }, payout: objectSchema({ bankName: { type: "string" }, accountName: { type: "string" }, accountNumber: { type: "string", writeOnly: true, description: "Decrypted only on demand for an eligible Admin payment workflow. This response is no-store." } }, ["bankName", "accountName", "accountNumber"]) }, ["referrer", "referral", "amount", "payout"]) }, ["payment"]),
    AdminReferralPaymentResult: objectSchema({ payment: objectSchema({ id: uuid, referralId: uuid, referrerId: uuid, referenceId: { type: "string" }, amount: { type: "number" }, status: { type: "string", enum: ["PAID"] }, paidAt: dateTime, recordedByAdminId: uuid }, ["id", "referralId", "referrerId", "referenceId", "amount", "status", "paidAt", "recordedByAdminId"]) }, ["payment"]),
    AdminReferralReceiptAccessResult: objectSchema({ access: objectSchema({ url: { type: "string", format: "uri" }, expiresAt: dateTime, fileName: { type: "string" }, mimeType: { type: "string", enum: ["application/pdf", "image/png", "image/jpeg"] } }, ["url", "expiresAt", "fileName", "mimeType"]) }, ["access"]),
    UpdateUserStatusRequest: objectSchema({ is_active: { type: "boolean" } }, ["is_active"]),
    VerifyUserRequest: objectSchema({ verification_status: { type: "string", enum: ["pending", "verified", "rejected"] } }, ["verification_status"]),
    RejectPropertyRequest: objectSchema({ rejection_reason: { type: "string", minLength: 3 } }, ["rejection_reason"]),
    CreateAdminUserRequest: objectSchema({ first_name: { type: "string", minLength: 2 }, last_name: { type: "string", minLength: 2 }, email: { type: "string", format: "email" }, phone_number: { type: "string" }, password: { type: "string", format: "password", minLength: 8, writeOnly: true }, role: { type: "string", enum: ["admin", "support_agent"] } }, ["first_name", "last_name", "email", "password", "role"]),
    UpdateUserRoleRequest: objectSchema({ role: { type: "string", enum: ["investor", "property_developer", "landlord", "registered_agent", "freelance_agent", "admin", "support_agent"] } }, ["role"])
  }
};

const customerAccessErrors: NonNullable<Endpoint["errorResponses"]> = {
  "403": {
    description: "The token is not for a verified, active customer account",
    message: "Account verification is required",
    code: "ACCOUNT_VERIFICATION_REQUIRED",
    examples: {
      unverified: {
        summary: "Email verification is still required",
        message: "Account verification is required",
        code: "ACCOUNT_VERIFICATION_REQUIRED"
      },
      suspended: {
        summary: "Customer account is suspended",
        message: "Account is suspended",
        code: "ACCOUNT_SUSPENDED"
      },
      customerOnly: {
        summary: "Admin or non-customer token rejected",
        message: "Customer access is required",
        code: "CUSTOMER_ACCESS_REQUIRED"
      }
    }
  },
  "423": {
    description: "The customer account is locked",
    message: "Account is locked",
    code: "ACCOUNT_LOCKED"
  },
  "503": {
    description: "Customer onboarding storage or authorization is unavailable",
    message: "Customer onboarding is temporarily unavailable",
    code: "ONBOARDING_UNAVAILABLE"
  }
};

const endpoints: Endpoint[] = [
  { method: "get", path: "/admin/leads", tag: "Admin Lead Management", summary: "List operational inquiry leads by stage", description: "Isolated Admin-session operation for ADMIN and SUPER_ADMIN. Returns database-authoritative counts and a bounded newest-first set per NEW, CONTACTED, WON, and LOST stage. Optional q search is parameterized and matches customer name, property title/reference, inquiry UUID, or deterministic enquiry reference.", successMessage: "Admin leads fetched successfully", responseSchema: "AdminLeadList", security: "required", roles: ["ADMIN", "SUPER_ADMIN"], query: [queryParameter("q", "Trimmed lead search; blank means no filter.", { type: "string", maxLength: 120 }), queryParameter("limit", "Maximum cards returned per stage.", { type: "integer", minimum: 1, maximum: 50, default: 20 })], errorResponses: { "400": { description: "Invalid search or per-stage limit", message: "Invalid lead search or limit", code: "INVALID_LEAD_FILTER" }, "503": { description: "Lead persistence unavailable", message: "Lead management is temporarily unavailable", code: "LEADS_UNAVAILABLE" } } },
  { method: "get", path: "/admin/users", tag: "Admin Users", summary: "List the read-only customer directory", description: "Isolated Admin-session operation for ADMIN and SUPER_ADMIN. Searches canonical customer profiles server-side and returns authoritative activated-profile counts, bounded safe DTOs, deterministic sorting, and pagination. No mutation actions are available.", successMessage: "Admin users fetched successfully", responseSchema: "AdminUsersDirectory", security: "required", roles: ["ADMIN", "SUPER_ADMIN"], query: [...paginationParameters, queryParameter("q", "Trimmed name, email, or phone search; blank means no filter.", { type: "string", maxLength: 120 }), queryParameter("role", "Activated profile filter.", { type: "string", enum: ["BUYER", "SELLER", "REFERRER"] }), queryParameter("verification", "Canonical email verification filter.", { type: "string", enum: ["VERIFIED", "UNVERIFIED"] }), queryParameter("sort", "Deterministic directory order.", { type: "string", enum: ["MOST_RECENT", "OLDEST", "NAME_ASC", "NAME_DESC"], default: "MOST_RECENT" })], errorResponses: { "400": { description: "Invalid filter, sort, or pagination", message: "Invalid user filter", code: "INVALID_USER_FILTER", examples: { sort: { summary: "Unsupported sort", message: "Invalid user sort", code: "INVALID_USER_SORT" } } }, "503": { description: "Customer directory persistence unavailable", message: "Customer directory is temporarily unavailable", code: "USERS_UNAVAILABLE" } } },
  { method: "get", path: "/admin/users/{userId}", tag: "Admin Users", summary: "Get read-only customer profile detail", description: "Returns bounded customer identity and canonical Buyer, Seller, and Referrer activation data. Uses email_verified_at for verification and onboarding_completed_at for Buyer/Seller activation dates. No customer credentials, tokens, provider metadata, or mutations are exposed.", successMessage: "Admin user fetched successfully", responseSchema: "AdminUserDetail", security: "required", roles: ["ADMIN", "SUPER_ADMIN"], pathParams: [{ name: "userId", description: "Canonical customer profile UUID." }], errorResponses: { "404": { description: "Customer does not exist in the canonical customer directory", message: "Customer not found", code: "ADMIN_USER_NOT_FOUND" }, "503": { description: "Customer profile persistence unavailable", message: "Customer directory is temporarily unavailable", code: "USERS_UNAVAILABLE" } } },
  { method: "get", path: "/admin/referrers", tag: "Admin Referrers", summary: "List referrers and authoritative reward totals", description: "Isolated ADMIN and SUPER_ADMIN operation. Searches canonical customer-linked and referral-only identities by name, code, phone, or email; filters by owed/fully-paid state; and returns server-derived referral, completed, earned, and outstanding totals. Earned and outstanding amounts come only from canonical completed referral rewards, never property percentages.", successMessage: "Admin referrers fetched successfully", responseSchema: "AdminReferrerDirectory", security: "required", roles: ["ADMIN", "SUPER_ADMIN"], query: [...paginationParameters, queryParameter("q", "Trimmed name, referral code, phone, or linked email search.", { type: "string", maxLength: 120 }), queryParameter("payment", "Payment-state filter.", { type: "string", enum: ["ALL", "OWED", "FULLY_PAID"], default: "ALL" }), queryParameter("sort", "Deterministic directory order.", { type: "string", enum: ["MOST_RECENT", "OLDEST", "NAME_ASC", "MOST_OWED", "MOST_EARNED"], default: "MOST_RECENT" })], errorResponses: { "400": { description: "Invalid filter, sort, search, or pagination", message: "Invalid referrer directory filters", code: "INVALID_REFERRER_FILTER" }, "503": { description: "Admin referral persistence unavailable", message: "Admin referrers are temporarily unavailable", code: "ADMIN_REFERRERS_UNAVAILABLE" } } },
  { method: "get", path: "/admin/referrers/{referrerId}", tag: "Admin Referrers", summary: "Get a referrer and referral history", description: "Returns safe referrer identity, linked-customer navigation when applicable, authoritative totals, masked payout details, referral lifecycle, and safe payment receipt metadata. Full bank account numbers, ciphertext, receipt provider IDs, and persistent receipt URLs are excluded.", successMessage: "Admin referrer fetched successfully", responseSchema: "AdminReferrerDetailResult", security: "required", roles: ["ADMIN", "SUPER_ADMIN"], pathParams: [{ name: "referrerId", description: "Canonical referrer UUID." }], errorResponses: { "404": { description: "Canonical referrer not found", message: "Referrer not found", code: "REFERRER_NOT_FOUND" }, "503": { description: "Admin referral persistence unavailable", message: "Admin referrers are temporarily unavailable", code: "ADMIN_REFERRERS_UNAVAILABLE" } } },
  { method: "get", path: "/admin/referrers/{referrerId}/referrals/{referralId}/payment-preparation", tag: "Admin Referrer Payments", summary: "Prepare one eligible referral payment", description: "Protected no-store operation that revalidates the completed OUTSTANDING reward and payout record, then decrypts the bank account only for the payment modal. Amount is canonical and cannot be supplied by the client.", successMessage: "Payment details prepared", responseSchema: "AdminReferralPaymentPreparationResult", security: "required", roles: ["ADMIN", "SUPER_ADMIN"], pathParams: [{ name: "referrerId", description: "Canonical referrer UUID." }, { name: "referralId", description: "Canonical referral UUID belonging to the referrer." }], errorResponses: { "404": { description: "Referrer or referral not found", message: "Referral not found", code: "REFERRAL_NOT_FOUND" }, "409": { description: "Referral is not payable, already paid, or lacks payout details", message: "Referral is not eligible for payment", code: "REFERRAL_NOT_PAYABLE", examples: { paid: { summary: "Already paid", message: "Referral has already been paid", code: "REFERRAL_ALREADY_PAID" }, payout: { summary: "Payout missing", message: "Referrer payout details are required", code: "PAYOUT_DETAILS_REQUIRED" } } }, "503": { description: "Admin referral persistence unavailable", message: "Admin referrers are temporarily unavailable", code: "ADMIN_REFERRERS_UNAVAILABLE" } } },
  { method: "post", path: "/admin/referrers/{referrerId}/referrals/{referralId}/mark-paid", tag: "Admin Referrer Payments", summary: "Atomically record an eligible referral payment", description: "Requires one genuine PDF, PNG, or JPEG receipt up to 10MB. The database locks and revalidates the referral, derives amount from its completed reward, derives Admin identity from the isolated session, creates the server timestamp, records one PAID audit row, and rejects duplicate or stale requests. The authenticated private receipt is deleted if database recording fails.", successMessage: "Referral payment recorded successfully", responseSchema: "AdminReferralPaymentResult", security: "required", roles: ["ADMIN", "SUPER_ADMIN"], pathParams: [{ name: "referrerId", description: "Canonical referrer UUID." }, { name: "referralId", description: "Canonical referral UUID belonging to the referrer." }], multipart: { field: "receipt", contentType: "application/pdf, image/png, image/jpeg", description: "Required PDF, PNG, or JPG payment receipt or bank confirmation, maximum 10MB." }, errorResponses: { "400": { description: "Receipt is missing, unsupported, oversized, or has invalid file bytes", message: "Payment receipt file is invalid", code: "PAYMENT_RECEIPT_INVALID", examples: { missing: { summary: "Receipt absent", message: "Payment receipt is required", code: "PAYMENT_RECEIPT_REQUIRED" } } }, "404": { description: "Referrer or referral not found", message: "Referral not found", code: "REFERRAL_NOT_FOUND" }, "409": { description: "Referral is not payable, already paid, or lacks payout details", message: "Referral is not eligible for payment", code: "REFERRAL_NOT_PAYABLE", examples: { paid: { summary: "Already paid", message: "Referral has already been paid", code: "REFERRAL_ALREADY_PAID" }, payout: { summary: "Payout missing", message: "Referrer payout details are required", code: "PAYOUT_DETAILS_REQUIRED" } } }, "503": { description: "Private upload or atomic payment recording failed", message: "Referral payment could not be recorded", code: "REFERRAL_PAYMENT_FAILED" } } },
  { method: "get", path: "/admin/referrers/{referrerId}/referrals/{referralId}/payment/receipt/access", tag: "Admin Referrer Payments", summary: "Create short-lived payment receipt access", description: "Revalidates the receipt belongs to the referrer's paid referral and returns a five-minute authenticated signed URL. Persistent URLs and Cloudinary public IDs are never exposed.", successMessage: "Payment receipt access created", responseSchema: "AdminReferralReceiptAccessResult", security: "required", roles: ["ADMIN", "SUPER_ADMIN"], pathParams: [{ name: "referrerId", description: "Canonical referrer UUID." }, { name: "referralId", description: "Canonical paid referral UUID." }], errorResponses: { "404": { description: "Referral or receipt not found", message: "Payment receipt access failed", code: "PAYMENT_RECEIPT_ACCESS_FAILED" }, "503": { description: "Signed receipt access generation failed", message: "Payment receipt access failed", code: "PAYMENT_RECEIPT_ACCESS_FAILED" } } },
  { method: "get", path: "/admin/leads/{leadId}", tag: "Admin Lead Management", summary: "Get operational lead detail", description: "Returns Admin-only customer operational contact information, personas, plain-text inquiry message, safe interested-property summary, Seller display identity when legitimately available, and stage history. Customer credentials, private property address, documents, and provider identifiers are excluded.", successMessage: "Admin lead fetched successfully", responseSchema: "AdminLeadDetail", security: "required", roles: ["ADMIN", "SUPER_ADMIN"], pathParams: [{ name: "leadId", description: "Canonical inquiry UUID." }], notFoundMessage: "Lead not found", errorResponses: { "503": { description: "Lead persistence unavailable", message: "Lead management is temporarily unavailable", code: "LEADS_UNAVAILABLE" } } },
  { method: "patch", path: "/admin/leads/{leadId}/stage", tag: "Admin Lead Management", summary: "Transition a lead stage", description: "Concurrency-safe Admin transition using the expected current stage. Supports NEW to CONTACTED and CONTACTED to WON or LOST. The authenticated Admin identity and server timestamp are recorded in immutable history; the legacy inquiry status is preserved.", successMessage: "Lead stage updated successfully", responseSchema: "AdminLeadStageUpdate", bodySchema: "UpdateAdminLeadStageRequest", security: "required", roles: ["ADMIN", "SUPER_ADMIN"], pathParams: [{ name: "leadId", description: "Canonical inquiry UUID." }], errorResponses: { "400": { description: "Unknown fields or stage", message: "Validation failed", code: "INVALID_LEAD_STAGE_REQUEST" }, "409": { description: "Stale expected stage or disallowed lifecycle transition", message: "This lead stage transition is not allowed", code: "INVALID_LEAD_TRANSITION", examples: { stale: { summary: "Concurrent stage update", message: "Lead stage changed before this update", code: "LEAD_STAGE_CONFLICT", details: { currentStage: "CONTACTED" } } } }, "503": { description: "Atomic stage transition unavailable", message: "Lead stage could not be updated", code: "LEAD_UPDATE_FAILED" } } },
  { method: "get", path: "/marketplace/properties", tag: "Marketplace Public Search", summary: "Search LIVE Marketplace properties", description: "Public Buyer-safe LIVE property-card search. A valid optional customer session enriches saved state with one canonical saved_properties query; anonymous cards return saved=false. All filters run in the database and private Seller, document, review, and provider data are excluded.", successMessage: "Marketplace properties fetched successfully", responseSchema: "MarketplacePublicPropertyList", security: "optional", query: [...paginationParameters, queryParameter("q", "Case-insensitive title, description, publicLocation, and propertyType search. Blank values are ignored."), queryParameter("location", "Case-insensitive publicLocation filter only."), queryParameter("minPrice", "Minimum asking price.", { type: "number", minimum: 0 }), queryParameter("maxPrice", "Maximum asking price.", { type: "number", minimum: 0 }), queryParameter("propertyType", "One property type or a comma-separated list, for example APARTMENT,DUPLEX."), queryParameter("category", "Exact Marketplace category.", { type: "string", enum: ["RESIDENTIAL", "COMMERCIAL"] }), queryParameter("condition", "One condition or a comma-separated list.", { type: "string", enum: ["NEWLY_BUILT", "OFF_PLAN", "UNDER_CONSTRUCTION", "FAIRLY_USED"] }), queryParameter("furnishing", "One furnishing state or a comma-separated list.", { type: "string", enum: ["FULLY_FURNISHED", "UNFURNISHED", "SEMI_FURNISHED"] }), queryParameter("bedrooms", "Exact bedroom count from 1-4, or 5+ for at least five bedrooms.", { type: "string", enum: ["1", "2", "3", "4", "5+"] }), queryParameter("sort", "Deterministic Marketplace ordering.", { type: "string", enum: ["DEFAULT", "PRICE_HIGH_TO_LOW", "PRICE_LOW_TO_HIGH", "BEDS", "MOST_RECENT"], default: "DEFAULT" })], errorResponses: { "400": { description: "Filter, price range, sort, page, or limit validation failed", message: "Invalid Marketplace search filters", code: "INVALID_MARKETPLACE_FILTER" }, "503": { description: "Marketplace or saved-state persistence is unavailable", message: "Marketplace is temporarily unavailable", code: "MARKETPLACE_UNAVAILABLE" } } },
  { method: "get", path: "/marketplace/properties/{propertyId}", tag: "Marketplace Public Search", summary: "Get a LIVE Marketplace property", description: "Public anonymous Buyer-safe detail for marketplace_status=LIVE only. An optional valid customer bearer session enriches saved from canonical saved_properties; an absent token returns saved=false, while malformed, invalid, or expired supplied credentials are rejected. Images are deduplicated and ordered by persisted sort_order with cover state retained. Only publicLocation, normalized amenities, persisted deposit terms, the authoritative LIVE verified state, and safe property data are returned. fullAddress, Seller identity/contact, documents and provider metadata, mandates/commission, Admin/review/rejection data, and private submission metadata are excluded.", successMessage: "Marketplace property fetched successfully", responseSchema: "MarketplacePublicPropertyDetailResult", security: "optional", pathParams: [{ name: "propertyId", description: "Canonical Marketplace property UUID." }], errorResponses: { "401": { description: "A supplied optional customer credential is malformed, invalid, expired, or inactive", message: "Invalid authentication token", code: "INVALID_ACCESS_TOKEN" }, "404": { description: "Property is absent or is not authoritative Marketplace LIVE", message: "Marketplace property not found", code: "MARKETPLACE_PROPERTY_NOT_FOUND" }, "503": { description: "Marketplace detail or saved-state persistence is unavailable", message: "Marketplace is temporarily unavailable", code: "MARKETPLACE_UNAVAILABLE", examples: { savedState: { summary: "Saved-state lookup unavailable", message: "Saved property state is temporarily unavailable", code: "SAVED_PROPERTY_UNAVAILABLE" } } } } },
  { method: "post", path: "/marketplace/properties/{propertyId}/interest", tag: "Marketplace Buyer Interest", summary: "Express interest in a LIVE Marketplace property", description: "Verified active customer-session operation using the canonical inquiries domain. Any customer may express interest regardless of active Buyer/Seller persona. The route and database query enforce marketplace_status=LIVE; legacy approved/is_published flags cannot bypass it. contactMethod must be WHATSAPP, CALL, or EMAIL and must exist on the authenticated profile; customer IDs and contact values are never accepted from the body. message is optional, trimmed, and limited to 1000 characters. The response excludes Buyer contact values, Seller identity/contact, fullAddress, documents, mandates, and review data. No response-time or follow-up SLA is promised. Explicit later submissions are allowed by the inquiry domain, while a per-customer/property one-minute write limiter suppresses immediate duplicate retries.", successStatus: 201, successMessage: "Interest submitted successfully", responseSchema: "MarketplaceInterestResult", security: "required", pathParams: [{ name: "propertyId", description: "Canonical LIVE Marketplace property UUID." }], bodySchema: "MarketplaceInterestRequest", errorResponses: { "400": { description: "Unknown contact method, oversized message, or disallowed request fields", message: "Invalid interest request", code: "INVALID_CONTACT_METHOD", examples: { contactMethod: { summary: "Unknown contact method", message: "Invalid interest request", code: "INVALID_CONTACT_METHOD" }, message: { summary: "Message exceeds 1000 characters", message: "Invalid interest request", code: "INVALID_INTEREST_MESSAGE" } } }, "404": { description: "Property is missing or not authoritative Marketplace LIVE", message: "Property is not available", code: "PROPERTY_NOT_AVAILABLE" }, "409": { description: "The authenticated profile lacks the selected contact channel", message: "Preferred contact method is unavailable", code: "CONTACT_METHOD_UNAVAILABLE" }, "429": { description: "Immediate repeat submission for the same customer and property", message: "Please wait before submitting interest in this property again", code: "RATE_LIMIT_EXCEEDED" }, "503": { description: "Profile, inquiry, or property persistence is unavailable", message: "Interest submission is temporarily unavailable", code: "INTEREST_SUBMISSION_FAILED", examples: { persistence: { summary: "Interest persistence unavailable", message: "Interest submission is temporarily unavailable", code: "INTEREST_SUBMISSION_FAILED" }, inquiry: { summary: "Inquiry domain unavailable", message: "Inquiry service is temporarily unavailable", code: "INQUIRY_UNAVAILABLE" } } } } },
  { method: "post", path: "/marketplace/seller/properties/{propertyId}/reopen", tag: "Marketplace Seller Management", summary: "Reopen a rejected listing for correction", description: "Verified Seller-owner operation that atomically changes only REJECTED to DRAFT and returns REVIEW as the neutral correction step. The latest Seller-safe rejection reason, rejected/reviewed timestamps, prior submission timestamp, photos, documents, accepted mandate, and Admin decision history are preserved. Existing DRAFT mutation and review operations become available again. Client timestamps and reviewer identity are never accepted.", successMessage: "Rejected listing reopened successfully", responseSchema: "MarketplaceReopenResult", security: "required", roles: ["SELLER_DEVELOPER"], pathParams: [{ name: "propertyId", description: "Seller-owned rejected Marketplace property UUID." }], forbiddenMessage: "Seller persona is required", notFoundMessage: "Property not found", errorResponses: { "409": { description: "Property is not REJECTED or was already reopened", message: "Only rejected listings can be reopened", code: "LISTING_NOT_REJECTED", examples: { alreadyReopened: { summary: "Duplicate reopen", message: "Listing has already been reopened", code: "LISTING_ALREADY_REOPENED" }, wrongState: { summary: "DRAFT, IN_REVIEW, or LIVE", message: "Only rejected listings can be reopened", code: "LISTING_NOT_REJECTED" } } }, "503": { description: "Atomic reopen unavailable", message: "Listing reopen failed", code: "LISTING_REOPEN_FAILED" } } },
  { method: "get", path: "/admin/marketplace/properties", tag: "Admin Marketplace Review", summary: "List the Admin Marketplace review queue", description: "Isolated Admin-session operation for ADMIN and SUPER_ADMIN. Searches title, reference, Seller identity/company, and public location in the database; supports lifecycle, category and mandate filters, deterministic server sorting and pagination, and authoritative status counts. DRAFT listings are excluded. Customer bearer tokens are not accepted.", successMessage: "Marketplace review queue fetched successfully", responseSchema: "AdminMarketplaceReviewQueue", security: "required", roles: ["ADMIN", "SUPER_ADMIN"], query: [...paginationParameters, queryParameter("status", "Admin review lifecycle filter; defaults to IN_REVIEW.", { type: "string", enum: ["ALL", "IN_REVIEW", "LIVE", "REJECTED"], default: "IN_REVIEW" }), queryParameter("q", "Trimmed title, reference, Seller name/company, or public-location search.", { type: "string", maxLength: 120 }), queryParameter("category", "Canonical property category.", { type: "string", enum: ["RESIDENTIAL", "COMMERCIAL"] }), queryParameter("mandate", "Accepted sales mandate type.", { type: "string", enum: ["EXCLUSIVE", "OPEN"] }), queryParameter("sort", "Server-side queue ordering. OPERATIONAL keeps pending review oldest-submitted-first.", { type: "string", enum: ["OPERATIONAL", "MOST_RECENT", "OLDEST", "PRICE_HIGH", "PRICE_LOW"], default: "OPERATIONAL" })], errorResponses: { "400": { description: "Unknown filter, sort, or invalid pagination", message: "Invalid review queue filter or pagination", code: "INVALID_REVIEW_QUEUE_FILTER" }, "503": { description: "Review persistence unavailable", message: "Marketplace review queue is temporarily unavailable", code: "MARKETPLACE_REVIEW_UNAVAILABLE" } } },
  { method: "get", path: "/admin/marketplace/properties/{propertyId}", tag: "Admin Marketplace Review", summary: "Get complete operational listing review detail", description: "Admin-only operational detail with Seller identity, private full address, ordered photos, safe document metadata, accepted mandate state, rejection feedback, and immutable review history. Provider identifiers are never returned.", successMessage: "Marketplace review fetched successfully", responseSchema: "AdminMarketplaceReviewDetailResult", security: "required", roles: ["ADMIN", "SUPER_ADMIN"], pathParams: [{ name: "propertyId", description: "Marketplace property UUID." }], notFoundMessage: "Marketplace listing not found" },
  { method: "get", path: "/admin/marketplace/properties/{propertyId}/documents/{documentId}/access", tag: "Admin Marketplace Review", summary: "Create short-lived private document access", description: "Admin-only access to a supporting document belonging to this property. Returns a signed authenticated Cloudinary raw-delivery URL that expires after five minutes; persistent URLs and provider public IDs are not exposed.", successMessage: "Secure document access created successfully", responseSchema: "AdminMarketplaceDocumentAccessResult", security: "required", roles: ["ADMIN", "SUPER_ADMIN"], pathParams: [{ name: "propertyId", description: "Marketplace property UUID." }, { name: "documentId", description: "Private document UUID." }], errorResponses: { "404": { description: "Document does not belong to the property", message: "Property document not found", code: "MARKETPLACE_DOCUMENT_NOT_FOUND" }, "503": { description: "Signed access generation unavailable", message: "Document access is temporarily unavailable", code: "MARKETPLACE_DOCUMENT_ACCESS_FAILED" } } },
  { method: "post", path: "/admin/marketplace/properties/{propertyId}/approve", tag: "Admin Marketplace Review", summary: "Approve and publish an in-review listing", description: "Atomically locks and revalidates the IN_REVIEW listing, its 1-10 ordered photos with one cover, and accepted ownership-confirmed mandate before transitioning it to LIVE. Records server timestamps, authenticated Admin reviewer, and immutable review history. No client-supplied reviewer or timestamp is accepted.", successMessage: "Marketplace listing approved successfully", responseSchema: "AdminMarketplaceReviewDecision", security: "required", roles: ["ADMIN", "SUPER_ADMIN"], pathParams: [{ name: "propertyId", description: "IN_REVIEW Marketplace property UUID." }], errorResponses: { "409": { description: "Listing is not reviewable, already reviewed, or no longer complete", message: "Listing is not in review", code: "LISTING_NOT_IN_REVIEW", examples: { duplicate: { summary: "Already reviewed", message: "Listing has already been reviewed", code: "LISTING_ALREADY_REVIEWED" }, incomplete: { summary: "Atomic revalidation failed", message: "Listing no longer meets approval requirements", code: "LISTING_APPROVAL_FAILED", details: { missingFields: ["coverImage"] } } } }, "503": { description: "Atomic approval unavailable", message: "Listing approval failed", code: "LISTING_APPROVAL_FAILED" } } },
  { method: "post", path: "/admin/marketplace/properties/{propertyId}/reject", tag: "Admin Marketplace Review", summary: "Reject an in-review listing with feedback", description: "Atomically transitions only IN_REVIEW to REJECTED, records the authenticated Admin reviewer and server timestamp, persists Seller-visible feedback and immutable review history. Seller resubmission is outside this slice.", successMessage: "Marketplace listing rejected successfully", responseSchema: "AdminMarketplaceReviewDecision", bodySchema: "AdminMarketplaceRejectRequest", security: "required", roles: ["ADMIN", "SUPER_ADMIN"], pathParams: [{ name: "propertyId", description: "IN_REVIEW Marketplace property UUID." }], errorResponses: { "400": { description: "Reason is missing or outside 3-1000 characters", message: "Validation failed", code: "REJECTION_REASON_INVALID" }, "409": { description: "Listing is not in review or was already reviewed", message: "Listing is not in review", code: "LISTING_NOT_IN_REVIEW", examples: { duplicate: { summary: "Already reviewed", message: "Listing has already been reviewed", code: "LISTING_ALREADY_REVIEWED" } } }, "503": { description: "Atomic rejection unavailable", message: "Listing rejection failed", code: "LISTING_REJECTION_FAILED" } } },
  { method: "get", path: "/marketplace/seller/properties/{propertyId}/review", tag: "Marketplace Review", summary: "Get the Seller-owned Step 4 review", description: "Returns an owned editable DRAFT as a buyer-facing preview plus clearly separated Seller-private fullAddress, safe mandate state, and final completeness indicators. Images are ordered and provider/document metadata is never exposed.", successMessage: "Property review fetched successfully", responseSchema: "MarketplacePropertyReviewResult", security: "required", roles: ["SELLER_DEVELOPER"], pathParams: [{ name: "propertyId", description: "Property draft UUID." }], forbiddenMessage: "Seller persona is required", notFoundMessage: "Property draft not found" },
  { method: "post", path: "/marketplace/seller/properties/{propertyId}/submit", tag: "Marketplace Review", summary: "Submit or resubmit a complete property for review", description: "Seller-only owner operation for an editable DRAFT, including a rejected listing previously reopened for correction. Atomically revalidates required property information, 1-10 persistently ordered photos with exactly one cover, and the preserved accepted ownership-confirmed sales mandate, then changes DRAFT to IN_REVIEW and replaces submittedAt with a new server timestamp. Prior rejection reason/timestamps and Admin decision history remain intact. Supporting documents are optional. Duplicate requests cannot create duplicate review decisions. No review SLA is promised.", successMessage: "Property submitted for review successfully", responseSchema: "MarketplaceSubmissionResult", security: "required", roles: ["SELLER_DEVELOPER"], pathParams: [{ name: "propertyId", description: "Initial or reopened corrected property DRAFT UUID." }], forbiddenMessage: "Seller persona is required", notFoundMessage: "Property draft not found", errorResponses: { "400": { description: "Required property, photo, or mandate state is incomplete", message: "Property listing is incomplete", code: "LISTING_SUBMISSION_INCOMPLETE", examples: { incomplete: { summary: "Incomplete listing", message: "Property listing is incomplete", code: "LISTING_SUBMISSION_INCOMPLETE", details: { missingSections: ["PROPERTY_INFORMATION", "PHOTOS", "SALES_MANDATE"], missingFields: ["title", "images", "mandate"] } } } }, "409": { description: "The listing was already submitted or is otherwise not editable", message: "Property listing has already been submitted", code: "LISTING_ALREADY_SUBMITTED", examples: { duplicate: { summary: "Duplicate submission", message: "Property listing has already been submitted", code: "LISTING_ALREADY_SUBMITTED" }, notEditable: { summary: "Non-editable lifecycle", message: "Property is not editable", code: "PROPERTY_NOT_EDITABLE" } } }, "503": { description: "The atomic initial submission or resubmission transaction is unavailable", message: "Property submission is temporarily unavailable", code: "LISTING_SUBMISSION_FAILED" } } },
  { method: "get", path: "/marketplace/seller/properties/{propertyId}/management", tag: "Marketplace Seller Management", summary: "Get Seller-owned property management details", description: "Returns status-aware owner-only management data for DRAFT, IN_REVIEW, LIVE, or REJECTED properties. Private fullAddress and safe document/mandate summaries are allowed, but provider identifiers and document URLs are excluded. No review SLA or unavailable publication/rejection timestamps are fabricated.", successMessage: "Seller property management details fetched successfully", responseSchema: "MarketplaceSellerManagementResult", security: "required", roles: ["SELLER_DEVELOPER"], pathParams: [{ name: "propertyId", description: "Marketplace property UUID." }], forbiddenMessage: "Seller persona is required", notFoundMessage: "Property not found", errorResponses: { "503": { description: "Seller management persistence is unavailable", message: "Property management is temporarily unavailable", code: "PROPERTY_MANAGEMENT_UNAVAILABLE" } } },
  { method: "put", path: "/marketplace/seller/properties/{propertyId}/mandate", tag: "Marketplace Sales Mandate", summary: "Save the Seller sales mandate", description: "Creates or updates the single current sales mandate for an owned editable DRAFT. EXCLUSIVE and OPEN are supported. Acceptance requires explicit ownership confirmation; acceptedAt is generated server-side. Agreement version and commission terms are authoritative server-controlled values and remain null until Product/legal configuration is approved. Saving does not submit the property for review or advance beyond SALES_MANDATE.", successMessage: "Sales mandate saved successfully", responseSchema: "MarketplaceSalesMandateResult", security: "required", roles: ["SELLER_DEVELOPER"], pathParams: [{ name: "propertyId", description: "Property draft UUID." }], bodySchema: "MarketplaceSalesMandateRequest", forbiddenMessage: "Seller persona is required", notFoundMessage: "Property draft not found", errorResponses: { "400": { description: "Mandate type, Seller name, or explicit ownership/acceptance validation failed", message: "Validation failed", code: "INVALID_MANDATE_TYPE", examples: { ownership: { summary: "Acceptance without ownership confirmation", message: "Validation failed", code: "MANDATE_OWNERSHIP_CONFIRMATION_REQUIRED" }, invalidType: { summary: "Unknown mandate type", message: "Validation failed", code: "INVALID_MANDATE_TYPE" } } }, "503": { description: "Mandate persistence is unavailable", message: "Sales mandate is temporarily unavailable", code: "MANDATE_UNAVAILABLE" } } },
  { method: "get", path: "/marketplace/seller/properties/{propertyId}/mandate", tag: "Marketplace Sales Mandate", summary: "Get the current Seller sales mandate", description: "Returns the authenticated Seller's safe resumable mandate state for an owned editable DRAFT. Commission and agreement values are returned only from authoritative server configuration. No legal agreement text or unrelated legacy mandate fields are exposed.", successMessage: "Sales mandate fetched successfully", responseSchema: "MarketplaceSalesMandateResult", security: "required", roles: ["SELLER_DEVELOPER"], pathParams: [{ name: "propertyId", description: "Property draft UUID." }], forbiddenMessage: "Seller persona is required", notFoundMessage: "Sales mandate not found", errorResponses: { "404": { description: "The property has no current Marketplace sales mandate", message: "Sales mandate not found", code: "MANDATE_NOT_FOUND" }, "503": { description: "Mandate persistence is unavailable", message: "Sales mandate is temporarily unavailable", code: "MANDATE_UNAVAILABLE" } } },
  { method: "post", path: "/marketplace/seller/properties/{propertyId}/documents", tag: "Marketplace Draft Documents", summary: "Upload a private supporting document", description: "Seller-only upload to an owned editable DRAFT. The document field accepts one valid PDF up to 10MB. Files use authenticated Cloudinary raw delivery; only safe metadata is returned, never provider URLs or IDs.", successStatus: 201, successMessage: "Property document uploaded successfully", responseSchema: "MarketplaceDocumentUploadResult", security: "required", roles: ["SELLER_DEVELOPER"], pathParams: [{ name: "propertyId", description: "Property draft UUID." }], multipart: { field: "document", fields: { documentType: { type: "string", enum: ["OWNERSHIP_PAPERS", "SURVEY_PLAN", "DEED", "CERTIFICATE_OF_OCCUPANCY", "OTHER"] }, displayName: { type: "string", maxLength: 180, description: "Optional safe display filename." } }, requiredFields: ["documentType"], contentType: "application/pdf", description: "Required PDF document (application/pdf; maximum 10MB), approved documentType, and optional displayName." }, badRequestMessage: "Only valid PDF documents up to 10MB are allowed", forbiddenMessage: "Seller persona is required", notFoundMessage: "Property draft not found" },
  { method: "delete", path: "/marketplace/seller/properties/{propertyId}/documents/{documentId}", tag: "Marketplace Draft Documents", summary: "Delete a private supporting document", description: "Seller-only deletion from an owned editable DRAFT. The document must belong to the property. An already-missing provider asset does not prevent metadata cleanup; unexpected provider failures return a stable safe error.", successMessage: "Property document deleted successfully", security: "required", roles: ["SELLER_DEVELOPER"], pathParams: [{ name: "propertyId", description: "Property draft UUID." }, { name: "documentId", description: "Property document UUID." }], forbiddenMessage: "Seller persona is required", notFoundMessage: "Property document not found" },
  { method: "post", path: "/marketplace/seller/properties/{propertyId}/images", tag: "Marketplace Draft Photos", summary: "Upload draft photos", description: "Seller-only DRAFT upload. images field accepts JPEG, PNG, or WEBP files up to 5MB each; maximum 10 property photos. The first image becomes cover.", successStatus: 201, successMessage: "Property images uploaded successfully", security: "required", roles: ["SELLER_DEVELOPER"], pathParams: [{ name: "propertyId", description: "Property draft UUID." }], multipart: { field: "images", multiple: true, description: "Up to 10 images total per draft." }, forbiddenMessage: "Seller persona is required" },
  { method: "delete", path: "/marketplace/seller/properties/{propertyId}/images/{imageId}", tag: "Marketplace Draft Photos", summary: "Delete draft photo", description: "Seller-only DRAFT deletion. Deleting the cover assigns the lowest-order remaining image as cover.", successMessage: "Property image deleted successfully", security: "required", roles: ["SELLER_DEVELOPER"], pathParams: [{ name: "propertyId", description: "Property draft UUID." }, { name: "imageId", description: "Property image UUID." }], forbiddenMessage: "Seller persona is required", notFoundMessage: "Property image not found" },
  { method: "patch", path: "/marketplace/seller/properties/{propertyId}/images/order", tag: "Marketplace Draft Photos", summary: "Reorder draft photos", description: "Seller-only DRAFT operation. imageIds must be the complete unique set of property image IDs; ordering is persisted sequentially.", successMessage: "Property images reordered successfully", security: "required", roles: ["SELLER_DEVELOPER"], pathParams: [{ name: "propertyId", description: "Property draft UUID." }], bodySchema: "MarketplaceImageOrderRequest", forbiddenMessage: "Seller persona is required" },
  { method: "patch", path: "/marketplace/seller/properties/{propertyId}/images/{imageId}/cover", tag: "Marketplace Draft Photos", summary: "Set draft cover photo", description: "Seller-only DRAFT operation. The selected property image becomes the sole cover image.", successMessage: "Property cover image updated successfully", security: "required", roles: ["SELLER_DEVELOPER"], pathParams: [{ name: "propertyId", description: "Property draft UUID." }, { name: "imageId", description: "Property image UUID." }], forbiddenMessage: "Seller persona is required", notFoundMessage: "Property image not found" },
  { method: "post", path: "/marketplace/seller/properties", tag: "Marketplace Drafts", summary: "Create Seller property draft", description: "Creates one DRAFT canonical property for a verified Customer with a completed SELLER_DEVELOPER persona. Partial Step 1 bodies are accepted, fullAddress is private, and uppercase API categories are mapped to the legacy lowercase storage enum.", successStatus: 201, successMessage: "Property draft created successfully", responseSchema: "MarketplaceSellerDraftResult", security: "required", roles: ["SELLER_DEVELOPER"], bodySchema: "MarketplaceDraftRequest", forbiddenMessage: "Seller persona is required", errorResponses: { "400": { description: "Unknown fields, unsupported enums, invalid numbers, or invalid deposit state", message: "Validation failed", code: "INVALID_DRAFT_PAYLOAD" }, "503": { description: "Draft persistence is unavailable", message: "Property draft could not be saved", code: "DRAFT_PERSISTENCE_UNAVAILABLE" } } },
  { method: "get", path: "/marketplace/seller/properties", tag: "Marketplace Seller Management", summary: "List the Seller's Marketplace properties", description: "Returns only the authenticated Seller's DRAFT, IN_REVIEW, LIVE, and REJECTED properties with database-level filtering, per-status counts, paginated summaries, joined cover/photo data, and deterministic updatedAt/id sorting. No review SLA or unavailable lifecycle timestamps are fabricated.", successMessage: "Seller properties fetched successfully", responseSchema: "MarketplaceSellerPropertyList", security: "required", roles: ["SELLER_DEVELOPER"], query: [...paginationParameters, queryParameter("status", "Marketplace lifecycle filter; defaults to ALL.", { type: "string", enum: ["ALL", "DRAFT", "IN_REVIEW", "LIVE", "REJECTED"], default: "ALL" })], forbiddenMessage: "Seller persona is required", errorResponses: { "400": { description: "Unknown status or invalid pagination", message: "Invalid listing status filter or pagination", code: "INVALID_LISTING_STATUS_FILTER" }, "503": { description: "Seller management persistence is unavailable", message: "Property management is temporarily unavailable", code: "PROPERTY_MANAGEMENT_UNAVAILABLE" } } },
  { method: "delete", path: "/marketplace/seller/properties/{propertyId}", tag: "Marketplace Drafts", summary: "Permanently delete a Seller-owned draft", description: "Verified completed Seller-only owner operation. Permanently deletes only a canonical property whose marketplace status is DRAFT, together with database dependants covered by existing foreign-key cascades. Known draft photos and private documents are then removed from their configured providers on a best-effort basis; provider identifiers are never returned. IN_REVIEW, LIVE, and REJECTED properties cannot be deleted.", successMessage: "Property draft deleted successfully", responseSchema: "MarketplaceDraftDeletion", security: "required", roles: ["SELLER_DEVELOPER"], pathParams: [{ name: "propertyId", description: "Seller-owned DRAFT property UUID." }], forbiddenMessage: "Seller persona is required", errorResponses: { "404": { description: "The property is missing or is not owned by the authenticated Seller", message: "Property draft not found", code: "PROPERTY_NOT_FOUND" }, "409": { description: "The property is IN_REVIEW, LIVE, or REJECTED", message: "Property is not editable", code: "PROPERTY_NOT_EDITABLE" }, "503": { description: "Atomic draft deletion is unavailable", message: "Property draft could not be deleted", code: "DRAFT_DELETE_FAILED" } } },
  { method: "get", path: "/marketplace/seller/properties/{propertyId}", tag: "Marketplace Drafts", summary: "Get Seller property draft", description: "Returns a Seller-owned DRAFT including its private fullAddress and Seller-safe private document metadata.", successMessage: "Property draft fetched successfully", responseSchema: "MarketplaceSellerDraftResult", security: "required", roles: ["SELLER_DEVELOPER"], pathParams: [{ name: "propertyId", description: "Property draft UUID." }], forbiddenMessage: "Seller persona is required", notFoundMessage: "Property draft not found" },
  { method: "patch", path: "/marketplace/seller/properties/{propertyId}", tag: "Marketplace Drafts", summary: "Autosave Seller property draft", description: "Partially updates an owned DRAFT. Only supplied Step 1 fields are changed; fullAddress remains private. currentStep is persisted only after the preceding Step 1 save succeeds.", successMessage: "Property draft saved successfully", responseSchema: "MarketplaceSellerDraftResult", security: "required", roles: ["SELLER_DEVELOPER"], pathParams: [{ name: "propertyId", description: "Property draft UUID." }], bodySchema: "MarketplaceDraftRequest", forbiddenMessage: "Seller persona is required", notFoundMessage: "Property draft not found", errorResponses: { "400": { description: "Unknown fields, unsupported enums, invalid numbers, or invalid deposit state", message: "Validation failed", code: "INVALID_DRAFT_PAYLOAD" }, "503": { description: "Draft persistence is unavailable", message: "Property draft could not be saved", code: "DRAFT_PERSISTENCE_UNAVAILABLE" } } },
  { method: "get", path: "/health", tag: "Health", summary: "Check API health", description: "Returns API availability and the current server timestamp.", successMessage: "Beryl Shelter Nigeria Limited API is healthy", responseSchema: "StandardSuccessResponse" },

  { method: "post", path: "/auth/register", tag: "Authentication", summary: "Register a customer", description: "Creates a pending customer without a legacy Buyer/Seller role and sends a registration OTP through Resend. Email is lowercased; phone and any separate WhatsApp number are normalized to E.164 with Nigeria as the local-number default. When isWhatsAppNumber is true, phone is persisted as the WhatsApp number. Password and confirmation values are never returned or persisted in profiles.", successStatus: 201, successMessage: "Account created. Check your email for the verification code.", responseSchema: "CustomerRegistrationResult", bodySchema: "RegisterRequest", successExample: { verificationRequired: true, maskedEmail: "c***r@example.com", otpLength: 6, resendAvailableIn: 60, nextAction: "VERIFY_EMAIL" }, errorResponses: { "409": { description: "Normalized email or phone already belongs to an account", message: "An account with this email already exists. Please log in or reset your password.", code: "EMAIL_ALREADY_REGISTERED", examples: { email: { summary: "Email already registered", message: "An account with this email already exists. Please log in or reset your password.", code: "EMAIL_ALREADY_REGISTERED" }, phone: { summary: "Phone already registered", message: "An account with this phone number already exists. Please log in or reset your password.", code: "PHONE_ALREADY_REGISTERED" } } }, "503": { description: "Registration, OTP configuration, or Resend delivery is unavailable", message: "Unable to complete registration", code: "REGISTRATION_UNAVAILABLE", examples: { unavailable: { summary: "Registration infrastructure or delivery unavailable", message: "Unable to complete registration", code: "REGISTRATION_UNAVAILABLE" }, notConfigured: { summary: "OTP verification is not configured", message: "Customer verification is temporarily unavailable", code: "CUSTOMER_AUTH_NOT_CONFIGURED" } } } } },
  { method: "post", path: "/auth/verify-email", tag: "Authentication", summary: "Verify customer registration email", description: "Validates the active six-digit registration OTP. It expires, allows three attempts, and cannot be reused after consumption or replacement. Success atomically confirms the managed Auth email, activates the account, upserts its initial NOT_STARTED persona, and upserts the single Admin Portal customer record.", successMessage: "Email verified successfully", responseSchema: "CustomerEmailVerificationResult", bodySchema: "VerifyCustomerEmailRequest", successExample: { accountStatus: "ACTIVE", emailVerified: true, activePersona: "BUYER", personas: ["BUYER"], onboardingStatus: "NOT_STARTED", nextAction: "COMPLETE_BUYER_ONBOARDING" }, errorResponses: { "400": { description: "OTP is invalid or expired", message: "Invalid verification code", code: "INVALID_OTP", examples: { invalid: { summary: "Incorrect OTP with attempts remaining", message: "Invalid verification code", code: "INVALID_OTP", details: { attemptsRemaining: 2 } }, expired: { summary: "Expired OTP", message: "Verification code has expired", code: "OTP_EXPIRED" } } }, "409": { description: "OTP was consumed or superseded and must be replaced", message: "Verification code is no longer valid. Request a new code.", code: "OTP_NO_LONGER_VALID" }, "429": { description: "Maximum OTP attempts or endpoint rate limit exceeded", message: "Maximum verification attempts exceeded", code: "OTP_ATTEMPTS_EXCEEDED", examples: { attempts: { summary: "Maximum OTP attempts reached", message: "Maximum verification attempts exceeded", code: "OTP_ATTEMPTS_EXCEEDED" }, rateLimit: { summary: "Endpoint rate limit reached", message: "Too many requests, please try again later", code: "RATE_LIMIT_EXCEEDED" } } }, "503": { description: "Verification infrastructure or OTP configuration is unavailable", message: "Unable to verify email", code: "VERIFICATION_UNAVAILABLE", examples: { unavailable: { summary: "Verification infrastructure unavailable", message: "Unable to verify email", code: "VERIFICATION_UNAVAILABLE" }, notConfigured: { summary: "OTP verification is not configured", message: "Customer verification is temporarily unavailable", code: "CUSTOMER_AUTH_NOT_CONFIGURED" } } } } },
  { method: "post", path: "/auth/resend-verification-otp", tag: "Authentication", summary: "Resend customer registration OTP", description: "For an eligible unverified account, invalidates the previous active OTP, resets attempts, and sends a replacement through Resend. Missing or verified accounts receive the same generic 202 response. An eligible account still inside its resend cooldown receives OTP_RESEND_COOLDOWN with retryAfter.", successStatus: 202, successMessage: "If the account is awaiting verification, a new code has been sent.", responseSchema: "ResendCustomerVerificationResult", bodySchema: "ResendCustomerVerificationRequest", successExample: { resendAvailableIn: 60 }, errorResponses: { "429": { description: "Domain resend cooldown or endpoint rate limit exceeded", message: "Please wait before requesting another verification code", code: "OTP_RESEND_COOLDOWN", examples: { cooldown: { summary: "Resend cooldown active", message: "Please wait before requesting another verification code", code: "OTP_RESEND_COOLDOWN", details: { retryAfter: 38 } }, rateLimit: { summary: "Endpoint rate limit reached", message: "Too many requests, please try again later", code: "RATE_LIMIT_EXCEEDED" } } }, "503": { description: "Resend delivery, verification infrastructure, or OTP configuration is unavailable", message: "Unable to process verification request", code: "VERIFICATION_UNAVAILABLE", examples: { mailDelivery: { summary: "Resend delivery failed", message: "Unable to send verification email", code: "MAIL_DELIVERY_FAILED" }, unavailable: { summary: "Verification infrastructure unavailable", message: "Unable to process verification request", code: "VERIFICATION_UNAVAILABLE" }, notConfigured: { summary: "OTP verification is not configured", message: "Customer verification is temporarily unavailable", code: "CUSTOMER_AUTH_NOT_CONFIGURED" } } } } },

  {
    method: "get",
    path: "/onboarding/status",
    tag: "Onboarding",
    summary: "Get resumable customer onboarding status",
    description: "Returns the verified customer's persisted account, active/last persona, activated persona onboarding states, missing steps, next action, and dashboard eligibility.",
    successMessage: "Onboarding status fetched successfully",
    responseSchema: "OnboardingStatusResult",
    security: "required",
    successExample: {
      accountStatus: "ACTIVE",
      emailVerified: true,
      activePersona: "BUYER",
      lastActivePersona: "BUYER",
      personas: [{ type: "BUYER", onboardingStatus: "NOT_STARTED", activated: true, missingOnboardingSteps: ["PREFERRED_LOCATIONS"] }],
      missingOnboardingSteps: ["PREFERRED_LOCATIONS"],
      nextAction: "COMPLETE_BUYER_ONBOARDING",
      dashboardAccess: false
    },
    errorResponses: customerAccessErrors
  },
  {
    method: "patch",
    path: "/onboarding/buyer",
    tag: "Onboarding",
    summary: "Complete or skip Buyer onboarding",
    description: "Requires an activated Buyer persona. Normal submission upserts one Buyer profile, trims and case-insensitively deduplicates 1–10 locations, validates the optional budget range, defaults currency to NGN, and atomically completes Buyer onboarding. Sending only skip=true completes onboarding without requiring or deleting a Buyer profile. Repeated submissions are idempotent updates.",
    successMessage: "Buyer profile completed successfully",
    responseSchema: "BuyerOnboardingResult",
    bodySchema: "BuyerOnboardingRequest",
    security: "required",
    successExample: { activePersona: "BUYER", onboardingStatus: "COMPLETED", preferredLocations: ["Lekki, Lagos", "Ikoyi, Lagos"], budgetMin: 50000000, budgetMax: 150000000, currency: "NGN", skipped: false, nextAction: "OPEN_BUYER_DASHBOARD" },
    errorResponses: {
      ...customerAccessErrors,
      "409": { description: "Buyer persona has not been activated", message: "Buyer persona is not activated", code: "BUYER_PERSONA_NOT_ACTIVE" }
    }
  },
  {
    method: "patch",
    path: "/onboarding/seller",
    tag: "Onboarding",
    summary: "Complete or skip Seller/Developer onboarding",
    description: "Requires an activated Seller/Developer persona. BUSINESS requires trimmed companyName and companyAddress; INDIVIDUAL stores company fields as null. Sending only skip=true completes onboarding without creating invalid Seller profile data. The profile/persona/projection update is atomic and idempotent.",
    successMessage: "Seller profile completed successfully",
    responseSchema: "SellerOnboardingResult",
    bodySchema: "SellerOnboardingRequest",
    security: "required",
    successExample: { activePersona: "SELLER_DEVELOPER", onboardingStatus: "COMPLETED", profileType: "BUSINESS", companyName: "Beryl Development Company", companyAddress: "Lekki Phase 1, Lagos", skipped: false, nextAction: "OPEN_SELLER_DASHBOARD" },
    errorResponses: {
      ...customerAccessErrors,
      "409": { description: "Seller/Developer persona has not been activated", message: "Seller/Developer persona is not activated", code: "SELLER_PERSONA_NOT_ACTIVE" }
    }
  },
  {
    method: "get",
    path: "/personas",
    tag: "Personas",
    summary: "Get the customer persona switcher state",
    description: "Returns both possible customer personas with activation, onboarding, active-selection, and destination state.",
    successMessage: "Personas fetched successfully",
    responseSchema: "PersonaListResult",
    security: "required",
    successExample: { activePersona: "BUYER", personas: [{ type: "BUYER", activated: true, onboardingStatus: "COMPLETED", isActive: true, nextAction: "OPEN_BUYER_DASHBOARD" }, { type: "SELLER_DEVELOPER", activated: false, onboardingStatus: "NOT_STARTED", isActive: false, nextAction: "ACTIVATE_SELLER_PERSONA" }] },
    errorResponses: customerAccessErrors
  },
  {
    method: "post",
    path: "/personas/activate",
    tag: "Personas",
    summary: "Activate an additional customer persona",
    description: "Atomically inserts only a missing Buyer or Seller/Developer persona, preserves every existing persona/profile, sets the requested persona active, and touches the single Admin Portal customer projection. Repeating an activation returns HTTP 200 with code PERSONA_ALREADY_ACTIVE and the current state without duplication.",
    successMessage: "Persona activated successfully",
    responseSchema: "PersonaMutationResult",
    bodySchema: "PersonaTypeRequest",
    security: "required",
    successExample: { activePersona: "SELLER_DEVELOPER", personas: ["BUYER", "SELLER_DEVELOPER"], onboardingStatus: "NOT_STARTED", alreadyActivated: false, nextAction: "COMPLETE_SELLER_ONBOARDING" },
    errorResponses: customerAccessErrors
  },
  {
    method: "patch",
    path: "/personas/active",
    tag: "Personas",
    summary: "Switch the active customer persona",
    description: "Atomically switches only to an activated persona, updates active_persona and last_active_persona, preserves all persona profiles, touches the existing Admin Portal customer projection, and returns the onboarding or dashboard destination.",
    successMessage: "Active persona changed successfully",
    responseSchema: "PersonaMutationResult",
    bodySchema: "PersonaTypeRequest",
    security: "required",
    successExample: { activePersona: "BUYER", onboardingStatus: "COMPLETED", alreadyActive: false, nextAction: "OPEN_BUYER_DASHBOARD" },
    errorResponses: {
      ...customerAccessErrors,
      "409": { description: "Requested persona has not been activated", message: "Persona has not been activated", code: "PERSONA_NOT_ACTIVATED" }
    }
  },
  { method: "post", path: "/auth/login", tag: "Authentication", summary: "Log in a customer", description: "Authenticates a normalized email address or phone number with one generic credential failure, restores the last active persona, and creates a server-tracked customer session. Returns access and refresh tokens from the isolated customer token domain.", successMessage: "Login successful", responseSchema: "CustomerLoginResult", bodySchema: "CustomerLoginRequest", successExample: { user: { id: "550e8400-e29b-41d4-a716-446655440000", fullName: "Test Customer", email: "customer@example.com", phone: "+2348012345678", accountStatus: "ACTIVE", emailVerified: true }, activePersona: "BUYER", personas: [{ type: "BUYER", onboardingStatus: "COMPLETED" }], nextAction: "OPEN_BUYER_DASHBOARD", accessToken: "<customer-access-token>", refreshToken: "<customer-refresh-token>", accessTokenExpiresIn: 900, refreshTokenExpiresIn: 2592000 }, errorResponses: { "401": { description: "Email/phone or password is incorrect", message: "Incorrect email/phone or password", code: "INVALID_CREDENTIALS" }, "403": { description: "Customer email is unverified or account is suspended", message: "Account verification is required", code: "ACCOUNT_VERIFICATION_REQUIRED", examples: { verification: { summary: "Email verification required", message: "Account verification is required", code: "ACCOUNT_VERIFICATION_REQUIRED" }, suspended: { summary: "Account suspended", message: "Account is suspended", code: "ACCOUNT_SUSPENDED" } } }, "423": { description: "Customer account is locked", message: "Account is locked", code: "ACCOUNT_LOCKED" }, "429": { description: "IP and normalized-identifier login limit exceeded", message: "Too many login attempts, please try again later", code: "LOGIN_RATE_LIMITED" }, "503": { description: "Customer session configuration or authentication storage is unavailable", message: "Customer login is temporarily unavailable", code: "LOGIN_UNAVAILABLE" } } },
  { method: "post", path: "/auth/forgot-password", tag: "Authentication", summary: "Request a password-reset code", description: "Returns the same accepted response whether or not the normalized email exists. For an eligible account, replaces the active reset challenge and emails a six-digit OTP; neither passwords nor OTPs are stored in plaintext.", successStatus: 202, successMessage: "If an account exists for this email, password-reset instructions have been sent.", responseSchema: "ForgotCustomerPasswordResult", bodySchema: "ForgotCustomerPasswordRequest", successExample: { otpLength: 6, resendAvailableIn: 60, nextAction: "VERIFY_PASSWORD_RESET_OTP" }, errorResponses: { "429": { description: "Reset request limit exceeded", message: "Too many requests, please try again later", code: "RATE_LIMIT_EXCEEDED" }, "503": { description: "Password-reset storage, configuration, or mail delivery is unavailable", message: "Password reset is temporarily unavailable", code: "PASSWORD_RESET_UNAVAILABLE", examples: { unavailable: { summary: "Reset infrastructure unavailable", message: "Password reset is temporarily unavailable", code: "PASSWORD_RESET_UNAVAILABLE" }, mail: { summary: "Reset email delivery failed", message: "Unable to send password-reset email", code: "MAIL_DELIVERY_FAILED" } } } } },
  { method: "post", path: "/auth/verify-password-reset-otp", tag: "Authentication", summary: "Verify a password-reset code", description: "Verifies the active six-digit password-reset OTP with expiry, attempt, consumption, and replacement checks. Success returns a short-lived opaque reset proof; only its hash is stored.", successMessage: "Password reset code verified successfully", responseSchema: "VerifyCustomerPasswordResetResult", bodySchema: "VerifyCustomerPasswordResetRequest", successExample: { resetToken: "<single-use-reset-token>", expiresIn: 600, nextAction: "SET_NEW_PASSWORD" }, errorResponses: { "400": { description: "OTP is invalid or expired", message: "Invalid verification code", code: "INVALID_OTP", examples: { invalid: { summary: "Incorrect OTP", message: "Invalid verification code", code: "INVALID_OTP", details: { attemptsRemaining: 2 } }, expired: { summary: "Expired OTP", message: "Verification code has expired", code: "OTP_EXPIRED" } } }, "409": { description: "OTP is consumed or superseded", message: "Verification code is no longer valid. Request a new code.", code: "OTP_NO_LONGER_VALID" }, "429": { description: "Maximum OTP attempts or endpoint limit exceeded", message: "Maximum verification attempts exceeded", code: "OTP_ATTEMPTS_EXCEEDED" }, "503": { description: "Password-reset infrastructure is unavailable", message: "Password reset is temporarily unavailable", code: "PASSWORD_RESET_UNAVAILABLE" } } },
  { method: "post", path: "/auth/reset-password", tag: "Authentication", summary: "Reset a customer password", description: "Consumes a verified, unexpired reset proof, updates the managed Auth password, increments the customer's session version, and revokes every customer session atomically. The new password must differ from the current password.", successMessage: "Password reset successfully. Please log in with your new password.", responseSchema: "SessionsInvalidatedResult", bodySchema: "ResetCustomerPasswordRequest", successExample: { sessionsInvalidated: true, nextAction: "LOGIN" }, errorResponses: { "400": { description: "Password policy, confirmation, or same-password check failed", message: "New password must differ from current password", code: "NEW_PASSWORD_SAME_AS_CURRENT" }, "401": { description: "Reset proof is invalid or expired", message: "Invalid password-reset token", code: "INVALID_RESET_TOKEN", examples: { invalid: { summary: "Invalid reset proof", message: "Invalid password-reset token", code: "INVALID_RESET_TOKEN" }, expired: { summary: "Expired reset proof", message: "Password-reset token has expired", code: "RESET_TOKEN_EXPIRED" } } }, "409": { description: "Reset proof was already consumed", message: "Password-reset token has already been used", code: "RESET_TOKEN_USED" }, "503": { description: "Password reset is unavailable", message: "Password reset is temporarily unavailable", code: "PASSWORD_RESET_UNAVAILABLE" } } },
  { method: "post", path: "/auth/refresh", tag: "Authentication", summary: "Rotate a customer session", description: "Validates the current customer refresh token and atomically replaces its server-tracked session with a new access/refresh token pair. Reuse detection revokes the user's active customer sessions.", successMessage: "Session refreshed successfully", responseSchema: "CustomerSessionResult", bodySchema: "CustomerRefreshRequest", successExample: { accessToken: "<new-customer-access-token>", refreshToken: "<new-customer-refresh-token>", accessTokenExpiresIn: 900, refreshTokenExpiresIn: 2592000 }, errorResponses: { "401": { description: "Refresh token is invalid, expired, revoked, reused, or not backed by a session", message: "Invalid refresh token", code: "INVALID_REFRESH_TOKEN", examples: { invalid: { summary: "Invalid refresh token", message: "Invalid refresh token", code: "INVALID_REFRESH_TOKEN" }, expired: { summary: "Expired refresh token", message: "Refresh token has expired", code: "REFRESH_TOKEN_EXPIRED" }, revoked: { summary: "Revoked refresh token", message: "Refresh token has been revoked", code: "REFRESH_TOKEN_REVOKED" }, reused: { summary: "Refresh-token reuse", message: "Refresh token reuse detected; sessions have been revoked", code: "REFRESH_TOKEN_REUSED" }, missing: { summary: "Session missing", message: "Customer session was not found", code: "SESSION_NOT_FOUND" } } }, "403": { description: "Customer email is unverified or account is suspended", message: "Account verification is required", code: "ACCOUNT_VERIFICATION_REQUIRED" }, "423": { description: "Customer account is locked", message: "Account is locked", code: "ACCOUNT_LOCKED" }, "503": { description: "Session rotation is unavailable", message: "Session refresh is temporarily unavailable", code: "SESSION_REFRESH_UNAVAILABLE" } } },
  { method: "post", path: "/auth/logout", tag: "Authentication", summary: "Log out a customer session", description: "Requires the customer access token and its bound refresh token. Revokes the current server-tracked session; repeating the same valid logout is idempotent.", successMessage: "Logout successful", security: "required", bodySchema: "CustomerLogoutRequest", errorResponses: { "401": { description: "Customer access token, refresh token, or bound session is invalid", message: "Customer session was not found", code: "SESSION_NOT_FOUND", examples: { access: { summary: "Invalid customer access token", message: "Invalid customer access token", code: "INVALID_ACCESS_TOKEN" }, refresh: { summary: "Invalid refresh token", message: "Invalid refresh token", code: "INVALID_REFRESH_TOKEN" }, session: { summary: "Session missing", message: "Customer session was not found", code: "SESSION_NOT_FOUND" } } }, "503": { description: "Session revocation is unavailable", message: "Logout is temporarily unavailable", code: "LOGOUT_UNAVAILABLE" } } },
  { method: "patch", path: "/auth/change-password", tag: "Authentication", summary: "Change the current customer's password", description: "Requires a verified active customer session, checks the current password, updates the managed Auth password, increments session version, and revokes every customer session atomically. The new password must differ from the current password.", successMessage: "Password changed successfully. Please log in again.", responseSchema: "SessionsInvalidatedResult", bodySchema: "ChangeCustomerPasswordRequest", security: "required", successExample: { sessionsInvalidated: true, nextAction: "LOGIN" }, errorResponses: { "400": { description: "Password policy, confirmation, or same-password check failed", message: "New password must differ from current password", code: "NEW_PASSWORD_SAME_AS_CURRENT" }, "401": { description: "Customer session is invalid or current password is incorrect", message: "Current password is incorrect", code: "CURRENT_PASSWORD_INCORRECT", examples: { password: { summary: "Incorrect current password", message: "Current password is incorrect", code: "CURRENT_PASSWORD_INCORRECT" }, session: { summary: "Session missing", message: "Customer session was not found", code: "SESSION_NOT_FOUND" }, access: { summary: "Invalid customer access token", message: "Invalid customer access token", code: "INVALID_ACCESS_TOKEN" } } }, "403": { description: "Customer is unverified or suspended", message: "Account verification is required", code: "ACCOUNT_VERIFICATION_REQUIRED" }, "423": { description: "Customer account is locked", message: "Account is locked", code: "ACCOUNT_LOCKED" }, "503": { description: "Password change or customer authorization is unavailable", message: "Password change is temporarily unavailable", code: "PASSWORD_CHANGE_UNAVAILABLE" } } },
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
  { method: "get", path: "/properties/saved/me", tag: "Saved Properties", summary: "List my available saved properties", description: "Customer-session operation returning explicit Buyer-safe cards for authoritative Marketplace LIVE properties only. Historical saved rows for unavailable/non-LIVE properties are preserved but omitted; private addresses, Seller/contact data, documents, mandates, reviews, and provider metadata are never returned.", successMessage: "Saved properties fetched successfully", responseSchema: "MarketplaceSavedPropertyList", security: "required", query: paginationParameters, errorResponses: { "503": { description: "Saved-property persistence is unavailable", message: "Saved properties are temporarily unavailable", code: "SAVED_PROPERTY_UNAVAILABLE" } } },
  { method: "post", path: "/properties/{id}/save", tag: "Saved Properties", summary: "Save a LIVE Marketplace property", description: "Adds the canonical LIVE Marketplace property ID to the verified customer's existing saved_properties. Repeating an existing save is idempotent and does not create a duplicate row.", successStatus: 201, successMessage: "Property saved successfully", responseSchema: "MarketplaceSavedPropertyMutation", security: "required", pathParams: [{ name: "id", description: "Canonical LIVE Marketplace property UUID." }], errorResponses: { "404": { description: "Property is missing or not Marketplace LIVE", message: "Property is not available", code: "PROPERTY_NOT_AVAILABLE" }, "503": { description: "Saved-property persistence is unavailable", message: "Saved property is temporarily unavailable", code: "SAVED_PROPERTY_UNAVAILABLE" } } },
  { method: "delete", path: "/properties/{id}/save", tag: "Saved Properties", summary: "Unsave a property", description: "Removes the requesting customer's canonical saved_properties row. A historical save can still be removed after its property becomes non-LIVE.", successMessage: "Property removed from saved properties successfully", security: "required", pathParams: [{ name: "id", description: "Canonical property UUID." }], notFoundMessage: "Property is not saved", errorResponses: { "503": { description: "Saved-property persistence is unavailable", message: "Saved property is temporarily unavailable", code: "SAVED_PROPERTY_UNAVAILABLE" } } },

  { method: "post", path: "/analytics/properties/{id}/view", tag: "Analytics", summary: "Track a property view", description: "Tracks a view. A bearer token is optional and, when valid, associates the view with the user.", successMessage: "View tracked successfully", responseSchema: "AnalyticsOverview", security: "optional", pathParams: [{ name: "id", description: "Property UUID." }], notFoundMessage: "Property not found" },
  { method: "post", path: "/analytics/properties/{id}/share", tag: "Analytics", summary: "Track a property share", description: "Increments the property's share count.", successMessage: "Share tracked successfully", responseSchema: "AnalyticsOverview", pathParams: [{ name: "id", description: "Property UUID." }], notFoundMessage: "Property not found" },
  { method: "get", path: "/analytics/properties/{id}/stats", tag: "Analytics", summary: "Get property statistics", description: "Returns property statistics to the owner or an admin.", successMessage: "Property stats fetched successfully", responseSchema: "AnalyticsOverview", security: "required", pathParams: [{ name: "id", description: "Property UUID." }], forbiddenMessage: "You are not allowed to view this property analytics", notFoundMessage: "Property not found" },
  { method: "get", path: "/analytics/my-properties", tag: "Analytics", summary: "Get my property analytics", description: "Lists analytics counters for properties owned by the authenticated property professional or admin.", successMessage: "My property analytics fetched successfully", responseSchema: "AnalyticsOverview", security: "required", roles: ["property_developer", "landlord", "registered_agent", "freelance_agent", "admin", "super_admin"], query: paginationParameters },
  { method: "get", path: "/analytics/dashboard", tag: "Analytics", summary: "Get admin analytics dashboard", description: "Returns aggregate property analytics. Admin or Super Admin only.", successMessage: "Admin dashboard analytics fetched successfully", responseSchema: "AnalyticsOverview", security: "required", roles: ["admin", "super_admin"] },

  { method: "get", path: "/referrals/context", tag: "Referrals", summary: "Get optional customer referral context", description: "Public-safe context. When a valid customer bearer token is supplied, reuses that profile's stable referral code and returns its /r/{code} link; anonymous responses contain no identity.", successMessage: "Referral context fetched successfully", responseSchema: "ReferralContext", security: "optional" },
  { method: "get", path: "/referrals/links/{code}", tag: "Referrals", summary: "Resolve a public referral link", description: "Validates a referral code without exposing the referrer's name, phone, customer UUID, or any referral records.", successMessage: "Referral link is valid", responseSchema: "ReferralLinkResolution", pathParams: [{ name: "code", description: "Stable, non-secret referral code." }], errorResponses: { "404": { description: "Code is not valid", message: "Referral link is unavailable", code: "REFERRAL_CODE_INVALID" } } },
  { method: "post", path: "/referrals", tag: "Referrals", summary: "Submit a direct referral", description: "Public with optional customer authentication. Anonymous submissions create or reuse the minimal referral-only identity by normalized phone; customer submissions derive identity from the customer session. Display reference, lifecycle, reward, and payment fields are server-owned.", successStatus: 201, successMessage: "Referral submitted successfully", responseSchema: "DirectReferralResult", security: "optional", bodySchema: "DirectReferralRequest", errorResponses: { "400": { description: "Strict field or identity validation failed", message: "Validation failed", code: "REFERRAL_SUBMISSION_INVALID" }, "429": { description: "Public referral submission rate exceeded", message: "Too many requests, please try again later", code: "REFERRAL_SUBMISSION_RATE_LIMITED" }, "503": { description: "Referral persistence unavailable", message: "Referral submission is temporarily unavailable", code: "REFERRAL_SUBMISSION_FAILED" } } },
  { method: "post", path: "/referrals/tracking/request", tag: "Referrals", summary: "Request a referral tracking OTP", description: "Referral-only phone verification. Codes are generated and hashed server-side only when an approved WhatsApp/SMS provider is configured. The current disabled provider returns REFERRAL_TRACKING_UNAVAILABLE and never claims delivery.", successStatus: 202, successMessage: "If the details match, a tracking code will be sent", responseSchema: "ReferralTrackingRequestResult", bodySchema: "ReferralTrackingRequest", errorResponses: { "429": { description: "Rate or resend cooldown exceeded", message: "Please wait before requesting another code", code: "REFERRAL_OTP_RATE_LIMITED" }, "503": { description: "No approved/configured delivery provider", message: "Referral tracking by phone is temporarily unavailable", code: "REFERRAL_TRACKING_UNAVAILABLE" } } },
  { method: "post", path: "/referrals/tracking/verify", tag: "Referrals", summary: "Verify a referral tracking OTP", description: "Consumes one valid short-lived OTP and issues a narrow opaque tracking token intended for a Web HttpOnly cookie. It is not a customer access token.", successMessage: "Referral tracking verified", responseSchema: "ReferralTrackingSessionResult", bodySchema: "ReferralTrackingVerifyRequest", errorResponses: { "400": { description: "Invalid or expired OTP", message: "The code is invalid", code: "REFERRAL_OTP_INVALID", examples: { expired: { summary: "Expired code", message: "The code has expired", code: "REFERRAL_OTP_EXPIRED" } } }, "429": { description: "Attempt/rate limit exceeded", message: "Too many incorrect attempts", code: "REFERRAL_OTP_RATE_LIMITED" } } },
  { method: "get", path: "/referrals/dashboard", tag: "Referrals", summary: "Get the canonical referral dashboard", description: "Accepts either a verified customer bearer token or a narrow X-Referral-Tracking-Token header. Identity is derived server-side and records are ownership-filtered. Referred contact values are excluded.", successMessage: "Referral dashboard fetched successfully", responseSchema: "ReferralDashboard", security: "optional", query: [...paginationParameters, { name: "X-Referral-Tracking-Token", in: "header", description: "Opaque referral-only token used by the Web BFF; never a customer token.", schema: { type: "string" } }], errorResponses: { "401": { description: "Neither authorization domain is valid", message: "Referral tracking session required", code: "REFERRAL_SESSION_REQUIRED" } } },
  { method: "get", path: "/referrals/banks", tag: "Referrals", summary: "List the controlled referral payout bank directory", description: "Returns the controlled initial Nigerian institution list, including OPay, PalmPay and Moniepoint. The response explicitly does not claim authoritative completeness and account-name resolution is unavailable.", successMessage: "Referral bank directory fetched successfully", responseSchema: "ReferralBankDirectory" },
  { method: "get", path: "/referrals/payout-details", tag: "Referrals", summary: "Get own masked payout details", description: "Customer or referral-session authorization. Returns only the owner's account name, bank and masked last four digits.", successMessage: "Payout details fetched successfully", responseSchema: "ReferralPayoutDetails", security: "optional", query: [{ name: "X-Referral-Tracking-Token", in: "header", description: "Opaque referral-only token used by the Web BFF.", schema: { type: "string" } }], errorResponses: { "401": { description: "Referral authorization required", message: "Referral tracking session required", code: "REFERRAL_SESSION_REQUIRED" } } },
  { method: "put", path: "/referrals/payout-details", tag: "Referrals", summary: "Create or replace own payout details", description: "Validates the controlled bank code and ten-digit account number. The account number is AES-256-GCM encrypted at rest; ordinary DTOs only expose its last four digits. Account name is manual because no approved resolution provider is configured.", successMessage: "Payout details saved successfully", responseSchema: "ReferralPayoutDetails", security: "optional", bodySchema: "ReferralPayoutRequest", query: [{ name: "X-Referral-Tracking-Token", in: "header", description: "Opaque referral-only token used by the Web BFF.", schema: { type: "string" } }], errorResponses: { "400": { description: "Bank/account validation failed", message: "Validation failed", code: "PAYOUT_DETAILS_INVALID" }, "401": { description: "Referral authorization required", message: "Referral tracking session required", code: "REFERRAL_SESSION_REQUIRED" }, "503": { description: "Encryption or payout persistence unavailable", message: "Payout details are temporarily unavailable", code: "PAYOUT_DETAILS_UNAVAILABLE" } } },
  { method: "get", path: "/referrals/me", tag: "Referrals", summary: "Get referral dashboard (compatibility)", description: "Compatibility customer endpoint backed by the same canonical referrer identity and safe dashboard DTO.", successMessage: "Referral dashboard fetched successfully", responseSchema: "ReferralDashboard", security: "required", notFoundMessage: "Profile not found" },
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
  ,{
    method: "post", path: "/admin/staff/invite", tag: "Admin Staff Management", summary: "Invite an Admin staff member",
    description: "Active Super Admin only. Creates a pending isolated Admin record, stores only hashed credentials and invitation token, and sends a branded, expiring, one-time activation invitation. Tokens and temporary passwords are never returned.",
    successStatus: 201, successMessage: "Admin invitation sent successfully", responseSchema: "AdminInvitationResult", security: "required", roles: ["SUPER_ADMIN"], bodySchema: "AdminInvitationRequest",
    errorResponses: {
      "403": { description: "Authenticated ADMIN is not permitted to manage Admin staff", message: "Super Admin access is required", code: "SUPER_ADMIN_ACCESS_REQUIRED" },
      "409": { description: "The normalized email or phone already belongs to an Admin", message: "An Admin with this email already exists", code: "ADMIN_EMAIL_ALREADY_EXISTS", examples: { phone: { summary: "Phone already exists", message: "An Admin with this phone already exists", code: "ADMIN_PHONE_ALREADY_EXISTS" } } },
      "503": { description: "Invitation persistence, configuration, or email delivery failed", message: "Unable to create Admin invitation", code: "ADMIN_INVITATION_FAILED", examples: { mail: { summary: "Invitation email delivery failed", message: "Unable to deliver Admin invitation", code: "MAIL_DELIVERY_FAILED" } } }
    }
  }
  ,{
    method: "get", path: "/admin/staff", tag: "Admin Staff Management", summary: "List Admin staff",
    description: "Active Super Admin only. Returns safe Admin identity and real account status fields without password hashes, invitation tokens, OTPs, or session data.",
    successMessage: "Admin staff fetched successfully", responseSchema: "AdminStaffList", security: "required", roles: ["SUPER_ADMIN"],
    errorResponses: {
      "403": { description: "Authenticated ADMIN is not permitted to list Admin staff", message: "Super Admin access is required", code: "SUPER_ADMIN_ACCESS_REQUIRED" },
      "503": { description: "Admin staff persistence unavailable", message: "Admin authentication storage failed", code: "ADMIN_MANAGEMENT_UNAVAILABLE" }
    }
  }
  ,{
    method: "post", path: "/admin/staff/{adminId}/resend-invitation", tag: "Admin Staff Management", summary: "Resend an Admin invitation",
    description: "Active Super Admin only. Enforces a cooldown, invalidates the previous pending invitation, replaces its temporary password and token hashes, and sends a new expiring activation email.",
    successStatus: 202, successMessage: "Admin invitation resent successfully", responseSchema: "AdminInvitationResult", security: "required", roles: ["SUPER_ADMIN"], pathParams: [{ name: "adminId", description: "Admin UUID." }],
    errorResponses: {
      "403": { description: "Authenticated ADMIN is not permitted to manage invitations", message: "Super Admin access is required", code: "SUPER_ADMIN_ACCESS_REQUIRED" },
      "404": { description: "Admin record does not exist", message: "Admin staff member not found", code: "ADMIN_NOT_FOUND" },
      "409": { description: "Admin is already active or cannot be reinvited", message: "Admin invitation cannot be resent", code: "ADMIN_INVITATION_FAILED", examples: { active: { summary: "Already active", message: "Admin is already active", code: "ADMIN_ALREADY_ACTIVE" } } },
      "429": { description: "Invitation resend cooldown or endpoint rate limit", message: "Please wait before resending this invitation", code: "ADMIN_INVITATION_RESEND_COOLDOWN" },
      "503": { description: "Invitation replacement or email delivery failed", message: "Unable to deliver Admin invitation", code: "MAIL_DELIVERY_FAILED" }
    }
  }
  ,{
    method: "post", path: "/admin/auth/activate", tag: "Admin Authentication", summary: "Start invited Admin activation",
    description: "Public but invitation-token protected. Validates the HMAC-hashed, intended-Admin, pending, unused, unexpired invitation and its temporary password, then sends an activation OTP. It never creates a customer or Admin session.",
    successStatus: 202, successMessage: "Activation code sent successfully", responseSchema: "AdminActivationChallenge", bodySchema: "AdminActivationRequest",
    errorResponses: {
      "400": { description: "Invitation token is invalid, revoked, or expired", message: "Invitation token is invalid", code: "INVALID_INVITATION_TOKEN", examples: { expired: { summary: "Expired invitation", message: "Invitation has expired", code: "INVITATION_EXPIRED" } } },
      "401": { description: "Temporary password or pending Admin state is invalid", message: "Admin activation is invalid", code: "ADMIN_ACTIVATION_UNAVAILABLE" },
      "409": { description: "Invitation is already used or the Admin is already active", message: "Invitation has already been used", code: "INVITATION_ALREADY_USED", examples: { active: { summary: "Already active", message: "Admin is already active", code: "ADMIN_ALREADY_ACTIVE" } } },
      "503": { description: "Activation configuration, OTP persistence, or email delivery failed", message: "Admin activation is temporarily unavailable", code: "ADMIN_ACTIVATION_UNAVAILABLE", examples: { mail: { summary: "Activation OTP delivery failed", message: "Unable to deliver Admin activation email", code: "MAIL_DELIVERY_FAILED" } } }
    }
  }
  ,{ method: "post", path: "/admin/auth/resend-activation-otp", tag: "Admin Authentication", summary: "Resend activation OTP", description: "Replaces the pending activation OTP after its cooldown; no session is created.", successStatus: 202, successMessage: "Activation code resent successfully", bodySchema: "AdminResendOtpRequest" }
  ,{ method: "post", path: "/admin/auth/verify-activation-otp", tag: "Admin Authentication", summary: "Verify Admin activation OTP", description: "Returns a short-lived, single-use setup token. It does not activate the account or create a session.", successMessage: "Activation code verified successfully", bodySchema: "AdminOtpVerificationRequest" }
  ,{ method: "post", path: "/admin/auth/set-password", tag: "Admin Authentication", summary: "Complete Admin activation", description: "Consumes the setup token, sets the permanent password, marks the invitation used, and activates the Admin. Normal Admin login is not part of this slice.", successMessage: "Admin account activated successfully", bodySchema: "AdminSetPasswordRequest" }
  ,{ method: "post", path: "/admin/auth/login", tag: "Admin Authentication", summary: "Start Admin login", description: "Validates isolated Admin credentials and emails a mandatory login OTP. No access token is issued by this operation.", successStatus: 202, successMessage: "Login verification code sent successfully", bodySchema: "AdminLoginRequest" }
  ,{ method: "post", path: "/admin/auth/resend-login-otp", tag: "Admin Authentication", summary: "Resend Admin login OTP", description: "Replaces the active Admin login OTP after its cooldown. No session is issued.", successStatus: 202, successMessage: "A new login verification code has been sent", bodySchema: "AdminResendOtpRequest" }
  ,{ method: "post", path: "/admin/auth/verify-login-otp", tag: "Admin Authentication", summary: "Verify Admin login OTP", description: "Issues an Admin-audience access token for normal accounts. Accounts requiring their initial password change receive only a short-lived restricted proof.", successMessage: "Admin login successful", bodySchema: "AdminOtpVerificationRequest" }
  ,{ method: "post", path: "/admin/auth/complete-first-password-change", tag: "Admin Authentication", summary: "Complete forced first Admin password change", description: "Consumes the short-lived restricted proof, verifies the temporary password, invalidates every Admin session, and requires a fresh email/password/OTP login. No Admin session is issued.", successMessage: "Password changed successfully. Please log in again.", bodySchema: "AdminFirstPasswordChangeRequest", errorResponses: { "400": { description: "Password validation or same-password error", message: "New password must differ from current password", code: "NEW_PASSWORD_SAME_AS_CURRENT" }, "401": { description: "Invalid or expired password-change proof", message: "Invalid password-change token", code: "INVALID_ADMIN_PASSWORD_CHANGE_TOKEN" }, "409": { description: "Password-change proof was already consumed", message: "Password-change token has already been used", code: "ADMIN_PASSWORD_CHANGE_TOKEN_USED" } } }
  ,{ method: "post", path: "/admin/auth/refresh", tag: "Admin Authentication", summary: "Rotate an Admin session", description: "Validates and atomically rotates a current Admin refresh token. The old token is replaced and replay revokes the affected Admin sessions.", successMessage: "Admin session refreshed successfully", bodySchema: "AdminRefreshRequest", successExample: { accessToken: "<new-admin-access-token>", refreshToken: "<new-admin-refresh-token>", accessTokenExpiresIn: 900, refreshTokenExpiresIn: 2592000 }, errorResponses: { "401": { description: "Admin refresh token is invalid, expired, revoked, reused, or unbacked by a session", message: "Invalid Admin refresh token", code: "INVALID_ADMIN_REFRESH_TOKEN", examples: { expired: { summary: "Expired token", message: "Admin refresh token has expired", code: "ADMIN_REFRESH_TOKEN_EXPIRED" }, reused: { summary: "Replay detected", message: "Admin refresh token reuse detected; sessions have been revoked", code: "ADMIN_REFRESH_TOKEN_REUSED" } } }, "403": { description: "Admin account is suspended or requires a password change", message: "Admin password change is required", code: "ADMIN_PASSWORD_CHANGE_REQUIRED" }, "423": { description: "Admin account is locked", message: "Admin account is locked", code: "ADMIN_ACCOUNT_LOCKED" }, "503": { description: "Admin session rotation is unavailable", message: "Admin session refresh is temporarily unavailable", code: "ADMIN_SESSION_REFRESH_UNAVAILABLE" } } }
  ,{ method: "post", path: "/admin/auth/logout", tag: "Admin Authentication", summary: "Log out an Admin session", description: "Requires an unrestricted Admin bearer token and its bound refresh token, then revokes that server-tracked session.", successMessage: "Admin logout successful", security: "required", bodySchema: "AdminRefreshRequest", errorResponses: { "401": { description: "Admin access, refresh token, or session is invalid", message: "Invalid Admin refresh token", code: "INVALID_ADMIN_REFRESH_TOKEN" }, "403": { description: "Restricted first-password-change credentials cannot log out a normal session", message: "Admin password change is required", code: "ADMIN_PASSWORD_CHANGE_REQUIRED" }, "503": { description: "Admin session revocation is unavailable", message: "Admin logout is temporarily unavailable", code: "ADMIN_LOGOUT_UNAVAILABLE" } } }
  ,{ method: "patch", path: "/admin/auth/change-password", tag: "Admin Authentication", summary: "Change an authenticated Admin password", description: "Requires an unrestricted Admin bearer token. It verifies the current password, atomically updates the hash and session version, revokes every Admin session, and requires a new OTP login.", successMessage: "Password changed successfully. Please log in again.", security: "required", bodySchema: "AdminChangePasswordRequest", successExample: { sessionsInvalidated: true, nextAction: "ADMIN_LOGIN" }, errorResponses: { "400": { description: "Password policy or confirmation validation failed", message: "Validation failed", code: "PASSWORD_VALIDATION_ERROR" }, "401": { description: "Current password or Admin access token is invalid", message: "Current password is incorrect", code: "CURRENT_PASSWORD_INCORRECT" }, "403": { description: "Restricted or suspended Admin session", message: "Admin password change is required", code: "ADMIN_PASSWORD_CHANGE_REQUIRED" }, "423": { description: "Locked Admin account", message: "Admin account is locked", code: "ADMIN_ACCOUNT_LOCKED" }, "503": { description: "Password update and session invalidation are unavailable", message: "Admin password change is unavailable", code: "ADMIN_PASSWORD_CHANGE_UNAVAILABLE" } } }
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
    {
      summary: string;
      message: string;
      code?: string;
      details?: Record<string, unknown>;
    }
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
                    ...(example.code ? { code: example.code } : {}),
                    ...(example.details ?? {})
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

    const mandateFields = endpoint.multipart.schema === "CreateMandateMultipart"
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
            properties: { ...mandateFields, ...(endpoint.multipart.fields ?? {}), [endpoint.multipart.field]: fileSchema },
            required: endpoint.multipart.schema === "CreateMandateMultipart"
              ? ["mandate_type", "full_name", "email", "phone_number", "address", "terms_accepted"]
              : [endpoint.multipart.field, ...(endpoint.multipart.requiredFields ?? [])]
          },
          encoding: endpoint.multipart.multiple
            ? { [endpoint.multipart.field]: { contentType: "image/jpeg, image/png, image/webp" } }
            : endpoint.multipart.contentType
              ? { [endpoint.multipart.field]: { contentType: endpoint.multipart.contentType } }
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
  {
    url: "/api/v1",
    description: "Current server"
  },
  {
    url: normalizeApiServer(env.swaggerPreviewApiUrl),
    description: "Preview server"
  },
  {
    url: normalizeApiServer(env.swaggerProductionApiUrl),
    description: "Production server"
  },
  {
    url: "http://localhost:5000/api/v1",
    description: "Local development server"
  }
];

const options: swaggerJSDoc.OAS3Options = {
  definition: {
    openapi: "3.0.3",
    info: {
      title: "Beryl Shelter Nigeria Limited API",
      version: "1.0.0",
      description: "Backend API documentation for the Beryl Shelter Nigeria Limited web and mobile applications."
    },
    servers,
    tags: [
      "Health", "Authentication", "Onboarding", "Personas", "Profile", "Properties", "Property Images", "Saved Properties", "Analytics",
      "Referrals", "Inquiries", "Support", "Listings", "Reports", "Mandates", "Transactions", "Notifications",
      "Admin", "Super Admin", "Dashboard", "Admin Authentication", "Admin Staff Management", "Marketplace Draft Documents", "Marketplace Sales Mandate"
    ].map((name) => ({ name })),
    components,
    paths
  },
  apis: []
};

export const swaggerSpec = swaggerJSDoc(options);
