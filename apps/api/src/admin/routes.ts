import {
  Router,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import { rateLimit } from "express-rate-limit";
import type { AuthConfig } from "../auth/config.js";
import { AuthError } from "../auth/errors.js";
import { normalizePhone } from "../auth/validation.js";
import type { MediaStorage } from "../listings/media.js";
import type { AdminConfig } from "./config.js";
import {
  adminCustomerDirectoryQuerySchema,
  adminCustomerIdSchema,
} from "./customers-model.js";
import type { AdminCustomersRepository } from "./customers-repository.js";
import { AdminCustomersService } from "./customers-service.js";
import type { AdminInvitationEmail } from "./email.js";
import type { AdminIdentity } from "./identity.js";
import {
  adminLeadIdSchema,
  adminLeadQuerySchema,
  adminLeadTransitionSchema,
} from "./leads-model.js";
import type { AdminLeadsRepository } from "./leads-repository.js";
import { AdminLeadsService } from "./leads-service.js";
import {
  acceptInvitationSchema,
  adminLoginSchema,
  invitationTokenSchema,
  inviteAdminSchema,
} from "./model.js";
import {
  adminPropertyCodeSchema,
  adminPropertyDocumentIdSchema,
  adminPropertyQuerySchema,
  adminPropertyRejectionSchema,
  adminPropertyVersionSchema,
} from "./properties-model.js";
import type { AdminPropertiesRepository } from "./properties-repository.js";
import { AdminPropertiesService } from "./properties-service.js";
import {
  adminCompletedPurchaseSchema,
  adminReferralCodeSchema,
  adminReferralValidationSchema,
} from "./purchases-model.js";
import type { AdminPurchasesRepository } from "./purchases-repository.js";
import { AdminPurchasesService } from "./purchases-service.js";
import {
  adminCommissionIdSchema,
  adminPaymentIdSchema,
  adminPaymentRequestSchema,
  adminReferrerDetailQuerySchema,
  adminReferrerIdSchema,
  adminReferrerQuerySchema,
  adminWithdrawalIdSchema,
  adminWithdrawalRejectionSchema,
} from "./referrers-model.js";
import type { AdminReferrersRepository } from "./referrers-repository.js";
import { AdminReferrersService } from "./referrers-service.js";
import { readPaymentReceipt } from "./referrers-uploads.js";
import type { AdminRepository } from "./repository.js";
import { AdminInvitationService } from "./service.js";
import { AdminSessions } from "./sessions.js";

const wrap =
  (handler: (request: Request, response: Response) => Promise<void>) =>
  (request: Request, response: Response, next: NextFunction) => {
    void handler(request, response).catch(next);
  };
const limited = (limit: number) =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: {
      success: false,
      error: {
        code: "RATE_LIMITED",
        message: "Too many requests. Please try again later.",
      },
    },
  });

