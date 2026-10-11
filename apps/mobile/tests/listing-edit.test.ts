import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import {
  canEditListing,
  createListingFormInitialState,
  loadEditableListing,
} from "../src/lib/listing-edit";
import {
  createListingsApi,
  type CustomerListing,
  type ListingOptions,
} from "../src/lib/listings-api";

const root = existsSync(join(process.cwd(), "apps/mobile"))
  ? join(process.cwd(), "apps/mobile")
  : process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

const options: ListingOptions = {
  occupancy_type: ["Residential", "Commercial"],
  ownership_type: ["Personal", "Family"],
  property_type: ["Residential", "Commercial"],
  property_subtype: ["Bungalow", "Terraced Duplexes"],
  facilities: ["Swimming Pool", "CCTV", "Garden"],
  document_type: ["Ownership"],
  state: ["Lagos", "Abuja"],
};

function listing(overrides: Partial<CustomerListing> = {}): CustomerListing {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    listing_code: "RES-YWYQM7",
    title: "Waterfront Terraced Duplex",
    description: "A restored description with all persisted details.",
    occupancy_type: "Commercial",
    ownership_type: "Family",
    property_type: "Commercial",
    property_subtype: "Terraced Duplexes",
    has_lien: true,
    bedrooms: 4,
    bathrooms: 5,
    parking_spaces: 3,
    toilet_count: null,
    units: 2,
    land_area: 750,
    year_built: 2025,
    facilities: ["Swimming Pool", "CCTV"],
    property_cost_minor: 150_000_000_00,
    minimum_down_payment_minor: 45_000_000_00,
    location: "Plot 14 Admiralty Way",
    state: "Lagos",
    city: "Lekki",
    longitude: null,
    latitude: null,
    listing_status: "UNLISTED",
    property_status: "AVAILABLE",
    version: 7,
    created_at: "2026-10-01T12:00:00.000Z",
    updated_at: "2026-10-09T12:00:00.000Z",
    listed_at: null,
    rejection_reason: null,
    rejected_at: null,
    images: [
      { id: "image-1", url: "https://images.example.test/front.jpg", sort_order: 0 },
      { id: "image-2", url: "https://images.example.test/rear.jpg", sort_order: 1 },
    ],
    documents: [],
    registered_title_document: "Certificate of Occupancy",
    additional_information: "Inspection available by appointment.",
    ...overrides,
  };
}

test("Edit routes pass the canonical internal listing ID and the editor fetches that ID", async () => {
  const index = read("app/dashboard/listings/index.tsx");
  const detail = read("app/dashboard/listings/[id].tsx");
  const editor = read("app/(tabs)/list.tsx");
  assert.match(index, /draftId=\$\{item\.id\}/);
  assert.match(detail, /draftId=\$\{listing\.id\}/);
  assert.match(editor, /useLocalSearchParams<\{ draftId\?: string \| string\[\] \}>/);
  assert.match(editor, /loadEditableListing\(draftId, listingsApi\.get\)/);

  const requested: string[] = [];
  const saved = listing();
  const loaded = await loadEditableListing(saved.id, async (id) => {
    requested.push(id);
    return saved;
  });
  assert.deepEqual(requested, [saved.id]);
  assert.equal(loaded.listing_code, "RES-YWYQM7");
});

test("persisted text, selections, pricing, facilities and remote photographs hydrate the form", () => {
  const saved = listing();
  const form = createListingFormInitialState(saved, options);
  assert.deepEqual(form, {
    title: saved.title,
    registeredTitle: "Certificate of Occupancy",
    description: saved.description,
    occupancyType: "Commercial",
    ownershipType: "Family",
    propertyType: "Commercial",
    propertySubtype: "Terraced Duplexes",
    hasLien: true,
    location: "Plot 14 Admiralty Way",
    selectedState: "Lagos",
    city: "Lekki",
    bedrooms: "4",
    bathrooms: "5",
    parkingSpaces: "3",
    units: "2",
    landArea: "750",
    yearBuilt: "2025",
    facilities: ["Swimming Pool", "CCTV"],
    propertyCost: (150_000_000).toLocaleString(),
    downPayment: (45_000_000).toLocaleString(),
    additionalInfo: "Inspection available by appointment.",
    retainedImages: [
      { id: "image-1", url: "https://images.example.test/front.jpg" },
      { id: "image-2", url: "https://images.example.test/rear.jpg" },
    ],
  });
});

