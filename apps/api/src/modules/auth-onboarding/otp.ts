import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { OtpPurpose } from "./auth-onboarding.types";

export const generateSixDigitOtp = () =>
  randomInt(0, 1_000_000).toString().padStart(6, "0");

export const hashOtp = (
  secret: string,
  normalizedEmail: string,
  purpose: OtpPurpose,
  otp: string
) =>
  createHmac("sha256", secret)
    .update(`${normalizedEmail}|${purpose}|${otp}`, "utf8")
    .digest("hex");

export const safelyEqualHashes = (left: string, right: string) => {
  const leftBuffer = Buffer.from(left, "hex");
  const rightBuffer = Buffer.from(right, "hex");

  return (
    leftBuffer.length === rightBuffer.length &&
    leftBuffer.length > 0 &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
};
