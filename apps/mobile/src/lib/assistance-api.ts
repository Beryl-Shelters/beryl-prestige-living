import { appendPickedFile, type PickedFile } from "./file-upload-helper";

export type ApiTransport = {
  request<T>(path: string, options?: { method?: string; body?: unknown; authenticated?: boolean }): Promise<T>;
};

export function createAssistanceApi(client?: ApiTransport) {
  const getClient = (): ApiTransport => {
    if (client) return client;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return (require("./api-client") as typeof import("./api-client")).apiClient;
  };

  return {
    async submitSellAssistance(
      data: Record<string, unknown>,
      images: PickedFile[],
      authorizationDocument?: PickedFile
    ): Promise<void> {
      const formData = new FormData();
      formData.append("data", JSON.stringify(data));
      for (const img of images) {
        await appendPickedFile(formData, "propertyImages", img);
      }
      if (authorizationDocument) {
        await appendPickedFile(formData, "authorizationDocument", authorizationDocument);
      }
      await getClient().request("/api/v1/public/sell-assistance", {
        method: "POST",
        authenticated: false,
        body: formData,
      });
    },

    async submitBuyAssistance(
      data: Record<string, unknown>,
      buyMandate?: PickedFile
    ): Promise<void> {
      const formData = new FormData();
      formData.append("data", JSON.stringify(data));
      if (buyMandate) {
        await appendPickedFile(formData, "buyMandate", buyMandate);
      }
      await getClient().request("/api/v1/public/buy-assistance", {
        method: "POST",
        authenticated: false,
        body: formData,
      });
    },
  };
}

export const assistanceApi = createAssistanceApi();
