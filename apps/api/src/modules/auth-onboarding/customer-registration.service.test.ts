import { describe, expect, it, beforeEach, vi } from "vitest";
import { CustomerServerAnalytics } from "../../analytics/customer-server-analytics";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { MailService, RegistrationOtpMail } from "../../services/mail.service";
import { AppError } from "../../utils/AppError";
import { personaForGettingStartedAs } from "./auth-onboarding.types";
import { CustomerRegistrationService } from "./customer-registration.service";
import {
  CustomerRegistrationStore,
  PendingCustomer,
  RegisterCustomerInput,
  ReplaceOtpResult,
  VerifyOtpResult
} from "./customer-registration.types";
import { customerRegisterSchema } from "./customer.validators";
import { safelyEqualHashes } from "./otp";

type Account = PendingCustomer & {
  phone: string;
  initialPersona: "BUYER" | "SELLER_DEVELOPER";
  accountStatus: "PENDING_VERIFICATION" | "ACTIVE";
  emailVerified: boolean;
  authEmailConfirmed: boolean;
};

type Challenge = {
  id: string;
  userId: string;
  codeHash: string;
  attempts: number;
  maxAttempts: number;
  expiresAt: Date;
  resendAvailableAt: Date;
  consumedAt?: Date;
  invalidatedAt?: Date;
};

class InMemoryRegistrationStore implements CustomerRegistrationStore {
  readonly accounts = new Map<string, Account>();
  readonly challenges: Challenge[] = [];
  readonly personas = new Map<string, Set<string>>();
  readonly customerRecords = new Set<string>();
  private sequence = 0;

  async findConflict(email: string, phone: string) {
    for (const account of this.accounts.values()) {
      if (account.email === email) return "EMAIL" as const;
      if (account.phone === phone) return "PHONE" as const;
    }
    return null;
  }

  async createPendingCustomer(input: RegisterCustomerInput) {
    const id = `user-${++this.sequence}`;
    const account: Account = {
      id,
      fullName: input.fullName,
      email: input.email,
      phone: input.phone,
      initialPersona: personaForGettingStartedAs[input.gettingStartedAs],
      accountStatus: "PENDING_VERIFICATION",
      emailVerified: false,
      authEmailConfirmed: false
    };
    this.accounts.set(id, account);
    return account;
  }

  async deletePendingCustomer(userId: string) {
    this.accounts.delete(userId);
    for (const challenge of this.challenges) {
      if (challenge.userId === userId) challenge.invalidatedAt = new Date();
    }
  }

  async replaceVerificationOtp(input: {
    email: string;
    codeHash: string;
    expiresAt: Date;
    resendAvailableAt: Date;
    maxAttempts: number;
    now: Date;
  }): Promise<ReplaceOtpResult> {
    const account = [...this.accounts.values()].find(
      (candidate) => candidate.email === input.email
    );
    if (!account || account.accountStatus !== "PENDING_VERIFICATION") {
      return { status: "NOT_ELIGIBLE" };
    }

    const current = [...this.challenges]
      .reverse()
      .find(
        (challenge) =>
          challenge.userId === account.id &&
          !challenge.consumedAt &&
          !challenge.invalidatedAt
      );
    if (current && current.resendAvailableAt > input.now) {
      return {
        status: "COOLDOWN",
        challengeId: current.id,
        resendAvailableAt: current.resendAvailableAt
      };
    }

    for (const challenge of this.challenges) {
      if (
        challenge.userId === account.id &&
        !challenge.consumedAt &&
        !challenge.invalidatedAt
      ) {
        challenge.invalidatedAt = input.now;
      }
    }

    const challenge: Challenge = {
      id: `challenge-${++this.sequence}`,
      userId: account.id,
      codeHash: input.codeHash,
      attempts: 0,
      maxAttempts: input.maxAttempts,
      expiresAt: input.expiresAt,
      resendAvailableAt: input.resendAvailableAt
    };
    this.challenges.push(challenge);
    return {
      status: "REPLACED",
      challengeId: challenge.id,
      userId: account.id,
      email: account.email,
      fullName: account.fullName,
      resendAvailableAt: challenge.resendAvailableAt
    };
  }

