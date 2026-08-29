import { formatReferralMoney, paymentLabel, purposeLabel, referralErrorMessage, referralInitials, referralRoutes, referralStatus } from "./helpers";
import { guestReferrerSchema, referredPersonSchema, referralOtpSchema, referralPayoutSchema, referralTrackingIdentitySchema } from "./schemas";

describe("mobile referral helpers and validation", () => {
  it("normalizes a guest Nigerian phone", () => expect(guestReferrerSchema.parse({ fullName: "Emeka Nwachukwu", phone: "0801 234 5678" }).phone).toBe("+2348012345678"));
  it("rejects an invalid guest phone", () => expect(guestReferrerSchema.safeParse({ fullName: "Emeka Nwachukwu", phone: "123" }).success).toBe(false));
  it("accepts referred WhatsApp phone details", () => expect(referredPersonSchema.safeParse({ fullName: "Ada Okeke", contactMethod: "WHATSAPP", contact: "0802 999 1122" }).success).toBe(true));
  it("accepts referred email details", () => expect(referredPersonSchema.safeParse({ fullName: "Ada Okeke", contactMethod: "EMAIL", contact: "ada@example.com" }).success).toBe(true));
  it("rejects a malformed referred email", () => expect(referredPersonSchema.safeParse({ fullName: "Ada Okeke", contactMethod: "EMAIL", contact: "ada" }).success).toBe(false));
  it("validates a six-digit OTP", () => { expect(referralOtpSchema.safeParse("123456").success).toBe(true); expect(referralOtpSchema.safeParse("12345").success).toBe(false); });
  it("validates tracking identity", () => expect(referralTrackingIdentitySchema.parse({ fullName: "Ada Okeke", phone: "08029991122" }).phone).toBe("+2348029991122"));
  it("requires a ten-digit payout account number", () => { expect(referralPayoutSchema.safeParse({ bankCode: "999992", accountNumber: "1234567890", accountName: "Ada Okeke" }).success).toBe(true); expect(referralPayoutSchema.safeParse({ bankCode: "999992", accountNumber: "123", accountName: "Ada Okeke" }).success).toBe(false); });
  it("maps canonical lifecycle statuses", () => { expect(referralStatus("NEW").label).toBe("New"); expect(referralStatus("CONTACTED").label).toBe("In Progress"); expect(referralStatus("IN_PROGRESS").label).toBe("In Progress"); expect(referralStatus("COMPLETED").label).toBe("Completed"); expect(referralStatus("LOST").label).toBe("Didn't proceed"); });
  it("maps purpose and payment labels", () => { expect(purposeLabel("BUYING")).toBe("Buying"); expect(purposeLabel("SELLING")).toBe("Selling"); expect(paymentLabel("OUTSTANDING")).toBe("Not paid yet"); expect(paymentLabel("PAID")).toBe("Paid"); });
  it("formats authoritative reward values without calculating them", () => expect(formatReferralMoney(2500000)).toBe("₦2,500,000"));
  it("creates safe two-letter initials", () => expect(referralInitials("Ada Ifeoma Okeke")).toBe("AI"));
  it("maps configured-provider delivery failure to a safe WhatsApp retry message", () => expect(referralErrorMessage("REFERRAL_OTP_DELIVERY_FAILED")).toBe("We could not send the WhatsApp code. Please try again."));
  it("centralizes canonical referral routes", () => expect(referralRoutes).toEqual({ landing: "/refer", dashboard: "/referrals", newReferral: "/referrals/new", tracking: "/referrals/track", bankDetails: "/referrals/bank-details" }));
});
