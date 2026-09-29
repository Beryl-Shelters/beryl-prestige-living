import type { ApiTransport } from "./listings-api";

export type SupportQuestion = {
  question: string;
  answer: string;
};

export const supportQuestions: SupportQuestion[] = [
  {
    question: "How do I search for properties on Beryl Shelter Nigeria Limited?",
    answer:
      "Use the search bar on the Home page to search by title/keyword, then refine results using filters like Location, Property Type, Budget, and Bedrooms. You can also browse all listings from the “Buy” tab.",
  },
  {
    question: "How do I list a property for sale?",
    answer:
      "Sign in and open the “Sell” tab to create a property listing. New listings are submitted for review with a Sales Mandate.",
  },
  {
    question: "How does the referral program work and when do I get paid?",
    answer:
      "You can refer properties or create a seller referral link in Dashboard Referrals. The program commission rate is 2% (200 bps). When an offline sale closes, commission is credited to your balance.",
  },
  {
    question: "I can’t log in / verify my account. What should I do?",
    answer:
      "Use Forgot Password on the Login page if you need to reset your password. If verification or sign-in still fails, open a support ticket or contact our support team.",
  },
  {
    question: "How do I report a suspicious property or agent?",
    answer:
      "Use the report form below to report a property or agent. Our compliance team will investigate promptly.",
  },
];

export type PropertyReportInput = {
  reportType: "PROPERTY";
  propertyCode: string;
  propertyName: string;
  reason: string;
};

export type AgentReportInput = {
  reportType: "AGENT";
  agentId: string;
  agentName: string;
  reason: string;
};

export function createSupportApi(client?: ApiTransport) {
  const getClient = (): ApiTransport => {
    if (client) return client;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return (require("./api-client") as typeof import("./api-client")).apiClient;
  };

  return {
    async submitReport(
      input: PropertyReportInput | AgentReportInput
    ): Promise<{ success: boolean }> {
      return getClient().request<{ success: boolean }>("/api/v1/public/support/reports", {
        method: "POST",
        authenticated: false,
        body: input,
      });
    },
  };
}

export const supportApi = createSupportApi();
