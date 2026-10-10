export type ApiErrorKind = "network" | "unauthorized" | "validation" | "conflict" | "not_found" | "server";

export class MobileApiError extends Error {
  constructor(readonly kind: ApiErrorKind, message: string, readonly status?: number, readonly code?: string) { super(message); this.name = "MobileApiError"; }
}

export function errorKind(status: number): ApiErrorKind {
  if (status === 401 || status === 403) return "unauthorized";
  if (status === 404) return "not_found";
  if (status === 409) return "conflict";
  if (status >= 400 && status < 500) return "validation";
  return "server";
}

export function friendlyError(error: unknown): string {
  if (error instanceof MobileApiError) return error.message;
  return "Beryl Shelter could not complete this request. Please try again.";
}

export function responseFailure(status: number, payload: unknown): MobileApiError {
  const envelope = payload && typeof payload === "object" ? payload : null;
  const detail = envelope && "error" in envelope && envelope.error && typeof envelope.error === "object"
    ? envelope.error : null;
  const message = detail && "message" in detail && typeof detail.message === "string" && detail.message.trim()
    ? detail.message : undefined;
  const code = detail && "code" in detail && typeof detail.code === "string" ? detail.code : undefined;
  const fallback = status === 413
    ? "The server could not accept this file size. Please choose a smaller file."
    : status === 401
      ? "Your session has expired. Please log in again."
      : status === 403
        ? "This request is not permitted for your account."
        : status === 429
          ? "Too many requests. Please wait a moment and try again."
          : status === 408 || status === 504
            ? "The server took too long to respond. Please try again."
            : `Beryl Shelter could not complete this request (HTTP ${status}). Please try again.`;
  return new MobileApiError(errorKind(status), message ?? fallback, status, code);
}

export function transportFailure(error: unknown): MobileApiError {
  if (typeof DOMException !== "undefined" && error instanceof DOMException && ["AbortError", "TimeoutError"].includes(error.name)) {
    return new MobileApiError("network", "The request timed out. Please try again.");
  }
  if (error instanceof TypeError && /network request failed|failed to fetch|networkerror/i.test(error.message)) {
    return new MobileApiError("network", "The request could not reach Beryl Shelter. Check your connection and try again.");
  }
  return new MobileApiError("server", "The request could not be prepared or sent. Please try again.");
}
