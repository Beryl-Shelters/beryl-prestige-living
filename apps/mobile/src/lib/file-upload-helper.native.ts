import { File } from "expo-file-system";
import { createFileAppender } from "./file-upload-core";

export type { PickedFile } from "./file-upload-core";

export const appendPickedFile = createFileAppender({
  readNativeUri: async (uri) => new File(uri).bytes(),
  reportFailure: (diagnostic) => {
    if (typeof __DEV__ !== "undefined" && __DEV__) {
      // Deliberately excludes the local URI path and all file contents.
      console.warn("[mobile-upload] File preparation failed", diagnostic);
    }
  },
});
