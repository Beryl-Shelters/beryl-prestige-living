import { AppError } from "../../utils/AppError";

export type ReferralOtpDelivery = {
  available: boolean;
  send(input: { phone: string; code: string }): Promise<void>;
};

/**
 * No WhatsApp/SMS transport is configured in this repository. This explicit
 * adapter prevents the API from creating a challenge or claiming a code was sent.
 */
export const unavailableReferralOtpDelivery: ReferralOtpDelivery = {
  available: false,
  async send() {
    throw new AppError(
      "Referral tracking by phone is temporarily unavailable",
      503,
      "REFERRAL_TRACKING_UNAVAILABLE"
    );
  }
};