  async invalidateVerificationOtp(challengeId: string, now: Date) {
    const challenge = this.challenges.find((candidate) => candidate.id === challengeId);
    if (challenge) challenge.invalidatedAt = now;
  }

  async verifyEmailOtp(input: {
    email: string;
    codeHash: string;
    now: Date;
  }): Promise<VerifyOtpResult> {
    const account = [...this.accounts.values()].find(
      (candidate) => candidate.email === input.email
    );
    if (!account) return { status: "INVALID_OTP", attemptsRemaining: 0 };

    const matched = [...this.challenges]
      .reverse()
      .find(
        (challenge) =>
          challenge.userId === account.id &&
          safelyEqualHashes(challenge.codeHash, input.codeHash)
      );
    if (matched?.invalidatedAt) return { status: "OTP_SUPERSEDED", userId: account.id };
    if (matched?.consumedAt) return { status: "OTP_CONSUMED", userId: account.id };

    const active = [...this.challenges]
      .reverse()
      .find(
        (challenge) =>
          challenge.userId === account.id &&
          !challenge.invalidatedAt &&
          !challenge.consumedAt
      );
    if (!active) return { status: "INVALID_OTP", userId: account.id };
    if (active.expiresAt <= input.now) {
      active.invalidatedAt = input.now;
      return { status: "OTP_EXPIRED", userId: account.id };
    }
    if (active.attempts >= active.maxAttempts) {
      return { status: "OTP_MAX_ATTEMPTS", userId: account.id };
    }
    if (!safelyEqualHashes(active.codeHash, input.codeHash)) {
      active.attempts += 1;
      return {
        status:
          active.attempts >= active.maxAttempts ? "OTP_MAX_ATTEMPTS" : "INVALID_OTP",
        userId: account.id,
        attemptsRemaining: Math.max(active.maxAttempts - active.attempts, 0)
      };
    }

    active.consumedAt = input.now;
    account.accountStatus = "ACTIVE";
    account.emailVerified = true;
    account.authEmailConfirmed = true;
    const membership = this.personas.get(account.id) ?? new Set<string>();
    membership.add(account.initialPersona);
    this.personas.set(account.id, membership);
    this.customerRecords.add(account.id);

    return {
      status: "VERIFIED",
      userId: account.id,
      accountStatus: "ACTIVE",
      emailVerified: true,
      activePersona: account.initialPersona,
      personas: [...membership] as Array<"BUYER" | "SELLER_DEVELOPER">,
      onboardingStatus: "NOT_STARTED",
      nextAction:
        account.initialPersona === "BUYER"
          ? "COMPLETE_BUYER_ONBOARDING"
          : "COMPLETE_SELLER_ONBOARDING"
    };
  }

}

class CapturingMailService implements MailService {
  readonly messages: RegistrationOtpMail[] = [];
  shouldFail = false;

  async sendRegistrationOtp(message: RegistrationOtpMail) {
    if (this.shouldFail) throw new Error("Mail provider unavailable");
    this.messages.push({ ...message });
  }

  async sendPasswordResetOtp() {
    throw new Error("Password-reset mail is not used by registration tests");
  }
}

const registrationBody = {
  fullName: "Test Customer",
  email: "customer@example.com",
  phone: "+2348012345678",
  isWhatsAppNumber: true,
  whatsAppNumber: null,
  gettingStartedAs: "FIND_PROPERTY" as const,
  password: "Password123!",
  confirmPassword: "Password123!"
};

