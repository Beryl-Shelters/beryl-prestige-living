import { appendPickedFile, type PickedFile } from "./file-upload-helper";
import type { ApiTransport } from "./listings-api";

export type KycDocumentType = "PASSPORT" | "DRIVERS_LICENSE" | "NATIONAL_ID";

export type KycStatus = "NOT_SUBMITTED" | "PENDING_REVIEW" | "APPROVED" | "REJECTED";

export type KycDocument = {
  id: string;
  side: "FRONT" | "BACK";
  filename: string;
  mimeType: string;
  sizeBytes: number;
};

export type KycView = {
  status: KycStatus;
  country: string | null;
  documentType: KycDocumentType | null;
  submittedAt: string | null;
  rejectionReason: string | null;
  documents: KycDocument[];
};

export function createKycApi(client?: ApiTransport) {
  const getClient = (): ApiTransport => {
    if (client) return client;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return (require("./api-client") as typeof import("./api-client")).apiClient;
  };

  return {
    async getKyc(): Promise<KycView> {
      return getClient().request<KycView>("/api/v1/dashboard/kyc");
    },

    async submitKyc(
      data: { country: string; documentType: KycDocumentType },
      frontFile: PickedFile,
      backFile?: PickedFile
    ): Promise<KycView> {
      const formData = new FormData();
      formData.append(
        "data",
        JSON.stringify({
          country: data.country.trim(),
          documentType: data.documentType,
          declarationAccepted: true,
        })
      );

      await appendPickedFile(formData, "frontDocument", frontFile);
      if (backFile) {
        await appendPickedFile(formData, "backDocument", backFile);
      }

      return getClient().request<KycView>("/api/v1/dashboard/kyc", {
        method: "POST",
        body: formData,
      });
    },
  };
}

export const kycApi = createKycApi();
