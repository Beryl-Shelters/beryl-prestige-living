import type { Request } from "express";

export const ADMIN_ANALYTICS_DISTINCT_ID_HEADER = "x-beryl-analytics-distinct-id";
const anonymousDistinctId = /^\$device:[A-Za-z0-9_-]{1,120}$/;
export const sanitizeAdminAnalyticsDistinctId = (value: unknown) => typeof value === "string" && anonymousDistinctId.test(value) ? value : undefined;
export const preAuthAdminAnalyticsDistinctId = (request: Request) => sanitizeAdminAnalyticsDistinctId(request.header(ADMIN_ANALYTICS_DISTINCT_ID_HEADER));
