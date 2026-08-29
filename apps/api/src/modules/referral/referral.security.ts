import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { env } from "../../config/env";
import { AppError } from "../../utils/AppError";

export const hashReferralSecret = (value: string) =>
  createHash("sha256").update(value, "utf8").digest("hex");

const payoutKey = () => {
  try {
    const key = Buffer.from(env.referralPayoutEncryptionKey, "base64");
    if (key.length !== 32) throw new Error("invalid key length");
    return key;
  } catch {
    throw new AppError(
      "Payout details are temporarily unavailable",
      503,
      "PAYOUT_DETAILS_UNAVAILABLE"
    );
  }
};

export const encryptAccountNumber = (accountNumber: string) => {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", payoutKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(accountNumber, "utf8"), cipher.final()]);
  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64")
  };
};

export const decryptAccountNumber = (input: { ciphertext: string; iv: string; authTag: string }) => {
  const decipher = createDecipheriv("aes-256-gcm", payoutKey(), Buffer.from(input.iv, "base64"));
  decipher.setAuthTag(Buffer.from(input.authTag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(input.ciphertext, "base64")),
    decipher.final()
  ]).toString("utf8");
};

export const createReferralTrackingToken = () => randomBytes(32).toString("base64url");
