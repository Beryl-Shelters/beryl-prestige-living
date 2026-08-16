import { describe, expect, it } from "vitest";
import { sanitizeCustomerAnalyticsDistinctId } from "./customer-analytics-identity";

describe("customer pre-auth analytics identity", () => {
  it("accepts only bounded Mixpanel anonymous device IDs", () => {
    expect(sanitizeCustomerAnalyticsDistinctId("$device:anonymous-customer-1")).toBe("$device:anonymous-customer-1");
    expect(sanitizeCustomerAnalyticsDistinctId("customer-id")).toBeUndefined();
    expect(sanitizeCustomerAnalyticsDistinctId("$device:email@example.com")).toBeUndefined();
    expect(sanitizeCustomerAnalyticsDistinctId("$device:" + "a".repeat(121))).toBeUndefined();
  });
});
