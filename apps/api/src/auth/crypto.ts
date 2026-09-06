import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

export const randomToken = () => randomBytes(32).toString("base64url");
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export class AuthCipher {
  private readonly key: Buffer;
  constructor(key: string) { this.key = Buffer.from(key, "base64"); }
  seal(value: unknown, purpose: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    cipher.setAAD(Buffer.from(purpose));
    const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64url");
  }
  open<T>(value: string, purpose: string): T | undefined {
    try {
      const data = Buffer.from(value, "base64url");
      const decipher = createDecipheriv("aes-256-gcm", this.key, data.subarray(0, 12));
      decipher.setAAD(Buffer.from(purpose));
      decipher.setAuthTag(data.subarray(12, 28));
      return JSON.parse(Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString("utf8")) as T;
    } catch { return undefined; }
  }
}
