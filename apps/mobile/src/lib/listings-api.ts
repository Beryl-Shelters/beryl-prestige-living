import { appendPickedFile, type PickedFile } from "./file-upload-helper";
import type { FileAppender } from "./file-upload-core";

export type ListingStatus = "UNLISTED" | "PENDING" | "LISTED" | "REJECTED";

export type ListingOptions = {
  occupancy_type: readonly string[];
  ownership_type: readonly string[];
  property_type: readonly string[];
  property_subtype: readonly string[];
  facilities: readonly string[];
  document_type: readonly string[];
  state: readonly string[];
};

export type CustomerListing = {
  id: string;
  listing_code: string;
  title: string;
  description: string;
  occupancy_type: string;
  ownership_type: string;
  property_type: string;
  property_subtype: string;
  has_lien: boolean;
  bedrooms: number;
  bathrooms: number;
  parking_spaces: number;
  toilet_count: number | null;
  units: number | null;
  land_area: number | null;
  year_built: number | null;
  facilities: string[];
  property_cost_minor: number;
  minimum_down_payment_minor: number;
  location: string;
  state: string;
  city: string;
  longitude: number | null;
  latitude: number | null;
  listing_status: ListingStatus;
  property_status: "AVAILABLE";
  version: number;
  created_at: string;
  updated_at: string;
  listed_at: string | null;
  requested_at?: string | null;
  rejection_reason: string | null;
  rejected_at: string | null;
  images: { id: string; url: string; sort_order: number }[];
  documents: { id: string; batch_id: string; title: string; document_type: string; description: string; sort_order: number }[];
  registered_title_document?: string | null;
  additional_information?: string | null;
  owner?: { full_name: string; email: string; phone: string | null };
  completeness?: number;
  leads?: number;
  views?: number;
  time_on_market?: number | null;
  referral_url?: string;
};

export type ListingsCounts = {
  all: number;
  UNLISTED: number;
  PENDING: number;
  LISTED: number;
  REJECTED: number;
};

