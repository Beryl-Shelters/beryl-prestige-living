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
    // Native (iOS/Android): React Native FormData polyfill accepts { uri, name, type }
    if (file.bytes) {
      // If we have raw bytes, use standard Blob supported in React Native 0.86+
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
      formData.append(
        fieldName,
        { uri: file.uri, name: file.name, type: file.type } as unknown as Blob
      );
    }
  }
}
