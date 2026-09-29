import { appendPickedFile, type PickedFile } from "./file-upload-helper";
import type { ApiTransport } from "./listings-api";

export type SettingsProfileInput = {
  firstName: string;
  lastName: string;
  phoneNumber: string;
  briefBio: string;
  accountName: string;
  bankName: string;
  accountNumber: string;
  streetAddress: string;
  zipCode: string;
  city: string;
  state: string;
  country: string;
};

export type SettingsProfile = SettingsProfileInput & {
  email: string; // Canonical read-only email
  countryCode: string | null;
  accountType: string | null;
  profileImageUrl: string | null;
};

export type SettingsBusinessInput = {
  companyName: string;
  companyEmail: string;
  companyPhoneNumber: string;
  aboutCompany: string;
  streetAddress: string;
  zipCode: string;
  city: string;
  state: string;
  country: string;
};

export type SettingsBusiness = SettingsBusinessInput & {
  companyId: string; // Public BUS-... identifier
  companyLogoUrl: string | null;
};

export function createSettingsApi(client?: ApiTransport) {
  const getClient = (): ApiTransport => {
    if (client) return client;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return (require("./api-client") as typeof import("./api-client")).apiClient;
  };

  return {
    async getProfile(): Promise<SettingsProfile> {
      return getClient().request<SettingsProfile>("/api/v1/dashboard/settings/profile");
    },

    async updateProfile(
      data: SettingsProfileInput,
      avatarFile?: PickedFile
    ): Promise<SettingsProfile> {
      if (avatarFile) {
        const formData = new FormData();
        formData.append("data", JSON.stringify(data));
        await appendPickedFile(formData, "profileImage", avatarFile);
        return getClient().request<SettingsProfile>("/api/v1/dashboard/settings/profile", {
          method: "PATCH",
          body: formData,
        });
      }

      return getClient().request<SettingsProfile>("/api/v1/dashboard/settings/profile", {
        method: "PATCH",
        body: data,
      });
    },

    async getBusiness(): Promise<SettingsBusiness> {
      return getClient().request<SettingsBusiness>("/api/v1/dashboard/settings/business");
    },

    async updateBusiness(
      data: SettingsBusinessInput,
      logoFile?: PickedFile
    ): Promise<SettingsBusiness> {
      if (logoFile) {
        const formData = new FormData();
        formData.append("data", JSON.stringify(data));
        await appendPickedFile(formData, "companyLogo", logoFile);
        return getClient().request<SettingsBusiness>("/api/v1/dashboard/settings/business", {
          method: "PATCH",
          body: formData,
        });
      }

      return getClient().request<SettingsBusiness>("/api/v1/dashboard/settings/business", {
        method: "PATCH",
        body: data,
      });
    },

    async changePassword(
      oldPassword: string,
      newPassword: string,
      confirmNewPassword: string
    ): Promise<{ reauthenticate?: boolean }> {
      return getClient().request<{ reauthenticate?: boolean }>(
        "/api/v1/dashboard/settings/password",
        {
          method: "PATCH",
          body: { oldPassword, newPassword, confirmNewPassword },
        }
      );
    },
  };
}

export const settingsApi = createSettingsApi();