export type ListingsPage = {
  items: CustomerListing[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
  counts: ListingsCounts;
};

export function listingStatusPresentation(status: ListingStatus): {
  label: string;
  tone: "neutral" | "success" | "warning" | "danger";
} {
  switch (status) {
    case "LISTED":
      return { label: "For Sale", tone: "success" };
    case "PENDING":
      return { label: "Pending", tone: "warning" };
    case "REJECTED":
      return { label: "Rejected", tone: "danger" };
    case "UNLISTED":
    default:
      return { label: "Not Yet for Sale", tone: "neutral" };
  }
}

export type MandateDocument = {
  id: string;
  title: string;
  mime_type: string;
  size_bytes: number;
  sort_order: number;
};

export type MandateDocumentUpload = {
  upload_id: string;
  title: string;
  mime_type: string;
  size_bytes: number;
};

export type MandateContent = {
  seller_title: string;
  surname: string;
  first_names: string;
  gender: string;
  email: string;
  telephone: string;
  date_of_birth: string;
  nationality: string;
  post_code: string;
  address: string;
  property_development_name: string;
  document_title: string;
  signer_name: string;
  signer_address: string;
  signer_email: string;
  mandate_date: string;
  agreed_to_mandate: boolean;
};

export type SalesMandate = MandateContent & {
  id: string;
  listing_id: string;
  has_signature: boolean;
  signature_mime_type: "image/png";
  signature_size_bytes: number;
  signed_at: string;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
  documents: MandateDocument[];
};

export type MandatePayload = {
  content: MandateContent;
  signature: { kind: "existing" } | { kind: "upload"; upload_id: string };
  documents: ({ kind: "existing"; id: string } | { kind: "upload"; upload_id: string; title: string })[];
};

export type ApiTransport = {
  request<T>(path: string, options?: { method?: string; body?: unknown; authenticated?: boolean }): Promise<T>;
};

export type DraftUploadProgress = {
  listing: CustomerListing;
  remainingImages: PickedFile[];
};

export function createListingsApi(
  client?: ApiTransport,
  appendFile: FileAppender = appendPickedFile
) {
  const getClient = (): ApiTransport => {
    if (client) return client;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return (require("./api-client") as typeof import("./api-client")).apiClient;
  };

  const createDraft = async (
    content: Record<string, unknown>,
    images: PickedFile[]
  ): Promise<CustomerListing> => {
    const formData = new FormData();
    formData.append("data", JSON.stringify({ content }));
    for (const img of images) {
      await appendFile(formData, "images", img);
    }
    return getClient().request<CustomerListing>("/api/v1/listings", {
      method: "POST",
      body: formData,
    });
  };

  const updateDraft = async (
    id: string,
    version: number,
    content: Record<string, unknown>,
    retainedImageIds: string[],
    newImages: PickedFile[]
  ): Promise<CustomerListing> => {
    const formData = new FormData();
    formData.append(
      "data",
      JSON.stringify({
        version,
        content,
        retained_images: retainedImageIds,
      })
    );
    for (const img of newImages) {
      await appendFile(formData, "images", img);
    }
    return getClient().request<CustomerListing>(`/api/v1/listings/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: formData,
    });
  };

  return {
    async options(): Promise<ListingOptions> {
      return getClient().request<ListingOptions>("/api/v1/listings/options");
    },

    async get(id: string): Promise<CustomerListing> {
      return getClient().request<CustomerListing>(`/api/v1/listings/${encodeURIComponent(id)}`);
    },

    createDraft,

    updateDraft,

    async saveDraftInPhotoBatches(
      content: Record<string, unknown>,
      existingListing: CustomerListing | null,
      retainedImageIds: string[],
      newImages: PickedFile[],
      onProgress?: (progress: DraftUploadProgress) => void
    ): Promise<CustomerListing> {
      let listing = existingListing;
      const remainingImages = [...newImages];
      let retainedForNextRequest = [...retainedImageIds];

      const reportProgress = (saved: CustomerListing) => {
        listing = saved;
        retainedForNextRequest = saved.images.map((image) => image.id);
        onProgress?.({ listing: saved, remainingImages: [...remainingImages] });
      };

      if (!listing) {
        const firstImage = remainingImages.shift();
        if (!firstImage) throw new Error("At least one property photograph is required.");
        reportProgress(await createDraft(content, [firstImage]));
      } else if (remainingImages.length === 0) {
        reportProgress(
          await updateDraft(listing.id, listing.version, content, retainedImageIds, [])
        );
      }

      while (listing && remainingImages.length > 0) {
        const nextImage = remainingImages.shift()!;
        reportProgress(
          await updateDraft(
            listing.id,
            listing.version,
            content,
            retainedForNextRequest,
            [nextImage]
          )
        );
      }

      if (!listing) throw new Error("Listing draft could not be saved.");
      return listing;
    },

    async getMandate(listingId: string): Promise<SalesMandate | null> {
      try {
        return await getClient().request<SalesMandate>(
          `/api/v1/listings/${encodeURIComponent(listingId)}/mandate`
        );
      } catch (err: unknown) {
        if (
          err &&
          typeof err === "object" &&
          "kind" in err &&
          (err as { kind: string }).kind === "not_found"
        ) {
          return null;
        }
        throw err;
      }
    },

    async uploadMandateDocuments(
      listingId: string,
      files: { file: PickedFile; title: string }[]
    ): Promise<MandateDocumentUpload[]> {
      const formData = new FormData();
      formData.append("data", JSON.stringify(files.map(f => f.title)));
      for (const item of files) {
        await appendFile(formData, "documents", item.file);
      }
      return getClient().request<MandateDocumentUpload[]>(
        `/api/v1/listings/${encodeURIComponent(listingId)}/mandate/documents`,
        {
          method: "POST",
          body: formData,
        }
      );
    },

    async uploadMandateSignature(
      listingId: string,
      file: PickedFile
    ): Promise<{ upload_id: string; mime_type: "image/png"; size_bytes: number }> {
      const formData = new FormData();
      await appendFile(formData, "signature", file);
      return getClient().request<{ upload_id: string; mime_type: "image/png"; size_bytes: number }>(
        `/api/v1/listings/${encodeURIComponent(listingId)}/mandate/signature`,
        {
          method: "POST",
          body: formData,
        }
      );
    },

    async saveMandate(listingId: string, payload: MandatePayload): Promise<SalesMandate> {
      return getClient().request<SalesMandate>(
        `/api/v1/listings/${encodeURIComponent(listingId)}/mandates`,
        {
          method: "POST",
          body: payload,
        }
      );
    },

    async submit(listingId: string): Promise<CustomerListing> {
      return getClient().request<CustomerListing>(
        `/api/v1/listings/${encodeURIComponent(listingId)}/submit`,
        {
          method: "POST",
          body: {},
        }
      );
    },

    async list(params?: {
      q?: string;
      status?: ListingStatus | "";
      page?: number;
      pageSize?: number;
    }): Promise<ListingsPage> {
      const query = new URLSearchParams();
      if (params?.q) query.set("q", params.q.trim());
      if (params?.status) query.set("status", params.status);
      if (params?.page) query.set("page", String(params.page));
      if (params?.pageSize) query.set("page_size", String(params.pageSize));
      const qs = query.toString();
      return getClient().request<ListingsPage>(`/api/v1/listings${qs ? `?${qs}` : ""}`);
    },

    async unlist(id: string, version: number): Promise<CustomerListing> {
      return getClient().request<CustomerListing>(
        `/api/v1/listings/${encodeURIComponent(id)}/unlist`,
        {
          method: "POST",
          body: { version },
        }
      );
    },

    async delete(id: string, version: number): Promise<{ deleted: boolean }> {
      return getClient().request<{ deleted: boolean }>(
        `/api/v1/listings/${encodeURIComponent(id)}`,
        {
          method: "DELETE",
          body: { version },
        }
      );
    },

    async requestApproval(id: string, version: number): Promise<CustomerListing> {
      return getClient().request<CustomerListing>(
        `/api/v1/listings/${encodeURIComponent(id)}/request-approval`,
        {
          method: "POST",
          body: { version },
        }
      );
    },
  };
}

export const listingsApi = createListingsApi();
