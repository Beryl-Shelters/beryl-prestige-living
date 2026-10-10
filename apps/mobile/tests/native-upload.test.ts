import assert from "node:assert/strict";
import { test } from "node:test";
import { installFormDataPatch } from "../../../node_modules/expo/src/winter/FormData";
import { convertFormDataAsync } from "../../../node_modules/expo/src/winter/fetch/convertFormData";
import { createFileAppender } from "../src/lib/file-upload-core";
import { friendlyError, MobileApiError, responseFailure } from "../src/lib/api-error";

const StandardBlob = globalThis.Blob;

// Reproduce RN BlobManager's actual restriction (Node's Blob accepts these).
class NativeBlob extends StandardBlob {
  constructor(parts: BlobPart[] = [], options?: BlobPropertyBag) {
    if (parts.some((part) => part instanceof ArrayBuffer || ArrayBuffer.isView(part))) {
      throw new Error("Creating blobs from 'ArrayBuffer' and 'ArrayBufferView' are not supported");
    }
    super(parts, options);
  }
}

function nativeFormData(): FormData {
  class NativeFormData { _parts: unknown[] = []; }
  installFormDataPatch(NativeFormData as unknown as typeof FormData);
  return new NativeFormData() as unknown as FormData;
}

test("native photos, documents and signatures survive RN Blob restrictions and Expo multipart encoding", async (t) => {
  t.mock.method(globalThis, "Blob", NativeBlob);
  const jpeg = new Uint8Array([255, 216, 255, 224, 0, 16, 74, 70]);
  const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0]);
  const pdf = new TextEncoder().encode("%PDF-1.4 document");
  const localFiles = new Map([
    ["file:///cache/photo.jpg", jpeg],
    ["file:///cache/deed.pdf", pdf],
  ]);
  const appendPickedFile = createFileAppender({ readNativeUri: async (uri: string) => {
    const bytes = localFiles.get(uri);
    assert.ok(bytes, "only selected local files should be read");
    return bytes;
  } });
  assert.throws(() => new Blob([jpeg]), /not supported/); // old helper fails here

  const form = nativeFormData();
  form.append("data", JSON.stringify({ content: { title: "Property" } }));
  await appendPickedFile(form, "images", { uri: "file:///cache/photo.jpg", name: "photo.jpg", type: "image/jpeg" });
  await appendPickedFile(form, "documents", { uri: "file:///cache/deed.pdf", name: "deed.pdf", type: "application/pdf" });
  await appendPickedFile(form, "signature", { uri: "data:image/png;base64,unused", name: "signature.png", type: "image/png", bytes: png });

  // Use the installed Expo encoder, then independently decode its wire bytes.
  const { body, boundary } = await convertFormDataAsync(form, "native-upload-regression");
  const decoded = await new Response(new StandardBlob([new Uint8Array(body)]), {
    headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` },
  }).formData() as unknown as { get(name: string): File | null };
  for (const [field, name, mime, expected] of [
    ["images", "photo.jpg", "image/jpeg", jpeg],
    ["documents", "deed.pdf", "application/pdf", pdf],
    ["signature", "signature.png", "image/png", png],
  ] as const) {
    const file = decoded.get(field) as File;
    assert.equal(file.name, name);
    assert.equal(file.type, mime);
    assert.deepEqual(new Uint8Array(await file.arrayBuffer()), expected);
  }
});

test("unreadable selected files report file preparation errors before sending an API request", async () => {
  const appendPickedFile = createFileAppender({
    readNativeUri: async () => { throw new Error("private local path"); },
  });
  await assert.rejects(
    appendPickedFile(nativeFormData(), "images", { uri: "file:///missing.jpg", name: "photo.jpg", type: "image/jpeg" }),
    (error: unknown) => {
      assert.ok(error instanceof MobileApiError);
      assert.equal(error.code, "FILE_PREPARATION_FAILED");
      assert.match(friendlyError(error), /select it again/);
      assert.doesNotMatch(friendlyError(error), /private local path|could not complete this request/);
      return true;
    }
  );
});

test("API failures preserve server messages and classify non-envelope responses without throwing TypeError", () => {
  const server = responseFailure(400, { success: false, error: { code: "INVALID_UPLOAD", message: "Choose supported files." } });
  assert.equal(server.message, "Choose supported files.");
  assert.equal(server.code, "INVALID_UPLOAD");
  for (const body of [null, "Bad Gateway", 500, true, [], { error: "Bad Gateway" }]) {
    const error = responseFailure(502, body);
    assert.equal(error.status, 502);
    assert.equal(error.kind, "server");
    assert.match(friendlyError(error), /HTTP 502/);
  }
  assert.match(responseFailure(413, null).message, /smaller file/);
  assert.match(responseFailure(401, null).message, /log in again/);
});
