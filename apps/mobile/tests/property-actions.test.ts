import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { createListingsApi } from "../src/lib/listings-api";
import { createAssistanceApi } from "../src/lib/assistance-api";
import { createPublicServicesApi } from "../src/lib/public-services-api";
import { appendPickedFile } from "../src/lib/file-upload-helper";
import { renderStrokesToPng, type Stroke } from "../src/lib/png-encoder";

const root = existsSync(join(process.cwd(), "apps/mobile"))
  ? join(process.cwd(), "apps/mobile")
  : process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

test("signed-out List auth boundary enforces customer login and offers assistance entry", () => {
  const listScreen = read("app/(tabs)/list.tsx");
  assert.match(listScreen, /status\s*!==\s*"signedIn"/);
  assert.match(listScreen, /Sign in to sell a property/);
  assert.match(listScreen, /\/\(auth\)\/login/);
  assert.match(listScreen, /\/\(auth\)\/register/);
  assert.match(listScreen, /const nextPath = draftId/);
  assert.match(listScreen, /params:\s*\{ next: nextPath \}/);
  assert.match(listScreen, /Request Sell Assistance/);
  assert.match(listScreen, /\/sell-assistance/);
});

test("canonical property fields and required validation are preserved in PropertyDataStep", () => {
  const step = read("src/components/listings/property-data-step.tsx");
  // Required fields according to canonical model
  assert.match(step, /title/);
  assert.match(step, /description/);
  assert.match(step, /occupancy_type/);
  assert.match(step, /ownership_type/);
  assert.match(step, /property_type/);
  assert.match(step, /property_subtype/);
  assert.match(step, /has_lien/);
  assert.match(step, /property_cost/);
  assert.match(step, /minimum_down_payment/);
  assert.match(step, /location/);
  assert.match(step, /state/);
  assert.match(step, /city/);
  assert.match(step, /registered_title_document/);
  assert.match(step, /facilities/);
  // Validation checks
  assert.match(step, /At least 1 property photograph is required/);
  assert.match(step, /Minimum down payment cannot exceed total property cost/);
  assert.match(step, /OptionSelect label="State \*"/);
  assert.doesNotMatch(step, /State \*<\/Text>[\s\S]{0,200}<ScrollView horizontal/);
  // Both actions persist the same resumable photo draft. Only Next advances.
  assert.match(step, /onPress=\{\(\) => void handleSave\(true\)\}/);
  assert.match(step, /onPress=\{\(\) => void handleSave\(false\)\}/);
  assert.match(step, /if \(proceedToMandate\) \{\s*onNext\(savedListing\)/);
  assert.match(step, /setDraftNotice\("Property draft saved successfully \(Not Yet for Sale\)\."\)/);
});

test("long Nigerian state lists use the shared vertical selector",()=>{
  const selector=read("src/components/option-select.tsx"),buy=read("app/buy-assistance.tsx");
  assert.match(selector,/ScrollView/);assert.match(selector,/accessibilityRole="radio"/);assert.match(selector,/setOpen\(false\)/);
  assert.match(buy,/OptionSelect label="State \*"/);
});

test("browser image uploads preserve bytes, filename and validated MIME type", async () => {
  const jpegBytes = new Uint8Array([255, 216, 255, 224, 0, 16, 74, 70, 73, 70]);
  const uri = `data:image/jpeg;base64,${Buffer.from(jpegBytes).toString("base64")}`;
  const formData = new FormData();
  await appendPickedFile(formData, "images", {
    uri,
    name: "property-front.jpg",
    type: "image/jpeg",
    size: jpegBytes.length,
  });
  const uploaded = formData.get("images");
  assert.ok(uploaded instanceof Blob);
  assert.equal(uploaded.type, "image/jpeg");
  assert.equal((uploaded as File).name, "property-front.jpg");
  assert.deepEqual(new Uint8Array(await uploaded.arrayBuffer()), jpegBytes);

  const signatureBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const signatureForm = new FormData();
  await appendPickedFile(signatureForm, "signature", {
    uri: "data:image/png;base64,unused",
    name: "signature.png",
    type: "image/png",
    bytes: signatureBytes,
  });
  const signature = signatureForm.get("signature");
  assert.ok(signature instanceof Blob);
  assert.equal((signature as File).name, "signature.png");
  assert.deepEqual(new Uint8Array(await signature.arrayBuffer()), signatureBytes);
});

test("assistance routes own one human-readable header",()=>{
  const layout=read("app/_layout.tsx"),sell=read("app/sell-assistance.tsx"),buy=read("app/buy-assistance.tsx");
  assert.match(layout,/name="sell-assistance" options=\{\{ headerShown: false \}\}/);assert.match(layout,/name="buy-assistance" options=\{\{ headerShown: false \}\}/);
  assert.match(sell,/>Sell Assistance</);assert.match(buy,/>Buy Assistance</);
});

test("listings API enforces private upload contract, multipart bodies and client marker", async () => {
  const calls: { path: string; options: unknown }[] = [];
  const client = {
    request: async <T>(path: string, options?: unknown) => {
      calls.push({ path, options });
      return {} as T;
    },
  };
  const api = createListingsApi(client as never);

  await api.options();
  assert.equal(calls[0]!.path, "/api/v1/listings/options");
  assert.notEqual((calls[0]!.options as { authenticated?: boolean } | undefined)?.authenticated, false);

  await api.createDraft({ title: "Duplex" }, []);
  assert.equal(calls[1]!.path, "/api/v1/listings");
  assert.equal((calls[1]!.options as { method: string }).method, "POST");

  await api.updateDraft("11111111-1111-4111-8111-111111111111", 1, { title: "Duplex" }, [], []);
  assert.equal(calls[2]!.path, "/api/v1/listings/11111111-1111-4111-8111-111111111111");
  assert.equal((calls[2]!.options as { method: string }).method, "PATCH");

  await api.uploadMandateDocuments("11111111-1111-4111-8111-111111111111", []);
  assert.equal(calls[3]!.path, "/api/v1/listings/11111111-1111-4111-8111-111111111111/mandate/documents");

  await api.saveMandate("11111111-1111-4111-8111-111111111111", {
    content: {} as never,
    signature: { kind: "existing" },
    documents: [],
  });
  assert.equal(calls[4]!.path, "/api/v1/listings/11111111-1111-4111-8111-111111111111/mandates");

  await api.submit("11111111-1111-4111-8111-111111111111");
  assert.equal(calls[5]!.path, "/api/v1/listings/11111111-1111-4111-8111-111111111111/submit");
  assert.equal((calls[5]!.options as { method: string }).method, "POST");
});

test("Mobile saves property photos in resumable one-file requests", async () => {
  const calls: {
    path: string;
    method: string;
    data: { version?: number; retained_images?: string[] };
    fileCount: number;
  }[] = [];
  const client = {
    request: async <T>(path: string, options?: unknown) => {
      const request = options as { method: string; body: FormData };
      const data = JSON.parse(String(request.body.get("data"))) as {
        version?: number;
        retained_images?: string[];
      };
      calls.push({
        path,
        method: request.method,
        data,
        fileCount: request.body.getAll("images").length,
      });
      const version = calls.length;
      return {
        id: "11111111-1111-4111-8111-111111111111",
        version,
        images: Array.from({ length: version }, (_, index) => ({
          id: `00000000-0000-4000-8000-00000000000${index + 1}`,
          url: `https://images.example.test/${index + 1}.jpg`,
          sort_order: index,
        })),
      } as T;
    },
  };
  const api = createListingsApi(client as never);
  const images = [1, 2, 3].map((number) => ({
    uri: `data:image/jpeg;base64,${Buffer.from([255, 216, 255, number]).toString("base64")}`,
    name: `property-${number}.jpg`,
    type: "image/jpeg",
  }));
  const progress: number[] = [];

  const saved = await api.saveDraftInPhotoBatches(
    { title: "Duplex" },
    null,
    [],
    images,
    ({ listing }) => progress.push(listing.images.length)
  );

  assert.equal(saved.images.length, 3);
  assert.deepEqual(progress, [1, 2, 3]);
  assert.deepEqual(calls.map((call) => call.method), ["POST", "PATCH", "PATCH"]);
  assert.deepEqual(calls.map((call) => call.fileCount), [1, 1, 1]);
  assert.deepEqual(calls[1]!.data.retained_images, ["00000000-0000-4000-8000-000000000001"]);
  assert.deepEqual(calls[2]!.data.retained_images, [
    "00000000-0000-4000-8000-000000000001",
    "00000000-0000-4000-8000-000000000002",
  ]);
  assert.deepEqual(calls.slice(1).map((call) => call.data.version), [1, 2]);
});

test("blank signature is rejected and valid touch stroke produces compliant PNG", () => {
  const pad = read("src/components/signature-pad.tsx");
  assert.match(pad, /pts\s*<\s*6/);
  assert.match(pad, /maxX\s*-\s*minX\s*>\s*15/);
  assert.match(pad, /renderStrokesToPng/);

  // Non-blank strokes produce valid PNG bytes starting with magic bytes
  const strokes: Stroke[] = [
    [
      { x: 20, y: 30 },
      { x: 60, y: 70 },
      { x: 90, y: 40 },
      { x: 140, y: 100 },
      { x: 180, y: 60 },
      { x: 220, y: 110 },
    ],
  ];
  const png = renderStrokesToPng(strokes, 340, 150, 3);
  assert.deepEqual(Array.from(png.subarray(0, 8)), [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.ok(png.length > 500, "PNG output must be non-trivial binary payload");
});

test("Sales Mandate enforces 10 clauses, fixed 5% commission, 180 days validity and Clause 10 consent", () => {
  const mandateStep = read("src/components/listings/sales-mandate-step.tsx");
  assert.match(mandateStep, /5\.00%/);
  assert.match(mandateStep, /180\s*days/);
  assert.match(mandateStep, /Appointment & Authority/);
  assert.match(mandateStep, /Mandate Validity/);
  assert.match(mandateStep, /Marketing & Inspections/);
  assert.match(mandateStep, /Commission & Fee Structure/);
  assert.match(mandateStep, /Non-Circumvention/);
  assert.match(mandateStep, /Title & Legal Representation/);
  assert.match(mandateStep, /Governing Law & Disputes/);
  assert.match(mandateStep, /Clause 10 Acceptance/);
  assert.match(mandateStep, /agreed_to_mandate/);
  assert.match(mandateStep, /telephone/);
  assert.match(mandateStep, /Upload at least 1 legal title document/);
});

test("listing submission transitions to PENDING review without customer self-approval", () => {
  const successStep = read("src/components/listings/submission-success-step.tsx");
  assert.match(successStep, /Your property has been submitted to our team/);
  assert.match(successStep, /Takes 1–2 working days/);
  assert.match(successStep, /It goes live/);
  assert.doesNotMatch(successStep, /approved|APPROVED|live now|published immediately/i);
});

test("Sell Assistance uses canonical API and creates no automatic listing or purchase", async () => {
  const calls: { path: string; options: unknown }[] = [];
  const client = {
    request: async <T>(path: string, options?: unknown) => {
      calls.push({ path, options });
      return {} as T;
    },
  };
  const api = createAssistanceApi(client as never);
  await api.submitSellAssistance({ contactName: "Ada", location: "Lekki" }, []);

  assert.equal(calls[0]!.path, "/api/v1/public/sell-assistance");
  assert.equal((calls[0]!.options as { method: string }).method, "POST");
  assert.equal((calls[0]!.options as { authenticated: boolean }).authenticated, false);

  const screen = read("app/sell-assistance.tsx");
  assert.match(screen, /Sell Assistance does not create a live public listing or a purchase transaction/i);
  assert.doesNotMatch(screen, /checkout|paystack|flutterwave|stripe|cart/i);
});

test("Buy Assistance uses canonical API and creates no purchase or mortgage commitment", async () => {
  const calls: { path: string; options: unknown }[] = [];
  const client = {
    request: async <T>(path: string, options?: unknown) => {
      calls.push({ path, options });
      return {} as T;
    },
  };
  const api = createAssistanceApi(client as never);
  await api.submitBuyAssistance({ contactName: "Ada", budget: "50000000" });

  assert.equal(calls[0]!.path, "/api/v1/public/buy-assistance");
  assert.equal((calls[0]!.options as { method: string }).method, "POST");
  assert.equal((calls[0]!.options as { authenticated: boolean }).authenticated, false);

  const screen = read("app/buy-assistance.tsx");
  assert.match(screen, /customer search advisory service/i);
  assert.doesNotMatch(screen, /paystack|flutterwave|stripe|buy now/i);
});

test("Property Viewing uses canonical property code and supports anonymous viewing requests", async () => {
  const calls: { path: string; options: unknown }[] = [];
  const client = {
    request: async <T>(path: string, options?: unknown) => {
      calls.push({ path, options });
      return {} as T;
    },
  };
  const api = createPublicServicesApi(client as never);
  await api.submitPropertyViewing({
    propertyCode: "RES-ABC123",
    firstName: "Ada",
    lastName: "Buyer",
    email: "ada@example.com",
    phone: "08012345678",
    preferredDate: "2026-10-15",
    preferredTime: "10:00",
    flexibleDates: false,
  });

  assert.equal(calls[0]!.path, "/api/v1/public/property-viewings");
  assert.equal((calls[0]!.options as { method: string }).method, "POST");
  assert.equal((calls[0]!.options as { authenticated: boolean }).authenticated, false);

  const modal = read("src/components/viewing-modal.tsx");
  const contact = read("src/lib/viewing-contact.ts");
  assert.match(modal, /Viewing requests\s+are free and do not require any payment/i);
  assert.match(modal, /IMPORTANT: PHONE CONFIRMATION REQUIRED/);
  assert.match(modal, /Viewing Request Submitted/);
  assert.match(modal, /appointment is not yet confirmed/);
  assert.match(modal, /YOU MUST CALL TO CONFIRM/);
  assert.match(modal, /Linking\.openURL\(VIEWING_OFFICE_PHONE_URL\)/);
  assert.match(contact, /0704 205 5678/);
  assert.match(contact, /\+2347042055678/);
  assert.match(modal, /label="First Name \*"/);
  assert.match(modal, /label="Preferred Time \*"/);
  assert.doesNotMatch(modal, /checkout|paystack|flutterwave|buy now/i);
});

test("Real Estate Inquiry uses canonical /api/v1/public/inquiries endpoint", async () => {
  const calls: { path: string; options: unknown }[] = [];
  const client = {
    request: async <T>(path: string, options?: unknown) => {
      calls.push({ path, options });
      return {} as T;
    },
  };
  const api = createPublicServicesApi(client as never);
  await api.submitPublicInquiry({
    inquiryType: "Property Inquiry",
    name: "Ada",
    phone: "08012345678",
    email: "ada@example.com",
    message: "Inquiry details",
    sourcePage: "property_detail",
  });

  assert.equal(calls[0]!.path, "/api/v1/public/inquiries");
  assert.equal((calls[0]!.options as { method: string }).method, "POST");
  assert.equal((calls[0]!.options as { authenticated: boolean }).authenticated, false);

  const modal = read("src/components/inquiry-modal.tsx");
  assert.match(modal, /Inquiry received/i);
  assert.match(modal, /0704 205 5678/);
});

test("critical invariants: no online property purchase, 2% referral commission, no 4%, no admin", () => {
  const mobileFiles = [
    "app/(tabs)/list.tsx",
    "app/(tabs)/properties/[propertyCode].tsx",
    "app/sell-assistance.tsx",
    "app/buy-assistance.tsx",
    "src/components/viewing-modal.tsx",
    "src/components/inquiry-modal.tsx",
    "src/components/listings/property-data-step.tsx",
    "src/components/listings/sales-mandate-step.tsx",
    "src/components/listings/submission-success-step.tsx",
    "src/lib/listings-api.ts",
    "src/lib/assistance-api.ts",
    "src/lib/public-services-api.ts",
  ].map(read).join("\n");

  // No online property payment / purchase gateways or buy now buttons
  assert.doesNotMatch(mobileFiles, /\bbuy now\b|paystack|flutterwave|stripe|escrow|payment gateway/i);
  assert.match(mobileFiles, /no online checkout/i);
  // Referral commission must never be 4%
  assert.doesNotMatch(mobileFiles, /\b4%\b|400\s*bps/i);
  assert.match(mobileFiles, /2%/);
  // No Admin routes or functionality in Mobile
  assert.doesNotMatch(mobileFiles, /\/api\/v1\/admin/i);
});