test("switching or reopening listings derives isolated state from persisted server data", () => {
  const first = createListingFormInitialState(listing(), options);
  first.facilities.push("Garden");
  first.retainedImages.pop();

  const secondListing = listing({
    id: "22222222-2222-4222-8222-222222222222",
    listing_code: "RES-SECOND",
    title: "Second property",
    city: "Abuja",
    state: "Abuja",
    facilities: ["Garden"],
    images: [{ id: "image-3", url: "https://images.example.test/second.jpg", sort_order: 0 }],
  });
  const second = createListingFormInitialState(secondListing, options);
  const reopenedFirst = createListingFormInitialState(listing(), options);

  assert.equal(second.title, "Second property");
  assert.equal(second.city, "Abuja");
  assert.deepEqual(second.facilities, ["Garden"]);
  assert.deepEqual(second.retainedImages.map((image) => image.id), ["image-3"]);
  assert.deepEqual(reopenedFirst.facilities, ["Swimming Pool", "CCTV"]);
  assert.deepEqual(reopenedFirst.retainedImages.map((image) => image.id), ["image-1", "image-2"]);
});

test("edit loading failure and forbidden statuses never fall back to a blank create form", async () => {
  const editor = read("app/(tabs)/list.tsx");
  assert.match(editor, /if \(draftId && editLoading\)/);
  assert.match(editor, /if \(draftId && \(editError \|\| !activeListing\)\)/);
  assert.match(editor, /title="Could not open this property"/);
  assert.match(editor, /key=\{draftId \?\? "new-listing"\}/);

  assert.equal(canEditListing("UNLISTED"), true);
  assert.equal(canEditListing("REJECTED"), true);
  assert.equal(canEditListing("PENDING"), false);
  assert.equal(canEditListing("LISTED"), false);
  await assert.rejects(
    loadEditableListing("pending-id", async () => listing({ listing_status: "PENDING" })),
    (error: unknown) =>
      error instanceof Error && error.message.includes("can no longer be edited")
  );
  await assert.rejects(
    loadEditableListing("missing-id", async () => { throw new Error("not found"); }),
    /not found/
  );
});

test("saving edits PATCHes the original listing and handles retained, removed and new photos", async () => {
  const saved = listing();
  const calls: { path: string; method: string; data: { version: number; retained_images: string[] }; images: number }[] = [];
  const client = {
    request: async <T>(path: string, requestOptions?: unknown) => {
      const request = requestOptions as { method: string; body: FormData };
      const data = JSON.parse(String(request.body.get("data"))) as {
        version: number;
        retained_images: string[];
      };
      calls.push({
        path,
        method: request.method,
        data,
        images: request.body.getAll("images").length,
      });
      return { ...saved, version: saved.version + calls.length } as T;
    },
  };
  const api = createListingsApi(client);

  await api.saveDraftInPhotoBatches(
    { title: "Unchanged photos" },
    saved,
    ["image-1", "image-2"],
    []
  );
  await api.saveDraftInPhotoBatches(
    { title: "One photo removed" },
    saved,
    ["image-1"],
    []
  );
  await api.saveDraftInPhotoBatches(
    { title: "New photo added" },
    saved,
    ["image-1", "image-2"],
    [{
      uri: `data:image/jpeg;base64,${Buffer.from([255, 216, 255, 224]).toString("base64")}`,
      name: "new-photo.jpg",
      type: "image/jpeg",
    }]
  );

  assert.deepEqual(calls.map((call) => call.method), ["PATCH", "PATCH", "PATCH"]);
  assert.ok(calls.every((call) => call.path === `/api/v1/listings/${saved.id}`));
  assert.ok(calls.every((call) => call.data.version === saved.version));
  assert.deepEqual(calls.map((call) => call.data.retained_images), [
    ["image-1", "image-2"],
    ["image-1"],
    ["image-1", "image-2"],
  ]);
  assert.deepEqual(calls.map((call) => call.images), [0, 0, 1]);
  assert.equal(calls.some((call) => call.method === "POST"), false);
});
