const isWeb = typeof document !== "undefined";

export type PickedFile = {
  uri: string;
  name: string;
  type: string;
  size?: number;
  bytes?: Uint8Array;
};

export async function appendPickedFile(
  formData: FormData,
  fieldName: string,
  file: PickedFile
): Promise<void> {
  if (isWeb) {
    if (file.bytes) {
      formData.append(fieldName, new Blob([file.bytes as unknown as BlobPart], { type: file.type }), file.name);
    } else {
      try {
        const response = await fetch(file.uri);
        const blob = await response.blob();
        formData.append(fieldName, blob, file.name);
      } catch {
        formData.append(
          fieldName,
          { uri: file.uri, name: file.name, type: file.type } as unknown as Blob
        );
      }
    }
  } else {
    // Prefer a real Blob so Android does not have to resolve a content/file URI
    // while the request is crossing the native networking bridge. Keep the
    // standard React Native URI part as a fallback for providers that do not
    // expose local picker assets through fetch().
    if (file.bytes) {
      try {
        const blob = new Blob([file.bytes as unknown as BlobPart], { type: file.type });
        formData.append(fieldName, blob, file.name);
      } catch {
        formData.append(
          fieldName,
          { uri: file.uri, name: file.name, type: file.type } as unknown as Blob
        );
      }
    } else {
      try {
        const localResponse = await fetch(file.uri);
        if (!localResponse.ok) throw new Error("Local file could not be read");
        const blob = await localResponse.blob();
        formData.append(fieldName, blob, file.name);
      } catch {
        formData.append(
          fieldName,
          { uri: file.uri, name: file.name, type: file.type } as unknown as Blob
        );
      }
    }
  }
}
