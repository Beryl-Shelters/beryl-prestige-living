import axios from "axios";
import type { ApiError } from "../contracts";

export const apiErrorOf = (error: unknown): ApiError => {
  if (axios.isAxiosError<ApiError>(error) && error.response?.data) return error.response.data;
  return { success: false, message: "Something went wrong. Please try again." };
};

export const friendlyAuthError = (error: ApiError) => {
  switch (error.code) {
    case "INVALID_CREDENTIALS":
      return "That email/phone or password is not right.";
    case "LOGIN_RATE_LIMITED":
      return "Too many attempts. Please wait a few minutes, then try again.";
    case "ACCOUNT_VERIFICATION_REQUIRED":
      return "Verify your email before logging in.";
    case "ACCOUNT_SUSPENDED":
      return "This account is suspended. Contact support for help.";
    case "ACCOUNT_LOCKED":
      return "This account is locked. Contact support for help.";
    case "EMAIL_ALREADY_REGISTERED":
      return "An account with this email already exists. Log in or reset your password.";
    case "PHONE_ALREADY_REGISTERED":
      return "An account with this phone number already exists.";
    default:
      return error.message || "Something went wrong. Please try again.";
  }
};
