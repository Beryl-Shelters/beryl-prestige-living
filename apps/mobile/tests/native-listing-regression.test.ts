import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { installFormDataPatch } from "../../../node_modules/expo/src/winter/FormData";
import { convertFormDataAsync } from "../../../node_modules/expo/src/winter/fetch/convertFormData";
import { MobileApiError } from "../src/lib/api-error";
import {
  createFileAppender,
  type FileUploadDiagnostic,
  type PickedFile,
} from "../src/lib/file-upload-core";
import { createListingsApi, type CustomerListing } from "../src/lib/listings-api";

const root = existsSync(join(process.cwd(), "apps/mobile"))
  ? join(process.cwd(), "apps/mobile")
  : process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");
const StandardBlob = globalThis.Blob;

function nativeFormDataConstructor(): typeof FormData {
  class NativeFormData { _parts: unknown[] = []; }
  installFormDataPatch(NativeFormData as unknown as typeof FormData);
  return NativeFormData as unknown as typeof FormData;
}

function nativeFormData(): FormData {
  const NativeFormData = nativeFormDataConstructor();
  return new NativeFormData();
}

async function decodeMultipart(form: FormData): Promise<{ getAll(name: string): File[] }> {
  const { body, boundary } = await convertFormDataAsync(form, "native-listing-regression");
  return new Response(new StandardBlob([new Uint8Array(body)]), {
    headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` },
  }).formData() as unknown as { getAll(name: string): File[] };
}

const jpeg = new Uint8Array([255, 216, 255, 224, 0, 16, 74, 70]);
const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0]);
const webp = new Uint8Array([82, 73, 70, 70, 4, 0, 0, 0, 87, 69, 66, 80]);

test("native file:// and content:// JPEG, PNG and WEBP assets become valid multipart files", async () => {
  const localFiles = new Map<string, Uint8Array>([
    ["file:///cache/front.jpg", jpeg],
    ["content://media/external/images/42", png],
    ["file:///cache/rear.webp", webp],
  ]);
  const readUris: string[] = [];
  const appendPickedFile = createFileAppender({
    readNativeUri: async (uri) => {
      readUris.push(uri);
      const bytes = localFiles.get(uri);
      if (!bytes) throw new Error("unreadable URI");
      return bytes;
    },
  });
  const files: PickedFile[] = [
    { uri: "file:///cache/front.jpg", name: "front.jpg", type: "image/jpeg", size: jpeg.length },
    { uri: "content://media/external/images/42", name: "inside.png", type: "image/png", size: png.length },
    { uri: "file:///cache/rear.webp", name: "rear.webp", type: "image/webp", size: webp.length },
  ];
  const form = nativeFormData();
  for (const file of files) await appendPickedFile(form, "images", file);

  const uploaded = (await decodeMultipart(form)).getAll("images");
  assert.deepEqual(readUris, files.map((file) => file.uri));
  assert.deepEqual(uploaded.map((file) => file.name), files.map((file) => file.name));
  assert.deepEqual(uploaded.map((file) => file.type), files.map((file) => file.type));
  for (let index = 0; index < uploaded.length; index += 1) {
    assert.deepEqual(
      new Uint8Array(await uploaded[index]!.arrayBuffer()),
      localFiles.get(files[index]!.uri)
    );
  }
});

test("native upload rejects unsupported, oversized, empty and expired assets with safe diagnostics", async () => {
  const diagnostics: FileUploadDiagnostic[] = [];
  let readCount = 0;
  const appendPickedFile = createFileAppender({
    readNativeUri: async (uri) => {
      readCount += 1;
      if (uri.includes("empty")) return new Uint8Array();
      throw new Error("private local path must never reach diagnostics or UI");
    },
    reportFailure: (diagnostic) => diagnostics.push(diagnostic),
  });
  const cases: { file: PickedFile; code: string }[] = [
    { file: { uri: "file:///cache/photo.gif", name: "photo.gif", type: "image/gif" }, code: "UNSUPPORTED_IMAGE_TYPE" },
    { file: { uri: "file:///cache/large.jpg", name: "large.jpg", type: "image/jpeg", size: 5 * 1024 * 1024 + 1 }, code: "IMAGE_TOO_LARGE" },
    { file: { uri: "content://provider/empty", name: "empty.png", type: "image/png" }, code: "FILE_PREPARATION_FAILED" },
    { file: { uri: "content://provider/expired", name: "expired.jpg", type: "image/jpeg" }, code: "FILE_PREPARATION_FAILED" },
  ];

  for (const item of cases) {
    await assert.rejects(
      appendPickedFile(nativeFormData(), "images", item.file),
      (error: unknown) => error instanceof MobileApiError && error.code === item.code
    );
  }
  assert.equal(readCount, 2, "metadata failures must be rejected before URI reads");
  assert.deepEqual(diagnostics.map((item) => item.uriScheme), ["file", "file", "content", "content"]);
  assert.deepEqual(diagnostics.slice(2).map((item) => item.stage), ["validate_native_bytes", "read_native_uri"]);
  assert.doesNotMatch(
    JSON.stringify(diagnostics),
    /cache\/|provider\/|private local path|expired\.jpg/
  );
});

test("an interrupted native photo can be retried without losing the already-created draft", async (t) => {
  const NativeFormData = nativeFormDataConstructor();
  const BrowserFormData = globalThis.FormData;
  Object.defineProperty(globalThis, "FormData", { configurable: true, value: NativeFormData });
  t.after(() => {
    Object.defineProperty(globalThis, "FormData", { configurable: true, value: BrowserFormData });
  });
  const files: PickedFile[] = [1, 2, 3].map((number) => ({
    uri: `file:///cache/property-${number}.jpg`,
    name: `property-${number}.jpg`,
    type: "image/jpeg",
  }));
  let failSecondOnce = true;
  const appendPickedFile = createFileAppender({
    readNativeUri: async (uri) => {
      if (uri.endsWith("property-2.jpg") && failSecondOnce) {
        failSecondOnce = false;
        throw new Error("temporary picker cache read failure");
      }
      return new Uint8Array([255, 216, 255, Number(uri.match(/(\d)\.jpg$/)?.[1] ?? 0)]);
    },
  });
  const calls: { method: string; retained: string[]; fileCount: number }[] = [];
  const client = {
    request: async <T>(_path: string, options?: unknown) => {
      const request = options as { method: string; body: { _parts: [string, unknown][] } };
      const dataPart = request.body._parts.find(([name]) => name === "data");
      const data = JSON.parse(String(dataPart?.[1])) as { retained_images?: string[] };
      calls.push({
        method: request.method,
        retained: data.retained_images ?? [],
        fileCount: request.body._parts.filter(([name]) => name === "images").length,
      });
      const imageCount = calls.length;
      return {
        id: "11111111-1111-4111-8111-111111111111",
        version: imageCount,
        images: Array.from({ length: imageCount }, (_, index) => ({
          id: `00000000-0000-4000-8000-00000000000${index + 1}`,
          url: `https://images.example.test/${index + 1}.jpg`,
          sort_order: index,
        })),
      } as T;
    },
  };
  const api = createListingsApi(client, appendPickedFile);
  let checkpoint: { listing: CustomerListing; remainingImages: PickedFile[] } | undefined;

  await assert.rejects(
    api.saveDraftInPhotoBatches(
      { title: "Duplex" },
      null,
      [],
      files,
      (progress) => { checkpoint = progress; }
    ),
    (error: unknown) => error instanceof MobileApiError && error.code === "FILE_PREPARATION_FAILED"
  );
  assert.ok(checkpoint);
  assert.equal(checkpoint.listing.images.length, 1);
  assert.deepEqual(checkpoint.remainingImages.map((file) => file.name), ["property-2.jpg", "property-3.jpg"]);

  const saved = await api.saveDraftInPhotoBatches(
    { title: "Duplex updated" },
    checkpoint.listing,
    checkpoint.listing.images.map((image) => image.id),
    checkpoint.remainingImages
  );
  assert.equal(saved.images.length, 3);
  assert.deepEqual(calls.map((call) => call.method), ["POST", "PATCH", "PATCH"]);
  assert.deepEqual(calls.map((call) => call.fileCount), [1, 1, 1]);
  assert.deepEqual(calls[1]!.retained, ["00000000-0000-4000-8000-000000000001"]);
});

test("native wiring uses Expo FileSystem while multipart dispatch preserves bearer auth", () => {
  const helper = read("src/lib/file-upload-helper.native.ts");
  const apiClient = read("src/lib/api-client.ts");
  assert.match(helper, /from "expo-file-system"/);
  assert.match(helper, /new File\(uri\)\.bytes\(\)/);
  assert.doesNotMatch(helper, /fetch\(|new Blob/);
  assert.match(apiClient, /headers\.Authorization=`Bearer \$\{token\}`/);
  assert.match(apiClient, /!\(options\.body instanceof FormData\)/);
  assert.match(apiClient, /options\.body instanceof FormData\?options\.body/);
});
