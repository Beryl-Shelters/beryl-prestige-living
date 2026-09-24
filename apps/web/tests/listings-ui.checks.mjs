import assert from "node:assert/strict";
import { runIfMain } from "./run-ui-suite.mjs";
import { referralsState } from "./referrals-ui.checks.mjs";
runIfMain(import.meta.url, "listings");
function assertNoProviderDetails(value) {
  const forbidden = new Set(["public_id", "signature_public_id", "resource_type", "delivery_type", "url"]);
  const visit = (entry) => {
    if (Array.isArray(entry)) return entry.forEach(visit);
    if (!entry || typeof entry !== "object") return;
    for (const [key, child] of Object.entries(entry)) {
      assert.equal(forbidden.has(key), false, `browser contract used provider field ${key}`);
      visit(child);
    }
  };
  visit(value);
}
const id = "11111111-1111-4111-8111-111111111111";
const image = {
  id: "22222222-2222-4222-8222-222222222222",
  url: "/auth/login-image.jpg",
  sort_order: 0,
};
export const listingFixture = {
  id,
  listing_code: "RES-D5K7Y2",
  registered_title_document: null,
  title: "3 Bedroom Duplex",
  description: "A property in Ikoyi.",
  occupancy_type: "Residential",
  ownership_type: "Family",
  property_type: "Residential",
  property_subtype: "Semi-Detached House",
  has_lien: false,
  bedrooms: 3,
  bathrooms: 4,
  parking_spaces: 2,
  toilet_count: null,
  units: 2,
  land_area: 2202,
  year_built: 2025,
  facilities: ["Swimming Pool", "CCTV"],
  property_cost_minor: 5000000000,
  minimum_down_payment_minor: 3500000000,
  location: "Odo street",
  state: "Lagos",
  city: "Ikoyi",
  longitude: null,
  latitude: null,
  additional_information: null,
  listing_status: "UNLISTED",
  property_status: "AVAILABLE",
  version: 1,
  created_at: "2026-09-08T12:00:00Z",
  updated_at: "2026-09-08T12:00:00Z",
  listed_at: null,
  completeness: 96,
  leads: 0,
  views: 0,
  time_on_market: null,
  referral_url:
    "http://localhost:3000/properties/RES-D5K7Y2?ref=share",
  images: [image],
  documents: [],
  owner: {
    full_name: "Ada Okafor",
    email: "ada@example.test",
    phone: "08012345678",
  },
};
export const listingOptions = {
  occupancy_type: ["Residential", "Commercial"],
  ownership_type: ["Personal", "Family"],
  property_type: ["Residential", "Commercial"],
  property_subtype: ["Bungalow", "Semi-Detached House", "Block of flats", "Terraced Duplexes", "Terraced Bungalows", "Semi-Detached Bungalows", "Detached Bungalows", "Detached Duplexes"],
  facilities: [
    "Swimming Pool",
    "Gym/Fitness Center",
    "CCTV",
    "Balcony/Terrace",
    "Children Play Area",
    "Tennis Court",
    "Basketball Court",
    "Air Conditioning",
    "Laundry",
    "Garden",
    "Wi-Fi",
    "Housekeeping Services",
    "Car Park",
    "24Hrs Security",
  ],
  document_type: ["Ownership", "Survey", "Other"],
  state: ["Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno", "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu", "Gombe", "Imo", "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara", "Lagos", "Nasarawa", "Niger", "Ogun", "Ondo", "Osun", "Oyo", "Plateau", "Rivers", "Sokoto", "Taraba", "Yobe", "Zamfara", "Federal Capital Territory (FCT)"],
};
export const listingState = { items: [], calls: [] };
export async function mockListings(route, origin) {
  const req = route.request();
  const url = new URL(req.url());
  const path = url.pathname.replace("/api/v1/listings", "");
  const headers = {
    "access-control-allow-origin": origin,
    "access-control-allow-credentials": "true",
    "access-control-allow-methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "access-control-allow-headers": "content-type",
  };
  if (req.method() === "OPTIONS")
    return route.fulfill({ status: 204, headers });
  const raw = req.postData() ?? "";
  const part = raw.match(/name="data"\r\n\r\n([^]*?)\r\n--/);
  let body = {};
  try {
    body = JSON.parse(part ? part[1] : raw || "{}");
  } catch {
    /* file content is not interpreted */
  }
  listingState.calls.push({
    observedAt: Date.now(),
    path,
    method: req.method(),
    body,
    url: url.href,
    raw,
  });
  const current = listingState.items.find(
    (item) => path === `/${item.id}` || path.startsWith(`/${item.id}/`),
  );
  let data;
  if (path === "/options") data = listingOptions;
  else if (req.method() === "GET" && !path) {
    const q = url.searchParams.get("q")?.toLowerCase() ?? "";
    const status = url.searchParams.get("status");
    const items = listingState.items.filter(
      (item) =>
        (item.title.toLowerCase().includes(q) ||
          item.listing_code.toLowerCase().includes(q)) &&
        (!status || item.listing_status === status),
    );
    const page = Number(url.searchParams.get("page") ?? 1);
    data = {
      items: items.slice((page - 1) * 10, page * 10),
      page,
      page_size: 10,
      total: items.length,
      total_pages: Math.ceil(items.length / 10),
    };
  } else if (req.method() === "POST" && !path) {
    const item = structuredClone(listingFixture);
    Object.assign(item, body.content);
    item.id = crypto.randomUUID();
    item.property_cost_minor = Math.round(
      Number(body.content.property_cost) * 100,
    );
    item.minimum_down_payment_minor = Math.round(
      Number(body.content.minimum_down_payment) * 100,
    );
    listingState.items.unshift(item);
    data = item;
  } else if (current) {
    data = current;
    if (req.method() === "PATCH") {
      Object.assign(current, body.content);
      current.version++;
      if (body.retained_images)
        current.images = current.images.filter((image) =>
          body.retained_images.includes(image.id),
        );
    }
    if (path.endsWith("/request-approval")) {
      current.listing_status = "PENDING";
      current.version++;
    }
    if (path.endsWith("/unlist")) {
      current.listing_status = "UNLISTED";
      current.version++;
    }
    if (path.endsWith("/documents") && !path.includes("/mandate/")) {
      assert.equal((raw.match(/name="document"/g) ?? []).length, 1);
      assert.equal(body.description, "Document description");
      assert(!("descriptions" in body));
      current.version++;
    }
    if (path.endsWith("/mandate/documents")) {
      data = (Array.isArray(body) ? body : ["Title Document"]).map((title, i) => ({
        upload_id: `opaque-document-upload-${crypto.randomUUID()}-${i}`,
        title,
        mime_type: "application/pdf",
        size_bytes: 1024 * 1024 * 2,
      }));
      current.mandateDocumentUploads = Object.fromEntries(data.map((document) => [document.upload_id, document]));
      assertNoProviderDetails(data);
    }
    if (path.endsWith("/mandate/signature")) {
      data = {
        upload_id: `opaque-signature-upload-${crypto.randomUUID()}`,
        mime_type: "image/png",
        size_bytes: 2048,
      };
      current.mandateSignatureUpload = data;
      assertNoProviderDetails(data);
    }
    if (path.endsWith("/mandates")) {
      assertNoProviderDetails(body);
      const previous = current.mandate;
      const documents = body.documents.map((document, index) => {
        if (document.kind === "existing") {
          const retained = previous?.documents.find((candidate) => candidate.id === document.id);
          assert(retained, "existing mandate document must use its application ID");
          return { ...retained, sort_order: index };
        }
        const uploaded = current.mandateDocumentUploads?.[document.upload_id];
        assert(uploaded, "new mandate document must use its opaque upload handle");
        return { id: crypto.randomUUID(), title: document.title, mime_type: uploaded.mime_type, size_bytes: uploaded.size_bytes, sort_order: index };
      });
      if (body.signature.kind === "existing") assert(previous?.has_signature, "existing signature state must be saved by application state");
      else assert.equal(body.signature.upload_id, current.mandateSignatureUpload?.upload_id);
      current.mandate = {
        id: previous?.id ?? crypto.randomUUID(),
        listing_id: current.id,
        ...body.content,
        has_signature: true,
        signature_mime_type: "image/png",
        signature_size_bytes: current.mandateSignatureUpload?.size_bytes ?? previous?.signature_size_bytes ?? 2048,
        signed_at: new Date().toISOString(),
        submitted_at: null,
        created_at: previous?.created_at ?? new Date().toISOString(),
        updated_at: new Date().toISOString(),
        documents,
      };
      data = current.mandate;
      assertNoProviderDetails(data);
    }
    if (path.endsWith("/mandate") && req.method() === "GET") {
      if (!current.mandate) {
        return route.fulfill({
          status: 404,
          headers,
          contentType: "application/json",
          body: JSON.stringify({
            success: false,
            error: { code: "LISTING_NOT_FOUND", message: "Mandate not found." },
          }),
        });
      }
      data = current.mandate;
    }
    if (path.endsWith("/submit")) {
      current.listing_status = "PENDING";
      current.requested_at = new Date().toISOString();
      current.version++;
      data = current;
    }
    if (req.method() === "DELETE")
      listingState.items = listingState.items.filter(
        (item) => item.id !== current.id,
      );
  } else
    return route.fulfill({
      status: 404,
      headers,
      contentType: "application/json",
      body: JSON.stringify({
        success: false,
        error: { code: "LISTING_NOT_FOUND", message: "Listing not found." },
      }),
    });
  return route.fulfill({
    status: 200,
    headers,
    contentType: "application/json",
    body: JSON.stringify({ success: true, data }),
  });
}
export async function checkListings({
  page,
  origin,
  screenshot,
  toast,
  passed,
  context,
}) {
  const open = async (path = "/dashboard/listings") => {
    await page.goto(origin + path);
    await page.locator(".listings-title").waitFor();
    await page.evaluate(() => document.fonts.ready);
  };
  const noOverflow = async (width) =>
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
      `Listings overflow at ${width}`,
    );
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aN1cAAAAASUVORK5CYII=",
    "base64",
  );
  for (const width of [1440, 1280, 1024, 768, 430, 390, 360, 320]) {
    await page.setViewportSize({ width, height: 900 });
    listingState.items = [];
    await open();
    await page.getByText("No listings.", { exact: true }).waitFor();
    await noOverflow(width);
    await screenshot(`listings-empty-${width}`);
    listingState.items = [
      structuredClone(listingFixture),
      {
        ...structuredClone(listingFixture),
        id: "33333333-3333-4333-8333-333333333333",
        listing_status: "PENDING",
      },
    ];
    await open();
    await page.locator(".customer-listing-card").first().waitFor();
    assert.equal(await page.locator(".customer-listing-card").count(), 2);
    await noOverflow(width);
    await screenshot(`listings-populated-${width}`);
    await open("/dashboard/listings/new");
    await page.locator('[name="title"]').waitFor();
    assert.equal(
      await page.locator(".listing-editor-fields>section").count(),
      4,
    );
    assert.equal(
      await page.locator('.listing-facilities input[type="checkbox"]').count(),
      14,
    );
    assert.equal(await page.locator('[name="toilet_count"]').count(), 0);
    await noOverflow(width);
    await screenshot(`listing-create-${width}`);
    await open(`/dashboard/listings/${id}`);
    await page.locator(".listing-main-image").waitFor();
    await noOverflow(width);
    assert.equal(await page.locator(".agent-empty>div").innerText(), "-");
    await screenshot(`listing-detail-${width}`);
    await open(`/dashboard/listings/${id}/edit`);
    await page.locator('[name="title"]').waitFor();
    assert.equal(
      await page.locator('[name="title"]').inputValue(),
      listingFixture.title,
    );
    await noOverflow(width);
    await screenshot(`listing-edit-${width}`);
    await page.getByRole("button", { name: "Save & Continue", exact: true }).click();
    await page.locator(".sales-mandate-step").waitFor();
    await noOverflow(width);
    await screenshot(`listing-mandate-${width}`);
    assert.equal(await page.locator("header,footer").count(), 0);
    console.log(`Listings layouts passed at ${width}px`);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  listingState.items = [];
  await open("/dashboard/listings/new");
  await page.locator('[name="title"]').waitFor();
  const before = listingState.calls.filter(
    (call) => call.method === "POST",
  ).length;
  await page
    .getByRole("button", { name: "Save & Continue", exact: true })
    .click();
  assert.equal(
    listingState.calls.filter((call) => call.method === "POST").length,
    before,
  );
  for (const [name, value] of Object.entries({
    registered_title_document: "Certificate of Occupancy",
    title: "A new listing",
    description: "A customer property",
    parking_spaces: "2",
    property_cost: "12000000",
    minimum_down_payment: "6000000",
    location: "Odo street",
    state: "Lagos",
    city: "Ikoyi",
    additional_information: "Close to the waterfront and Victoria Island business district.",
  }))
    await page.locator(`form [name="${name}"]`).fill(value);
  for (const [name, value] of Object.entries({
    occupancy_type: "Residential",
    ownership_type: "Family",
    property_type: "Residential",
    property_subtype: "Bungalow",
    has_lien: "false",
    bedrooms: "2",
    bathrooms: "3",
  }))
    await page.locator(`form [name="${name}"]`).selectOption(value);
  assert.equal(
    await page.locator('[name="property_cost"]').inputValue(),
    "12,000,000",
  );
  assert.equal(
    await page.locator(".down-payment-percent").innerText(),
    "50 %",
  );
  assert.equal(
    await page.locator(".quick-preview-body h3").innerText(),
    "A new listing",
  );
  assert.match(
    await page.locator(".quick-preview-body strong").innerText(),
    /12,000,000/,
  );
  await page
    .getByLabel("Property Image", { exact: true })
    .setInputFiles({ name: "room.png", mimeType: "image/png", buffer: png });
  assert.equal(await page.locator(".listing-image-strip img").count(), 1);
  assert.match(await page.locator(".image-cover-tag").innerText(), /cover/i);
  assert.match(await page.locator(".preview-cover-badge").innerText(), /cover/i);
  await page
    .getByRole("button", { name: "Save & Continue", exact: true })
    .click();
  await toast("Listing created");
  await page.locator(".mandate-step-shell").waitFor();
  assert.equal(await page.locator('.wizard-step-item.current .wizard-step-label').innerText(), "Sales Mandate");
  assert.equal(await page.locator(".mandate-shell-status-badge strong").innerText(), "UNLISTED");
  assert.equal(listingState.items[0].listing_status, "UNLISTED");
  assert.notEqual(listingState.items[0].listing_status, "PENDING");
  assert.equal(listingState.items[0].registered_title_document, "Certificate of Occupancy");
  assert.equal(listingState.items[0].additional_information, "Close to the waterfront and Victoria Island business district.");

  await page.getByRole("button", { name: /Back to Property Data/i }).click();
  await page.locator('[name="title"]').waitFor();
  assert.equal(await page.locator('[name="title"]').inputValue(), "A new listing");
  assert.equal(await page.locator('[name="registered_title_document"]').inputValue(), "Certificate of Occupancy");
  await page.getByRole("button", { name: "Save & Continue", exact: true }).click();
  await toast("Listing updated");
  await page.locator(".mandate-step-shell").waitFor();
  await page.getByRole("link", { name: "View in Dashboard Listings" }).click();
  await page.waitForURL("**/dashboard/listings");
  await page.locator(".customer-listing-card").waitFor();
  assert.equal(
    await page
      .locator('.dashboard-navigation [aria-current="page"]')
      .innerText(),
    "Listings",
  );
  const created = listingState.items[0];
  const menu = page.locator(".listing-action-menu");
  await menu.locator("summary").click();
  for (const label of [
    "View",
    "Edit",
    "Delete",
    "Upload Document",
    "Refer Property",
  ])
    assert((await menu.innerText()).includes(label));
  await context.grantPermissions(["clipboard-read", "clipboard-write"], {
    origin,
  });
  await menu.getByRole("button", { name: /Refer Property/ }).click();
  await toast("Referral link copied to clipboard");
  assert((await menu.innerText()).includes("Link Copied"));
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()),
    `${origin}/properties/${created.listing_code}?ref=${referralsState.links[0].id}`);
  assert.equal(referralsState.links[0].listingId,created.id);
  assert.equal(
    await page.getByRole("button", { name: /Request Approval/ }).count(),
    0,
  );
  await page
    .locator(".listing-action-menu")
    .getByRole("button", { name: /Upload Document/ })
    .click();
  await page.getByRole("dialog").waitFor();
  assert.equal(await page.locator(".document-block").count(), 1);
  assert.equal(await page.getByRole("dialog").locator("textarea").count(), 1);
  assert.equal(await page.getByRole("dialog").locator('input[type="file"]').count(), 1);
  await screenshot("listing-document-drawer");
  await page.locator('[name="title"]').fill("Ownership documents");
  await page.locator('[name="document_type"]').selectOption("Ownership");
  await page.getByRole("dialog").locator('textarea[name="description"]').fill("Document description");
  await page.getByLabel("Upload Document", { exact: true }).setInputFiles({
        name: "paper.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from("%PDF-1.4 test"),
  });
  await page
    .getByRole("dialog").locator('button[type="submit"]')
    .click();
  await toast("Document uploaded");
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await page.locator(".listing-action-menu summary").click();
  await page
    .locator(".listing-action-menu")
    .getByRole("link", { name: /Edit/ })
    .click();
  await page.locator('[name="title"]').waitFor();
  await page.locator('[name="title"]').fill("Edited listing");
  await page
    .getByRole("button", { name: "Save & Continue", exact: true })
    .click();
  await toast("Listing updated");
  await page.locator(".mandate-step-shell").waitFor();
  await page.getByRole("link", { name: "View in Dashboard Listings" }).click();
  await page.waitForURL("**/dashboard/listings");
  assert.equal(listingState.items[0].images.length, 1);
  assert.equal(
    await page.locator(".listing-card-information h2").innerText(),
    "Edited listing",
  );
  await page.locator(".listing-action-menu summary").click();
  await page
    .locator(".listing-action-menu")
    .getByRole("button", { name: /Delete/ })
    .click();
  await page
    .getByRole("dialog", { name: "Delete Listing?", exact: true })
    .waitFor();
  await screenshot("listing-delete-modal");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  assert.equal(listingState.items.length, 1);
  await page.locator(".listing-action-menu summary").click();
  await page
    .locator(".listing-action-menu")
    .getByRole("button", { name: /Delete/ })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete", exact: true })
    .click();
  await toast("Listing deleted");
  await page.getByText("No listings.", { exact: true }).waitFor();
  listingState.items = Array.from({ length: 11 }, (_, index) => ({
    ...structuredClone(listingFixture),
    id: crypto.randomUUID(),
    title: `Property ${index}`,
  }));
  // Freeze the initial search debounce so fast pagination is deterministic.
  // Previously the mount timer reset page 2 to page 1 after 300ms.
  const clockStart = new Date();
  await page.clock.install({ time: clockStart });
  await page.clock.pauseAt(new Date(clockStart.getTime() + 1000));
  const paginationStart = listingState.calls.length;
  try {
    await open();
    await page.locator(".customer-listing-card").first().waitFor();
    await page.getByRole("button", { name: "Next page" }).click();
    await page.clock.runFor(301);
    await page.clock.resume();
    await page.waitForFunction(
      () => document.querySelectorAll(".customer-listing-card").length === 1,
    );
    assert.equal(await page.locator('.listings-pagination [aria-current="page"]').innerText(), "2");
    const paginationPages = listingState.calls.slice(paginationStart).filter(call => call.path === "" && call.method === "GET")
      .map(call => new URL(call.url).searchParams.get("page"));
    // React's development checks may repeat the mount effect. Collapse only
    // adjacent identical requests; a real late reset still produces [1,2,1].
    assert.deepEqual(
      paginationPages.filter((value, index) => index === 0 || value !== paginationPages[index - 1]),
      ["1", "2"],
      "The unchanged initial search must not reset pagination",
    );
  } catch (error) {
    console.error("Pagination requests", listingState.calls.slice(paginationStart).map(({url,observedAt}) => ({url,observedAt})));
    throw error;
  } finally {
    await page.clock.resume();
  }
  await page.getByLabel("Search", { exact: true }).fill("Property 0");
  await page.waitForFunction(
    () =>
      document.querySelector(".listing-card-information h2")?.textContent ===
      "Property 0",
  );
  assert(listingState.calls.some((call) => call.url.includes("q=Property+0")));
  await page.getByLabel("Status", { exact: true }).selectOption("PENDING");
  await page.getByText("No listings.", { exact: true }).waitFor();
  for (const path of ["/dashboard/listings/new", `/dashboard/listings/${listingState.items[0].id}/edit`]) {
    await open(path); await page.locator('[name="property_subtype"]').waitFor();
    assert.equal(await page.locator('[name="registered_title_document"]').count(), 1);
    assert.equal(await page.locator('[name="additional_information"]').count(), 1);
    assert.deepEqual(await page.locator('[name="property_subtype"] option').allTextContents(), ["Select an Option", ...listingOptions.property_subtype]);
    assert.deepEqual(await page.locator('#listing-state-options option').evaluateAll(options => options.map(option => option.value)), listingOptions.state);
    for (const name of ["bedrooms", "bathrooms"]) {
      assert.equal(await page.locator(`[name="${name}"] option`).filter({ hasText: /^7$/ }).count(), 1);
      assert.equal(await page.locator(`[name="${name}"] option`).filter({ hasText: /^100$/ }).count(), 1);
    }
    for (const facility of ["Children Play Area", "Tennis Court", "Basketball Court"]) await page.getByLabel(facility, { exact: true }).check();
    assert.equal(await page.getByLabel("Children Play Area", { exact: true }).isChecked(), true);
    assert.equal(await page.getByLabel("Tennis Court", { exact: true }).isChecked(), true);
    assert.equal(await page.getByLabel("Basketball Court", { exact: true }).isChecked(), true);
  }

  // Full Sales Mandate (Step 2) -> Submission Success (Step 3) validation
  await open(`/dashboard/listings/${listingState.items[0].id}/edit`);
  await page.locator('[name="title"]').waitFor();
  await page.getByRole("button", { name: "Save & Continue", exact: true }).click();
  await toast("Listing updated");
  await page.locator(".sales-mandate-step").waitFor();
  assert((await page.locator(".mandate-header-title").innerText()).includes("Exclusive Sales Mandate (Sellers)"));

  // Fill Part 1
  await page.locator('.mandate-part-1 input[placeholder="Title of the document"]').fill("Mr");
  await page.locator('.mandate-part-1 input[placeholder="Your Surname"]').fill("Okafor");
  await page.locator('.mandate-part-1 input[placeholder="Your Firstname"]').fill("Ada");
  await page.locator('.mandate-part-1 select').selectOption("Female");
  await page.locator('.mandate-part-1 input[type="email"]').fill("ada@example.test");
  await page.locator('.mandate-part-1 input[type="date"]').nth(1).fill("1990-05-15");
  await page.locator('.mandate-part-1 input[placeholder="Your nationality"]').fill("Nigerian");
  await page.locator('.mandate-part-1 input[placeholder="Your Postcode..."]').fill("100001");
  await page.locator('.mandate-part-1 input[placeholder="Your Address"]').fill("Plot 12 Lekki Phase 1");
  await page.locator('.mandate-part-1 input[placeholder="Property..."]').fill("Luxury Duplex");
  await page.locator('.mandate-part-1 input[placeholder="Document Title"]').fill("Certificate of Occupancy");

  // Attach Title Document
  await page.locator('.mandate-upload-hidden-input').setInputFiles({
    name: "certificate-of-occupancy.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4 mock document"),
  });
  await page.locator(".mandate-doc-item").waitFor();
  assert.equal(await page.locator(".mandate-doc-item").count(), 1);
  assert((await page.locator(".mandate-doc-title").innerText()).includes("certificate-of-occupancy.pdf"));

  // Verify Part 2 terms
  assert((await page.locator(".mandate-terms-body").innerText()).includes("PROFESSIONAL/BROKERAGE FEE"));
  assert((await page.locator(".mandate-terms-body").innerText()).includes("10. I hereby consent to the above mandate"));

  // Signature Canvas Drawing
  const canvas = page.locator(".signature-canvas");
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  assert(box);
  await page.mouse.move(box.x + 30, box.y + 30);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) {
    await page.mouse.move(box.x + 30 + i * 12, box.y + 30 + (i % 2 === 0 ? 12 : -12));
  }
  await page.mouse.up();
  await page.waitForFunction(
    () => document.querySelector(".signature-placeholder-hint") === null,
  );

  // Fill signer fields independently from the seller identity.
  await page.locator('.mandate-signature-section input[placeholder="Full legal name"]').fill("Ngozi Authorised Signer");
  await page.locator('.mandate-signature-section input[placeholder="Your address"]').fill("44 Signer Avenue");
  await page.locator('.mandate-signature-section input[placeholder="Telephone number"]').fill("08012345678");
  await page.locator('.mandate-signature-section input[placeholder="abc@example.com"]').fill("signer@example.test");

  // Save Draft & verify persistence of telephone, documents, and signature
  await page.getByRole("button", { name: "Save Draft", exact: true }).click();
  await toast("Mandate draft saved successfully");
  assert.equal(listingState.items[0].mandate?.telephone, "08012345678");
  assert.equal(listingState.items[0].mandate?.signer_name, "Ngozi Authorised Signer");
  assert.equal(listingState.items[0].mandate?.signer_address, "44 Signer Avenue");
  assert.equal(listingState.items[0].mandate?.signer_email, "signer@example.test");

  // Reload / Resume Draft to prove values survive refresh
  await open(`/dashboard/listings/${listingState.items[0].id}/edit`);
  await page.locator('[name="title"]').waitFor();
  await page.getByRole("button", { name: "Save & Continue", exact: true }).click();
  await page.locator(".sales-mandate-step").waitFor();
  assert.equal(await page.locator('.mandate-signature-section input[placeholder="Telephone number"]').inputValue(), "08012345678");
  assert.equal(await page.locator('.mandate-signature-section input[placeholder="Full legal name"]').inputValue(), "Ngozi Authorised Signer");
  assert.equal(await page.locator('.mandate-signature-section input[placeholder="Your address"]').inputValue(), "44 Signer Avenue");
  assert.equal(await page.locator('.mandate-signature-section input[placeholder="abc@example.com"]').inputValue(), "signer@example.test");
  assert.equal(await page.locator(".mandate-doc-item").count(), 1);
  assert.equal(await page.locator(".signature-existing-preview").count(), 1);

  // Remove by application document ID, upload a replacement, and re-sign.
  const restoredDocumentId = listingState.items[0].mandate.documents[0].id;
  await page.getByRole("button", { name: /Remove document/i }).click();
  await page.locator('.mandate-upload-hidden-input').setInputFiles({
    name: "replacement-title.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4 replacement document"),
  });
  await page.getByRole("button", { name: "Clear & Re-sign", exact: true }).click();
  const resignedCanvas = page.locator(".signature-canvas");
  const resignedBox = await resignedCanvas.boundingBox();
  assert(resignedBox);
  await page.mouse.move(resignedBox.x + 25, resignedBox.y + 35);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) {
    await page.mouse.move(resignedBox.x + 25 + i * 11, resignedBox.y + 35 + (i % 2 === 0 ? 10 : -10));
  }
  await page.mouse.up();
  await page.getByRole("button", { name: "Save Draft", exact: true }).click();
  await toast("Mandate draft saved successfully");
  assert.equal(listingState.items[0].mandate.documents.length, 1);
  assert.notEqual(listingState.items[0].mandate.documents[0].id, restoredDocumentId);
  assert.equal(listingState.items[0].mandate.documents[0].title, "replacement-title.pdf");

  await open(`/dashboard/listings/${listingState.items[0].id}/edit`);
  await page.locator('[name="title"]').waitFor();
  await page.getByRole("button", { name: "Save & Continue", exact: true }).click();
  await page.locator(".sales-mandate-step").waitFor();
  assert.equal(await page.locator(".mandate-doc-item").count(), 1);
  assert.equal(await page.locator(".signature-existing-preview").count(), 1);

  // Consent checkbox enforcement: trying to submit without checking consent must fail
  await page.getByRole("button", { name: "Submit Mandate", exact: true }).click();
  await toast("You must agree and consent to the mandate terms (Clause 10).");

  // Check consent
  await page.locator('.mandate-consent-label input[type="checkbox"]').check();

  // Submit Mandate
  await page.getByRole("button", { name: "Submit Mandate", exact: true }).click();
  await toast("Listing submitted to our team for review!");

  // Step 3 Submission Success Screen
  await page.locator(".submit-success-container").waitFor();
  assert((await page.locator(".submit-success-title").innerText()).includes("Your listing has been submitted to our team"));
  assert((await page.locator(".submit-success-subtitle").innerText()).includes("within 2 working days"));
  assert((await page.locator(".submit-success-timeline-card").innerText()).includes("What Happens Next?"));
  assert((await page.locator(".submit-success-timeline-card").innerText()).includes("Submitted"));
  assert((await page.locator(".submit-success-timeline-card").innerText()).includes("We review your listing"));
  assert((await page.locator(".submit-success-timeline-card").innerText()).includes("It goes live"));
  await screenshot("listing-submission-success");

  // CTA View my listings
  await page.getByRole("link", { name: "View my listings", exact: true }).click();
  await page.waitForURL("**/dashboard/listings");
  assert.equal(listingState.items[0].listing_status, "PENDING");

  passed.push(
    "Listings: six responsive widths; empty/populated/Create/View/Edit layouts; Quick Preview and image selection; native required validation; full create/edit/delete lifecycle; single-description/single-file document drawer; referral and legacy-approval controls; Pending/Unlist; server query search/filter/pagination; wizard Step 1 draft and resume; Step 2 Sales Mandate with durable signer fields, title documents, canvas signature, Clause 10 consent, server-authoritative submission, and Step 3 Success timeline screen",
  );
  listingState.items = [];
}