export function adminRouter(
  auth: AuthConfig,
  config: AdminConfig,
  repository: AdminRepository,
  customersRepository: AdminCustomersRepository,
  propertiesRepository: AdminPropertiesRepository,
  leadsRepository: AdminLeadsRepository,
  purchasesRepository: AdminPurchasesRepository,
  referrersRepository: AdminReferrersRepository,
  storage: MediaStorage,
  identity: AdminIdentity,
  email: AdminInvitationEmail,
) {
  const router = Router(),
    sessions = new AdminSessions(auth, repository, identity),
    service = new AdminInvitationService(config, repository, identity, email),
    customers = new AdminCustomersService(customersRepository),
    properties = new AdminPropertiesService(propertiesRepository),
    leads = new AdminLeadsService(leadsRepository),
    purchases = new AdminPurchasesService(purchasesRepository),
    referrers = new AdminReferrersService(referrersRepository, storage);
  router.use((request, response, next) => {
    response.setHeader("Cache-Control", "no-store");
    response.vary("Cookie");
    if (
      request.method !== "GET" &&
      (request.headers.origin !== config.appOrigin ||
        !(request.is("application/json") || request.is("multipart/form-data")))
    )
      return next(
        new AuthError(
          403,
          "UNTRUSTED_ORIGIN",
          "This request is not permitted.",
        ),
      );
    next();
  });
  router.post(
    "/auth/login",
    limited(12),
    wrap(async (request, response) => {
      const input = adminLoginSchema.parse(request.body),
        tokens = await identity.login(input.email, input.password),
        profile = await repository.profile(tokens.userId);
      if (!profile?.active)
        throw new AuthError(401, "INVALID_CREDENTIALS", "Invalid credentials.");
      await sessions.establish(request, response, tokens);
      response.json({ success: true, data: { admin: profile } });
    }),
  );
  router.get(
    "/auth/me",
    wrap(async (request, response) => {
      response.json({
        success: true,
        data: { admin: await sessions.account(request) },
      });
    }),
  );
  router.post(
    "/referrers/withdrawals/:withdrawalId/processing",
    limited(30),
    wrap(async(request,response)=>{const caller=await sessions.account(request);if(Object.keys(request.body??{}).length)throw new AuthError(400,"INVALID_WITHDRAWAL_REQUEST","This action does not accept extra fields.");response.json({success:true,data:{withdrawal:await referrers.beginWithdrawal(caller.userId,adminWithdrawalIdSchema.parse(request.params.withdrawalId))}});}),
  );
  router.post(
    "/referrers/withdrawals/:withdrawalId/reject",
    limited(30),
    wrap(async(request,response)=>{const caller=await sessions.account(request),input=adminWithdrawalRejectionSchema.parse(request.body);response.json({success:true,data:{withdrawal:await referrers.rejectWithdrawal(caller.userId,adminWithdrawalIdSchema.parse(request.params.withdrawalId),input.reason)}});}),
  );
  router.get(
    "/referrers/withdrawals/:withdrawalId/payment",
    wrap(async(request,response)=>{const caller=await sessions.account(request);response.json({success:true,data:{payment:await referrers.withdrawalPreview(caller.userId,adminWithdrawalIdSchema.parse(request.params.withdrawalId))}});}),
  );
  router.post(
    "/referrers/withdrawals/:withdrawalId/payment",
    limited(20),
    wrap(async(request,response)=>{const caller=await sessions.account(request),withdrawal=adminWithdrawalIdSchema.parse(request.params.withdrawalId),upload=await readPaymentReceipt(request),input=adminPaymentRequestSchema.parse(upload.data);response.status(201).json({success:true,data:{payment:await referrers.payWithdrawal(input.requestId,caller.userId,withdrawal,upload.file)}});}),
  );
  router.post(
    "/auth/logout",
    wrap(async (request, response) => {
      await sessions.logout(request, response);
      response.json({ success: true, data: {} });
    }),
  );
  router.get(
    "/customers",
    wrap(async (request, response) => {
      await sessions.account(request);
      response.json({
        success: true,
        data: await customers.directory(
          adminCustomerDirectoryQuerySchema.parse(request.query),
        ),
      });
    }),
  );
  router.get(
    "/customers/:customerId",
    wrap(async (request, response) => {
      await sessions.account(request);
      response.json({
        success: true,
        data: {
          customer: await customers.detail(
            adminCustomerIdSchema.parse(request.params.customerId),
          ),
        },
      });
    }),
  );
  router.get(
    "/properties",
    wrap(async (request, response) => {
      await sessions.account(request);
      response.json({
        success: true,
        data: await properties.directory(
          adminPropertyQuerySchema.parse(request.query),
        ),
      });
    }),
  );
  router.get(
    "/properties/:propertyCode",
    wrap(async (request, response) => {
      await sessions.account(request);
      const code = adminPropertyCodeSchema.parse(request.params.propertyCode);
      response.json({
        success: true,
        data: { property: await properties.detail(code) },
      });
    }),
  );
  router.post(
    "/properties/:propertyCode/approve",
    limited(30),
    wrap(async (request, response) => {
      const caller = await sessions.account(request),
        code = adminPropertyCodeSchema.parse(request.params.propertyCode),
        input = adminPropertyVersionSchema.parse(request.body);
      await properties.approve(code, caller.userId, input.version);
      response.json({
        success: true,
        data: { property: await properties.detail(code) },
      });
    }),
  );
  router.post(
    "/properties/:propertyCode/reject",
    limited(30),
    wrap(async (request, response) => {
      const caller = await sessions.account(request),
        code = adminPropertyCodeSchema.parse(request.params.propertyCode),
        input = adminPropertyRejectionSchema.parse(request.body);
      await properties.reject(code, caller.userId, input.version, input.reason);
      response.json({
        success: true,
        data: { property: await properties.detail(code) },
      });
    }),
  );
  router.get(
    "/properties/:propertyCode/documents/:documentId",
    wrap(async (request, response) => {
      await sessions.account(request);
      const code = adminPropertyCodeSchema.parse(request.params.propertyCode),
        document = await properties.document(
          code,
          adminPropertyDocumentIdSchema.parse(request.params.documentId),
          false,
        ),
        bytes = await storage.download(document);
      response.setHeader("Content-Type", document.mime_type);
      response.setHeader(
        "Content-Disposition",
        `attachment; filename="property-document-${request.params.documentId}"`,
      );
      response.send(Buffer.from(bytes));
    }),
  );
  router.get(
    "/properties/:propertyCode/mandate/documents/:documentId",
    wrap(async (request, response) => {
      await sessions.account(request);
      const code = adminPropertyCodeSchema.parse(request.params.propertyCode),
        document = await properties.document(
          code,
          adminPropertyDocumentIdSchema.parse(request.params.documentId),
          true,
        ),
        bytes = await storage.download(document);
      response.setHeader("Content-Type", document.mime_type);
      response.setHeader(
        "Content-Disposition",
        `attachment; filename="mandate-document-${request.params.documentId}"`,
      );
      response.send(Buffer.from(bytes));
    }),
  );
  router.get(
    "/properties/:propertyCode/mandate/signature",
    wrap(async (request, response) => {
      await sessions.account(request);
      const document = await properties.signature(
          adminPropertyCodeSchema.parse(request.params.propertyCode),
        ),
        bytes = await storage.download(document);
      response.setHeader("Content-Type", document.mime_type);
      response.setHeader(
        "Content-Disposition",
        "attachment; filename=mandate-signature.png",
      );
      response.send(Buffer.from(bytes));
    }),
  );
  router.get(
    "/leads",
    wrap(async (request, response) => {
      await sessions.account(request);
      response.json({
        success: true,
        data: await leads.directory(adminLeadQuerySchema.parse(request.query)),
      });
    }),
  );
  router.get(
    "/leads/:leadId",
    wrap(async (request, response) => {
      await sessions.account(request);
      response.json({
        success: true,
        data: {
          lead: await leads.detail(
            adminLeadIdSchema.parse(request.params.leadId),
          ),
        },
      });
    }),
  );
  router.post(
    "/leads/:leadId/stage",
    limited(40),
    wrap(async (request, response) => {
      const caller = await sessions.account(request),
        publicId = adminLeadIdSchema.parse(request.params.leadId),
        input = adminLeadTransitionSchema.parse(request.body);
      await leads.move(publicId, caller.userId, input.stage, input.version);
      response.json({
        success: true,
        data: { lead: await leads.detail(publicId) },
      });
    }),
  );
  router.get(
    "/referrers",
    wrap(async (request, response) => {
      await sessions.account(request);
      response.json({
        success: true,
        data: await referrers.directory(
          adminReferrerQuerySchema.parse(request.query),
        ),
      });
    }),
  );
  router.get(
    "/referrers/commissions/:commissionId/payment",
    wrap(async (request, response) => {
      const caller = await sessions.account(request);
      response.json({
        success: true,
        data: {
          payment: await referrers.preview(
            caller.userId,
            adminCommissionIdSchema.parse(request.params.commissionId),
          ),
        },
      });
    }),
  );
  router.post(
    "/referrers/commissions/:commissionId/payment",
    limited(20),
    wrap(async (request, response) => {
      const caller = await sessions.account(request),
        commission = adminCommissionIdSchema.parse(request.params.commissionId),
        upload = await readPaymentReceipt(request),
        input = adminPaymentRequestSchema.parse(upload.data);
      response
        .status(201)
        .json({
          success: true,
          data: {
            payment: await referrers.pay(
              input.requestId,
              caller.userId,
              commission,
              upload.file,
            ),
          },
        });
    }),
  );
  router.get(
    "/referrers/payments/:paymentId/receipt",
    wrap(async (request, response) => {
      const caller = await sessions.account(request),
        payment = adminPaymentIdSchema.parse(request.params.paymentId),
        asset = await referrers.receipt(caller.userId, payment),
        bytes = await storage.download(asset),
        extension =
          asset.mime_type === "application/pdf"
            ? "pdf"
            : asset.mime_type === "image/png"
              ? "png"
              : "jpg";
      response.setHeader("Content-Type", asset.mime_type);
      response.setHeader(
        "Content-Disposition",
        `attachment; filename="payment-receipt-${payment}.${extension}"`,
      );
      response.setHeader("X-Content-Type-Options", "nosniff");
      response.send(Buffer.from(bytes));
    }),
  );
  router.get(
    "/referrers/:referrerId",
    wrap(async (request, response) => {
      await sessions.account(request);
      const id = adminReferrerIdSchema.parse(request.params.referrerId),
        query = adminReferrerDetailQuerySchema.parse(request.query);
      response.json({
        success: true,
        data: {
          referrer: await referrers.detail(id, query.page, query.pageSize),
        },
      });
    }),
  );
  router.get(
    "/referral-links/:referralCode/validation",
    wrap(async (request, response) => {
      const caller = await sessions.account(request),
        code = adminReferralCodeSchema.parse(request.params.referralCode),
        input = adminReferralValidationSchema.parse(request.query);
      response.json({
        success: true,
        data: {
          referral: await purchases.validate(
            caller.userId,
            code,
            input.customerId,
            input.propertyCode,
            input.closedAt,
          ),
        },
      });
    }),
  );
  router.post(
    "/completed-purchases",
    limited(30),
    wrap(async (request, response) => {
      const caller = await sessions.account(request),
        input = adminCompletedPurchaseSchema.parse(request.body);
      response
        .status(201)
        .json({
          success: true,
          data: await purchases.record(caller.userId, input),
        });
    }),
  );
  router.post(
    "/invitations/validate",
    limited(30),
    wrap(async (request, response) => {
      const { token } = invitationTokenSchema.parse(request.body);
      response.json({
        success: true,
        data: { invitation: await service.preview(token) },
      });
    }),
  );
  router.post(
    "/invitations/accept",
    limited(10),
    wrap(async (request, response) => {
      const input = acceptInvitationSchema.parse(request.body),
        admin = await service.accept(input.token, input.password);
      response.json({ success: true, data: { admin } });
    }),
  );
  router.post(
    "/invitations",
    limited(20),
    wrap(async (request, response) => {
      const caller = await sessions.account(request);
      if (caller.role !== "SUPER_ADMIN")
        throw new AuthError(
          403,
          "ADMIN_INVITE_FORBIDDEN",
          "Only a Super Admin may invite administrators.",
        );
      const input = inviteAdminSchema.parse(request.body),
        phone = normalizePhone(input.phoneNumber, "+234"),
        result = await service.invite(caller.userId, { ...input, phone });
      response
        .status(201)
        .json({ success: true, data: { invitation: result } });
    }),
  );
  return router;
}
