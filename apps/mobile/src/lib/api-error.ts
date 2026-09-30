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

export function transportFailure(error: unknown): MobileApiError {
  if (typeof DOMException !== "undefined" && error instanceof DOMException && ["AbortError", "TimeoutError"].includes(error.name)) {
    return new MobileApiError("network", "The request timed out. Please try again.");
  }
  if (error instanceof TypeError && /network request failed|failed to fetch|networkerror/i.test(error.message)) {
    return new MobileApiError("network", "The request could not reach Beryl Shelter. Check your connection and try again.");
  }
  return new MobileApiError("server", "The request could not be prepared or sent. Please try again.");
}
