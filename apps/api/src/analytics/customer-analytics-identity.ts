import type { Request } from "express";

export const CUSTOMER_ANALYTICS_DISTINCT_ID_HEADER = "x-beryl-analytics-distinct-id";
const anonymousDistinctId = /^\$device:[A-Za-z0-9_-]{1,120}$/;

export const sanitizeCustomerAnalyticsDistinctId = (value: unknown) =>
  typeof value === "string" && anonymousDistinctId.test(value) ? value : undefined;

export const preAuthCustomerAnalyticsDistinctId = (request: Request) =>
  sanitizeCustomerAnalyticsDistinctId(request.header(CUSTOMER_ANALYTICS_DISTINCT_ID_HEADER));
