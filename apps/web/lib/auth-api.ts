export class AuthApiError extends Error {
  constructor(public code: string, message: string, public status = 0) { super(message); }
}

export type Customer = {
  id: string; first_name: string | null; last_name: string | null; email: string;
  country_code: string | null; phone_number: string | null;
  account_type: string | null; profile_type: string | null; email_verified_at: string | null;
};

function apiBase(): string {
  const configured = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!configured) throw new AuthApiError("CONFIGURATION_UNAVAILABLE", "Account services are not configured yet. Please try again later.");
  return configured.replace(/\/$/, "");
}

export async function authRequest<T = Record<string, never>>(path: string, body?: unknown, refreshAttempts = 0): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${apiBase()}/api/v1/auth${path}`, {
      method: body === undefined ? "GET" : "POST", credentials: "include", cache: "no-store",
      headers: { "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch (error) {
    if (error instanceof AuthApiError) throw error;
    throw new AuthApiError("NETWORK_ERROR", "Could not connect to account services. Please try again.");
  }
  let payload: { success: boolean; data?: T; error?: { code: string; message: string } };
  try { payload = await response.json(); }
  catch { throw new AuthApiError("INVALID_RESPONSE", "Account services are temporarily unavailable.", response.status); }
  if (body === undefined && payload.error?.code === "SESSION_REFRESHING" && refreshAttempts < 3) {
    await new Promise((resolve) => setTimeout(resolve, 400));
    return authRequest<T>(path, undefined, refreshAttempts + 1);
  }
  if (!response.ok || !payload.success) throw new AuthApiError(payload.error?.code ?? "REQUEST_FAILED", payload.error?.message ?? "Please try again.", response.status);
  return payload.data as T;
}
