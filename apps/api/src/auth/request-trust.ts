import type { Request } from "express";
import type { AuthConfig } from "./config.js";

export const mobileClientHeader = "x-beryl-client";
export const mobileClientValue = "mobile";

export function isNativeMobileRequest(request: Request): boolean {
  return request.headers.origin === undefined && request.get(mobileClientHeader) === mobileClientValue;
}

export function isTrustedCustomerRequest(request: Request, config: AuthConfig): boolean {
  return request.headers.origin === config.webOrigin || isNativeMobileRequest(request);
}