describe("customer registration vertical slice", () => {
  let store: InMemoryRegistrationStore;
  let mail: CapturingMailService;
  let currentTime: Date;
  let generatedOtp: string;
  let service: CustomerRegistrationService;
  const analytics = {
    signupBlockedDuplicate: vi.fn(), accountCreated: vi.fn(), otpSent: vi.fn(), otpVerificationSucceeded: vi.fn(),
    personaActivated: vi.fn(), customerLoggedIn: vi.fn(), loginFailed: vi.fn(), passwordResetOtpVerified: vi.fn(), passwordResetCompleted: vi.fn()
  } as unknown as CustomerServerAnalytics;

  beforeEach(() => {
    store = new InMemoryRegistrationStore();
    mail = new CapturingMailService();
    currentTime = new Date("2026-07-28T10:00:00.000Z");
    generatedOtp = "123456";
    vi.clearAllMocks();
    service = new CustomerRegistrationService(store, mail, {
      otpSecret: "test-only-otp-secret-with-sufficient-entropy",
      otpExpiryMinutes: 10,
      otpResendCooldownSeconds: 60,
      otpMaxAttempts: 3,
      now: () => new Date(currentTime),
      generateOtp: () => generatedOtp
    }, analytics);
  });

  const validInput = () => customerRegisterSchema.parse(registrationBody);
  const registeredAccountId = () => [...store.accounts.keys()][0];

  it("registers a valid pending customer and sends one OTP", async () => {
    const result = await service.register(validInput());
    expect(result).toMatchObject({
      verificationRequired: true,
      maskedEmail: "c***r@example.com",
      otpLength: 6,
      resendAvailableIn: 60,
      nextAction: "VERIFY_EMAIL"
    });
    expect(result).not.toHaveProperty("password");
    expect(result).not.toHaveProperty("confirmPassword");
    expect(mail.messages).toHaveLength(1);
    expect(store.accounts.get(registeredAccountId())?.initialPersona).toBe("BUYER");
    expect(analytics.accountCreated).toHaveBeenCalledWith(registeredAccountId(), "Find a Property");
    expect(analytics.otpSent).toHaveBeenCalledWith(registeredAccountId(), "signup");
  });

  it("registers the Seller/Developer path as pending verification", async () => {
    const input = customerRegisterSchema.parse({
      ...registrationBody,
      email: "seller@example.com",
      phone: "+2348098765432",
      gettingStartedAs: "LIST_PROPERTY"
    });

    await service.register(input);

    expect(store.accounts.get(registeredAccountId())).toMatchObject({
      initialPersona: "SELLER_DEVELOPER",
      accountStatus: "PENDING_VERIFICATION",
      emailVerified: false
    });
  });

  it("rejects duplicate normalized email", async () => {
    await service.register(validInput());
    const duplicate = customerRegisterSchema.parse({
      ...registrationBody,
      email: " CUSTOMER@EXAMPLE.COM ",
      phone: "+2348099999999"
    });
    await expect(service.register(duplicate, "$device:anonymous-customer-1")).rejects.toMatchObject({
      statusCode: 409,
      code: "EMAIL_ALREADY_REGISTERED"
    });
    expect(analytics.signupBlockedDuplicate).toHaveBeenCalledWith("email", "$device:anonymous-customer-1");
  });

  it("rejects duplicate normalized phone", async () => {
    await service.register(validInput());
    const duplicate = customerRegisterSchema.parse({
      ...registrationBody,
      email: "another@example.com",
      phone: "0801 234 5678"
    });
    await expect(service.register(duplicate, "$device:anonymous-customer-1")).rejects.toMatchObject({
      statusCode: 409,
      code: "PHONE_ALREADY_REGISTERED"
    });
    expect(analytics.signupBlockedDuplicate).toHaveBeenCalledWith("phone", "$device:anonymous-customer-1");
  });

  it("accepts a null WhatsApp override when the phone is WhatsApp", () => {
    expect(customerRegisterSchema.safeParse(registrationBody).success).toBe(true);
  });

  it("rejects a missing separate WhatsApp number", () => {
    expect(
      customerRegisterSchema.safeParse({
        ...registrationBody,
        isWhatsAppNumber: false,
        whatsAppNumber: null
      }).success
    ).toBe(false);
  });

  it("rejects a weak password", () => {
    expect(
      customerRegisterSchema.safeParse({
        ...registrationBody,
        password: "password",
        confirmPassword: "password"
      }).success
    ).toBe(false);
  });

  it("verifies the correct OTP and confirms managed Auth email", async () => {
    await service.register(validInput());
    const result = await service.verifyEmail({
      email: registrationBody.email,
      otp: "123456"
    });
    expect(result).toMatchObject({ accountStatus: "ACTIVE", emailVerified: true });
    expect(analytics.otpVerificationSucceeded).toHaveBeenCalledWith(registeredAccountId(), "signup");
    expect(store.accounts.get(registeredAccountId())?.authEmailConfirmed).toBe(true);
  });

  it("stores only the OTP hash", async () => {
    await service.register(validInput());
    expect(store.challenges[0].codeHash).not.toBe("123456");
    expect(store.challenges[0].codeHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("rejects a wrong OTP", async () => {
    await service.register(validInput());
    await expect(
      service.verifyEmail({ email: registrationBody.email, otp: "999999" })
    ).rejects.toMatchObject({ code: "INVALID_OTP", details: { attemptsRemaining: 2 } });
  });

  it("rejects an expired OTP", async () => {
    await service.register(validInput());
    currentTime = new Date(currentTime.getTime() + 11 * 60_000);
    await expect(
      service.verifyEmail({ email: registrationBody.email, otp: "123456" })
    ).rejects.toMatchObject({ code: "OTP_EXPIRED" });
  });

  it("enforces the maximum attempt count", async () => {
    await service.register(validInput());
    for (let attempt = 0; attempt < 2; attempt += 1) {
      await expect(
        service.verifyEmail({ email: registrationBody.email, otp: "999999" })
      ).rejects.toBeInstanceOf(AppError);
    }
    await expect(
      service.verifyEmail({ email: registrationBody.email, otp: "999999" })
    ).rejects.toMatchObject({ code: "OTP_ATTEMPTS_EXCEEDED" });
    await expect(
      service.verifyEmail({ email: registrationBody.email, otp: "123456" })
    ).rejects.toMatchObject({ code: "OTP_ATTEMPTS_EXCEEDED" });
  });

  it("enforces resend cooldown without issuing another message", async () => {
    await service.register(validInput());
    await expect(
      service.resendVerificationOtp({ email: registrationBody.email })
    ).rejects.toMatchObject({
      code: "OTP_RESEND_COOLDOWN",
      details: { retryAfter: 60 }
    });
    expect(mail.messages).toHaveLength(1);
    expect(store.challenges).toHaveLength(1);
  });

  it("does not duplicate persona records when verification is retried", async () => {
    await service.register(validInput());
    await service.verifyEmail({ email: registrationBody.email, otp: "123456" });
    await expect(
      service.verifyEmail({ email: registrationBody.email, otp: "123456" })
    ).rejects.toMatchObject({ code: "OTP_NO_LONGER_VALID" });
    expect(store.personas.get(registeredAccountId())?.size).toBe(1);
  });

  it("does not duplicate the customer record when verification is retried", async () => {
    await service.register(validInput());
    await service.verifyEmail({ email: registrationBody.email, otp: "123456" });
    await expect(
      service.verifyEmail({ email: registrationBody.email, otp: "123456" })
    ).rejects.toBeInstanceOf(AppError);
    expect(store.customerRecords.size).toBe(1);
  });

  it("stores registration as pending verification", async () => {
    await service.register(validInput());
    expect(store.accounts.get(registeredAccountId())?.accountStatus).toBe(
      "PENDING_VERIFICATION"
    );
  });

  it("does not mark email verified during registration", async () => {
    await service.register(validInput());
    expect(store.accounts.get(registeredAccountId())?.emailVerified).toBe(false);
    expect(store.accounts.get(registeredAccountId())?.authEmailConfirmed).toBe(false);
  });

  it("resend invalidates the previous active OTP", async () => {
    await service.register(validInput());
    currentTime = new Date(currentTime.getTime() + 61_000);
    generatedOtp = "654321";
    await service.resendVerificationOtp({ email: registrationBody.email });
    expect(store.challenges).toHaveLength(2);
    expect(store.challenges[0].invalidatedAt).toEqual(currentTime);
  });

  it("does not permit a consumed OTP to be reused", async () => {
    await service.register(validInput());
    await service.verifyEmail({ email: registrationBody.email, otp: "123456" });
    await expect(
      service.verifyEmail({ email: registrationBody.email, otp: "123456" })
    ).rejects.toMatchObject({ code: "OTP_NO_LONGER_VALID" });
  });

  it("does not permit a superseded OTP to be reused", async () => {
    await service.register(validInput());
    currentTime = new Date(currentTime.getTime() + 61_000);
    generatedOtp = "654321";
    await service.resendVerificationOtp({ email: registrationBody.email });
    await expect(
      service.verifyEmail({ email: registrationBody.email, otp: "123456" })
    ).rejects.toMatchObject({ code: "OTP_NO_LONGER_VALID" });
  });

  it("creates Buyer membership for FIND_PROPERTY", async () => {
    await service.register(validInput());
    const result = await service.verifyEmail({
      email: registrationBody.email,
      otp: "123456"
    });
    expect(result.activePersona).toBe("BUYER");
    expect(store.personas.get(registeredAccountId())).toEqual(new Set(["BUYER"]));
  });

  it("creates Seller/Developer membership for LIST_PROPERTY", async () => {
    const input = customerRegisterSchema.parse({
      ...registrationBody,
      gettingStartedAs: "LIST_PROPERTY"
    });
    await service.register(input);
    const result = await service.verifyEmail({ email: input.email, otp: "123456" });
    expect(result.activePersona).toBe("SELLER_DEVELOPER");
    expect(store.personas.get(registeredAccountId())).toEqual(
      new Set(["SELLER_DEVELOPER"])
    );
  });

  it("does not report resend success when the email provider fails", async () => {
    await service.register(validInput());
    currentTime = new Date(currentTime.getTime() + 61_000);
    generatedOtp = "654321";
    mail.shouldFail = true;

    await expect(
      service.resendVerificationOtp({ email: registrationBody.email })
    ).rejects.toMatchObject({ statusCode: 503, code: "MAIL_DELIVERY_FAILED" });
    expect(store.challenges.at(-1)?.invalidatedAt).toEqual(currentTime);
  });

  it("tracks account persistence but not OTP delivery when the initial email fails", async () => {
    mail.shouldFail = true;
    await expect(service.register(validInput())).rejects.toMatchObject({ code: "REGISTRATION_UNAVAILABLE" });
    expect(analytics.accountCreated).toHaveBeenCalledWith("user-1", "Find a Property");
    expect(analytics.otpSent).not.toHaveBeenCalled();
  });

  it("does not track account creation when persistence fails", async () => {
    store.createPendingCustomer = async () => { throw new Error("storage unavailable"); };
    await expect(service.register(validInput())).rejects.toMatchObject({ code: "REGISTRATION_UNAVAILABLE" });
    expect(analytics.accountCreated).not.toHaveBeenCalled();
    expect(analytics.otpSent).not.toHaveBeenCalled();
  });

  it("keeps persona and customer projections unique under concurrent retry", async () => {
    await service.register(validInput());
    const results = await Promise.allSettled([
      service.verifyEmail({ email: registrationBody.email, otp: "123456" }),
      service.verifyEmail({ email: registrationBody.email, otp: "123456" })
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(store.personas.get(registeredAccountId())?.size).toBe(1);
    expect(store.customerRecords.size).toBe(1);
  });

  it("preserves the existing Admin Portal customer-users route", () => {
    const source = readFileSync(
      join(process.cwd(), "src/routes/index.ts"),
      "utf8"
    );
    expect(source).toContain('router.use("/admin/users", adminUserRoutes)');
  });
});
