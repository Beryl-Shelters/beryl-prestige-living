import { randomUUID } from "node:crypto";
import { parse, serialize } from "cookie";
import type { Request, Response } from "express";
import type { AuthConfig } from "./config.js";
import { AuthCipher, hashToken, randomToken } from "./crypto.js";
import { AuthError, expired } from "./errors.js";
import type { AuthGateway, ProviderTokens, StoredSession } from "./gateway.js";

export class AuthSessions {
  readonly cipher: AuthCipher;
  constructor(readonly config: AuthConfig, readonly gateway: AuthGateway) { this.cipher = new AuthCipher(config.encryptionKey); }
  private name(purpose: string) { return `${this.config.cookieSecure ? "__Host-" : ""}beryl_${purpose.toLowerCase()}`; }
  cookie(request: Request, purpose: string) { return parse(request.headers.cookie ?? "")[this.name(purpose)]; }
  setCookie(response: Response, purpose: string, value: string, seconds: number) {
    response.append("Set-Cookie", serialize(this.name(purpose), value, {
      httpOnly: true, secure: this.config.cookieSecure, sameSite: this.config.cookieSameSite,
      path: "/", maxAge: seconds,
    }));
  }
  clear(response: Response, purpose: string) { this.setCookie(response, purpose, "", 0); }
  setChallenge(response: Response, purpose: string, payload: Record<string, string>, seconds = 1800) {
    this.setCookie(response, purpose, this.cipher.seal({ ...payload, expires: Date.now() + seconds * 1000 }, purpose), seconds);
  }
  challenge(request: Request, purpose: string): Record<string, string> | undefined {
    const value = this.cipher.open<Record<string, string> & { expires: number }>(this.cookie(request, purpose) ?? "", purpose);
    return value && value.expires > Date.now() ? value : undefined;
  }
  async establish(request: Request, response: Response, purpose: "ACCOUNT" | "RECOVERY", tokens: ProviderTokens) {
    const old = this.cookie(request, purpose);
    if (old) await this.gateway.deleteSession(hashToken(old));
    const raw = randomToken();
    const ttl = purpose === "RECOVERY" ? 600 : this.config.sessionSeconds;
    await this.gateway.createSession(hashToken(raw), tokens.userId, purpose, this.cipher.seal(tokens, "provider-tokens"), ttl);
    this.setCookie(response, purpose, raw, ttl);
  }
  decode(record: StoredSession): ProviderTokens {
    const tokens = this.cipher.open<ProviderTokens>(record.encrypted_tokens, "provider-tokens");
    if (!tokens || tokens.userId !== record.user_id) throw expired();
    return tokens;
  }
  async account(request: Request) {
    const raw = this.cookie(request, "ACCOUNT");
    if (!raw) throw expired();
    const hash = hashToken(raw);
    const record = await this.gateway.readSession(hash, "ACCOUNT");
    if (!record) throw expired();
    let tokens = this.decode(record);
    if (tokens.expiresAt <= Date.now() / 1000 + 30) {
      const lock = randomUUID();
      const leased = await this.gateway.claimRefresh(hash, lock);
      if (!leased) throw new AuthError(409, "SESSION_REFRESHING", "Your session is refreshing. Please try again.");
      tokens = this.decode(leased);
      try {
        if (tokens.expiresAt <= Date.now() / 1000 + 30) tokens = await this.gateway.refresh(tokens);
        if (!await this.gateway.finishRefresh(hash, lock, this.cipher.seal(tokens, "provider-tokens"))) throw expired();
      } catch (error) {
        await this.gateway.deleteSession(hash);
        throw error;
      }
    }
    await this.gateway.validate(tokens);
    return tokens;
  }
  async logout(request: Request, response: Response) {
    const raw = this.cookie(request, "ACCOUNT");
    if (raw) {
      const record = await this.gateway.readSession(hashToken(raw), "ACCOUNT");
      if (record) {
        await this.gateway.deleteUserSessions(record.user_id);
        await this.gateway.signOut(this.decode(record));
      } else await this.gateway.deleteSession(hashToken(raw));
    }
    const recovery = this.cookie(request, "RECOVERY");
    if (recovery) await this.gateway.deleteSession(hashToken(recovery));
    for (const purpose of ["ACCOUNT", "RECOVERY", "VERIFY", "FORGOT", "OAUTH"]) this.clear(response, purpose);
  }
}
