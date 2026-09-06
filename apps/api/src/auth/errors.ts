import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";

export class AuthError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export const unavailable = () => new AuthError(503, "AUTH_UNAVAILABLE", "Authentication is temporarily unavailable.");
export const expired = () => new AuthError(401, "SESSION_EXPIRED", "Your session has expired. Please log in again.");
export const invalidCode = () => new AuthError(400, "INVALID_OR_EXPIRED_CODE", "The verification code is invalid or expired. Request a new code.");

export const authErrorHandler: ErrorRequestHandler = (error: unknown, _request, response, _next) => {
  // Express recognizes error middleware by its four-argument signature.
  void _next;
  if (error instanceof SyntaxError && "status" in error && error.status === 400) {
    response.status(400).json({ success: false, error: { code: "INVALID_JSON", message: "The request body must be valid JSON." } });
    return;
  }
  if (error instanceof ZodError) {
    response.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: error.issues[0]?.message ?? "Check the supplied fields." } });
    return;
  }
  const safe = error instanceof AuthError ? error : unavailable();
  // Never log request bodies, identifiers, upstream exceptions, cookies or tokens.
  if (safe.status >= 500) console.error(JSON.stringify({ event: "auth_failure", code: safe.code }));
  response.status(safe.status).json({ success: false, error: { code: safe.code, message: safe.message } });
};
