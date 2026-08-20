import type { NextResponse } from "next/server";
import type { CustomerSessionState } from "../contracts";

export const SESSION_COOKIES = {
  access: "beryl_customer_access",
  refresh: "beryl_customer_refresh",
  state: "beryl_customer_state",
  resetProof: "beryl_reset_proof"
} as const;

const options = (maxAge: number) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge
});

const customerSessionMaxAge = 60 * 60 * 24 * 30;

export const setSessionStateCookie = (
  response: NextResponse,
  state: CustomerSessionState,
  maxAge = customerSessionMaxAge
) => {
  response.cookies.set(SESSION_COOKIES.state, JSON.stringify(state), options(maxAge));
};

export const setSessionCookies = (
  response: NextResponse,
  input: {
    accessToken: string;
    refreshToken: string;
    accessTokenExpiresIn: number;
    refreshTokenExpiresIn: number;
    state?: CustomerSessionState;
  }
) => {
  response.cookies.set(SESSION_COOKIES.access, input.accessToken, options(input.accessTokenExpiresIn));
  response.cookies.set(SESSION_COOKIES.refresh, input.refreshToken, options(input.refreshTokenExpiresIn));
  if (input.state) {
    setSessionStateCookie(response, input.state, input.refreshTokenExpiresIn);
  }
};

export const clearSessionCookies = (response: NextResponse) => {
  response.cookies.delete(SESSION_COOKIES.access);
  response.cookies.delete(SESSION_COOKIES.refresh);
  response.cookies.delete(SESSION_COOKIES.state);
};
