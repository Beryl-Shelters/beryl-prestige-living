export type PropertyViewingInput = {
  propertyCode: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  preferredDate: string | null;
  preferredTime: string | null;
  flexibleDates: boolean;
};

export type PublicInquiryInput = {
  inquiryType: string;
  name: string;
  phone: string;
  email: string;
  message: string;
  sourcePage?: string;
};

export const inquiryTypes = [
  "Property Inquiry",
  "Buying a Property",
  "Selling/Listing a Property",
  "Property Viewing",
  "General Inquiry",
  "Other",
] as const;

export type ApiTransport = {
  request<T>(path: string, options?: { method?: string; body?: unknown; authenticated?: boolean }): Promise<T>;
};

export function createPublicServicesApi(client?: ApiTransport) {
  const getClient = (): ApiTransport => {
    if (client) return client;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return (require("./api-client") as typeof import("./api-client")).apiClient;
  };

  return {
    async submitPropertyViewing(input: PropertyViewingInput): Promise<void> {
      await getClient().request("/api/v1/public/property-viewings", {
        method: "POST",
        authenticated: false,
        body: input,
      });
    },

    async submitPublicInquiry(input: PublicInquiryInput): Promise<void> {
      await getClient().request("/api/v1/public/inquiries", {
        method: "POST",
        authenticated: false,
        body: input,
      });
    },
  };
}

export const publicServicesApi = createPublicServicesApi();
