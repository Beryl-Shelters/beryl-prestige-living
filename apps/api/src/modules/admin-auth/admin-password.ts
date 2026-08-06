import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export const hashAdminPassword = (password: string) => {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `scrypt$16384$8$1$${salt.toString("base64")}$${hash.toString("base64")}`;
};

export const verifyAdminPassword = (password: string, encoded: string) => {
  const [algorithm, , , , saltValue, hashValue] = encoded.split("$");
  if (algorithm !== "scrypt" || !saltValue || !hashValue) return false;
  try {
    const expected = Buffer.from(hashValue, "base64");
    const actual = scryptSync(password, Buffer.from(saltValue, "base64"), expected.length);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch { return false; }
};

export const createTemporaryAdminPassword = () => randomBytes(18).toString("base64url");
