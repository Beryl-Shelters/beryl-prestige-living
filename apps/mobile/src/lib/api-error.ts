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
  return "We could not connect to Beryl Shelter. Check your connection and try again.";
}
