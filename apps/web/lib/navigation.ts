import type { Route } from "next";
import type { NextAction } from "./contracts";

export const routeForNextAction = (action: NextAction): Route => {
  switch (action) {
    case "VERIFY_EMAIL":
      return "/verify-email";
    case "COMPLETE_BUYER_ONBOARDING":
    case "ACTIVATE_BUYER_PERSONA":
      return "/onboarding/buyer";
    case "COMPLETE_SELLER_ONBOARDING":
    case "ACTIVATE_SELLER_PERSONA":
      return "/onboarding/seller";
    case "OPEN_SELLER_DASHBOARD":
      return "/seller";
    case "VERIFY_PASSWORD_RESET_OTP":
      return "/verify-reset-otp";
    case "SET_NEW_PASSWORD":
      return "/reset-password";
    case "LOGIN":
      return "/login";
    default:
      return "/buyer";
  }
};
