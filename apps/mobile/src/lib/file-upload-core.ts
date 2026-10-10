import { MobileApiError } from "./api-error";

const IMAGE_BYTES_LIMIT = 5 * 1024 * 1024;
const IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export type PickedFile = {
  uri: string;
  name: string;
  type: string;
  size?: number;
  bytes?: Uint8Array;
};

export type FileUploadDiagnostic = {
  operation: "prepare_multipart_file";
  stage: string;
  uriScheme: string;
  mimeType: string;
  declaredSize: number | null;
  errorCategory: string;
};

type FileAppenderOptions = {
  readNativeUri?: (uri: string) => Promise<Uint8Array>;
  reportFailure?: (diagnostic: FileUploadDiagnostic) => void;
};

export type FileAppender = (
  formData: FormData,
  fieldName: string,
  file: PickedFile
) => Promise<void>;

function uriScheme(uri: string): string {
  const separator = uri.indexOf(":");
  return separator > 0 ? uri.slice(0, separator).toLowerCase() : "unknown";
}

function errorCategory(error: unknown): string {
  if (error instanceof MobileApiError) return error.code || error.kind;
  if (error instanceof Error && error.name) return error.name;
  return typeof error;
}

function validateImage(fieldName: string, file: PickedFile, byteLength?: number): void {
  if (fieldName !== "images") return;
  if (!IMAGE_MIME_TYPES.has(file.type)) {
    throw new MobileApiError(
      "validation",
      "Only JPG, PNG and WEBP property photographs are supported.",
      undefined,
      "UNSUPPORTED_IMAGE_TYPE"
    );
  }
  if ((file.size ?? 0) > IMAGE_BYTES_LIMIT || (byteLength ?? 0) > IMAGE_BYTES_LIMIT) {
    throw new MobileApiError(
      "validation",
      "A property photograph exceeds the 5 MB limit. Please choose a smaller image.",
      undefined,
      "IMAGE_TOO_LARGE"
    );
  }
}

export function createFileAppender(options: FileAppenderOptions = {}) {
  return async function appendPickedFile(
    formData: FormData,
    fieldName: string,
    file: PickedFile
  ): Promise<void> {
    let stage = "validate_metadata";
    try {
      validateImage(fieldName, file);

      if (options.readNativeUri) {
        // Expo's multipart encoder supports File-like byte readers. RN's Blob
        // constructor rejects binary parts, including Uint8Array payloads.
        stage = file.bytes ? "use_supplied_bytes" : "read_native_uri";
        const bytes = file.bytes ?? await options.readNativeUri!(file.uri);
        stage = "validate_native_bytes";
        if (bytes.byteLength === 0) throw new Error("Selected file is empty");
        validateImage(fieldName, file, bytes.byteLength);
        stage = "append_native_file_part";
        formData.append(fieldName, {
          name: file.name,
          type: file.type,
          bytes: async () => bytes,
        } as unknown as Blob);
        return;
      }

      let blob: Blob;
      if (file.bytes) {
        stage = "create_browser_blob_from_bytes";
        blob = new Blob([file.bytes as unknown as BlobPart], { type: file.type });
      } else {
        stage = "fetch_browser_uri";
        const response = await fetch(file.uri);
        if (!response.ok) throw new Error("Selected file could not be read");
        stage = "read_browser_blob";
        const source = await response.blob();
        stage = "create_browser_typed_blob";
        blob = new Blob([source], { type: file.type });
      }
      stage = "validate_browser_blob";
      validateImage(fieldName, file, blob.size);
      stage = "append_browser_file_part";
      formData.append(fieldName, blob, file.name);
    } catch (error: unknown) {
      options.reportFailure?.({
        operation: "prepare_multipart_file",
        stage,
        uriScheme: uriScheme(file.uri),
        mimeType: file.type,
        declaredSize: file.size ?? null,
        errorCategory: errorCategory(error),
      });
      if (error instanceof MobileApiError) throw error;
      throw new MobileApiError(
        "validation",
        "A selected file could not be prepared for upload. Please remove it and select it again.",
        undefined,
        "FILE_PREPARATION_FAILED"
      );
    }
  };
}
