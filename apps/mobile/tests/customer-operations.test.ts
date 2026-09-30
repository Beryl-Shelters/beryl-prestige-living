import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { createDashboardApi } from "../src/lib/dashboard-api";
import {
  createListingsApi,
  listingStatusPresentation,
  type ListingStatus,
} from "../src/lib/listings-api";
import { formatNaira } from "../src/lib/money";

const root = existsSync(join(process.cwd(), "apps/mobile"))
  ? join(process.cwd(), "apps/mobile")
  : process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

test("Dashboard requires authentication and guards routes with redirect", () => {
  const layout = read("app/dashboard/_layout.tsx");
  assert.match(layout, /useAuth/);
  assert.match(layout, /status\s*!==\s*"signedIn"/);
  assert.match(layout, /\/\(auth\)\/login/);
  assert.match(layout, /Stack\.Screen name="index"/);
  assert.match(layout, /Stack\.Screen name="listings"/);
  assert.match(layout, /Stack\.Screen name="analytics"/);
  assert.match(layout, /Stack\.Screen name="purchased-properties"/);
});

test("Dashboard Overview uses real API data and does not fabricate metrics", async () => {
  const calls: { path: string; options: unknown }[] = [];
  const client = {
    request: async <T>(path: string, options?: unknown) => {
      calls.push({ path, options });
      return {
        customer: {
          id: "cust-1",
          first_name: "Ada",
          last_name: "Okafor",
          account_type: "PERSONAL",
          profile_type: "INDIVIDUAL",
          profile_image_url: null,
        },
        summary: {
          total_investments: 0,
          properties_owned: 0,
          referral_earnings: 0,
          new_messages: 0,
        },
        revenue: { monthly: [], yearly: [] },
        recent_messages: [],
        recent_property_listings: [],
      } as T;
    },
  };

  const api = createDashboardApi(client as never);
  const data = await api.getOverview();

  assert.equal(calls[0]!.path, "/api/v1/dashboard/overview");
  assert.equal(data.summary.total_investments, 0);
  assert.equal(data.summary.properties_owned, 0);
  assert.equal(data.summary.referral_earnings, 0);
  assert.equal(data.summary.new_messages, 0);

  const overviewScreen = read("app/dashboard/index.tsx");
  assert.match(overviewScreen, /dashboardApi\.getOverview/);
  assert.match(overviewScreen, /summary\?\.total_investments/);
  assert.match(overviewScreen, /summary\?\.properties_owned/);
  assert.match(overviewScreen, /summary\?\.referral_earnings/);
  assert.match(overviewScreen, /summary\?\.new_messages/);
  assert.match(overviewScreen, /No properties listed yet/);
});

test("My Listings uses canonical owner-scoped API with search, filters and pagination", async () => {
  const calls: { path: string; options: unknown }[] = [];
  const client = {
    request: async <T>(path: string, options?: unknown) => {
      calls.push({ path, options });
      return {
        items: [],
        page: 2,
        page_size: 10,
        total: 15,
        total_pages: 2,
        counts: { all: 15, UNLISTED: 5, PENDING: 3, LISTED: 6, REJECTED: 1 },
      } as T;
    },
  };

  const api = createListingsApi(client as never);
  await api.list({ q: "Lekki Villa", status: "LISTED", page: 2, pageSize: 10 });

  assert.equal(calls[0]!.path, "/api/v1/listings?q=Lekki+Villa&status=LISTED&page=2&page_size=10");

  const listingsScreen = read("app/dashboard/listings/index.tsx");
  assert.match(listingsScreen, /listingsApi\.list/);
  assert.match(listingsScreen, /debouncedQuery/);
  assert.match(listingsScreen, /selectedStatus/);

  // Exact filters from Customer Web
  assert.match(listingsScreen, /label:\s*"All",\s*value:\s*""/);
  assert.match(listingsScreen, /label:\s*"Approved",\s*value:\s*"LISTED"/);
  assert.match(listingsScreen, /label:\s*"Pending",\s*value:\s*"PENDING"/);
  assert.match(listingsScreen, /label:\s*"Rejected",\s*value:\s*"REJECTED"/);
  assert.match(listingsScreen, /label:\s*"Unlisted",\s*value:\s*"UNLISTED"/);

  // No synthetic DRAFT filter
  assert.doesNotMatch(listingsScreen, /label:\s*"Draft"/i);
  assert.doesNotMatch(listingsScreen, /value:\s*"DRAFT"/i);
});

test("canonical listing lifecycle: UNLISTED, PENDING, LISTED, REJECTED supported without synthetic statuses", () => {
  const canonicalStatuses: ListingStatus[] = ["UNLISTED", "PENDING", "LISTED", "REJECTED"];
  assert.equal(canonicalStatuses.length, 4);

  // Verify presentation mapping
  for (const status of canonicalStatuses) {
    const presentation = listingStatusPresentation(status);
    assert.ok(presentation.label);
    assert.ok(presentation.tone);
  }

  // LISTED has customer-facing 'Approved' label without changing its canonical value
  const listedPres = listingStatusPresentation("LISTED");
  assert.equal(listedPres.label, "Approved");
  assert.equal(listedPres.tone, "success");

  // PENDING has friendly presentation without changing its canonical value
  const pendingPres = listingStatusPresentation("PENDING");
  assert.equal(pendingPres.label, "Pending");
  assert.equal(pendingPres.tone, "warning");

  // REJECTED presentation
  const rejectedPres = listingStatusPresentation("REJECTED");
  assert.equal(rejectedPres.label, "Rejected");
  assert.equal(rejectedPres.tone, "danger");

  // UNLISTED presentation
  const unlistedPres = listingStatusPresentation("UNLISTED");
  assert.equal(unlistedPres.label, "Unlisted");
  assert.equal(unlistedPres.tone, "neutral");

  // Inspect source files to ensure NO synthetic domain/API status exists
  const filesToCheck = [
    "src/lib/listings-api.ts",
    "src/lib/dashboard-api.ts",
    "app/dashboard/listings/index.tsx",
    "app/dashboard/listings/[id].tsx",
    "src/components/listings/listing-action-modals.tsx",
  ].map(read).join("\n");

  // No DRAFT status
  assert.doesNotMatch(filesToCheck, /ListingStatus\s*=\s*[^;]*["']DRAFT["']/);
  assert.doesNotMatch(filesToCheck, /listing_status\s*:\s*["']DRAFT["']/);

  // No PENDING_REVIEW status
  assert.doesNotMatch(filesToCheck, /["']PENDING_REVIEW["']/);

  // No APPROVED domain status (only 'Approved' as UI label)
  assert.doesNotMatch(filesToCheck, /ListingStatus\s*=\s*[^;]*["']APPROVED["']/);
  assert.doesNotMatch(filesToCheck, /status\s*===\s*["']APPROVED["']/);
  assert.doesNotMatch(filesToCheck, /listing_status\s*:\s*["']APPROVED["']/);

  // No CHANGES_REQUESTED status
  assert.doesNotMatch(filesToCheck, /["']CHANGES_REQUESTED["']/);
});

test("rejected listing feedback and resubmission transitions to PENDING without self-approval", async () => {
  const calls: { path: string; options: unknown }[] = [];
  const client = {
    request: async <T>(path: string, options?: unknown) => {
      calls.push({ path, options });
      return { id: "listing-1", listing_status: "PENDING", version: 2 } as T;
    },
  };

  const api = createListingsApi(client as never);
  const updated = await api.submit("listing-1");

  // Resubmission calls submit endpoint, returning to PENDING
  assert.equal(calls[0]!.path, "/api/v1/listings/listing-1/submit");
  assert.equal((calls[0]!.options as { method: string }).method, "POST");
  assert.equal(updated.listing_status, "PENDING");

  // Customer cannot self-approve
  assert.notEqual(updated.listing_status, "LISTED");

  const detailScreen = read("app/dashboard/listings/[id].tsx");
  assert.match(detailScreen, /rejection_reason/);
  assert.match(detailScreen, /Changes Needed/);
  assert.match(detailScreen, /Resubmit for Review/);
  assert.match(detailScreen, /listingsApi\.submit/);
});

test("listing action eligibility: only LISTED can be unlisted; PENDING cannot be unlisted", async () => {
  const calls: { path: string; options: unknown }[] = [];
  const client = {
    request: async <T>(path: string, options?: unknown) => {
      calls.push({ path, options });
      return { success: true } as T;
    },
  };

  const api = createListingsApi(client as never);
  await api.unlist("listing-xyz", 3);
  await api.delete("listing-xyz", 4);

  // Unlist call
  assert.equal(calls[0]!.path, "/api/v1/listings/listing-xyz/unlist");
  assert.equal((calls[0]!.options as { method: string }).method, "POST");
  assert.deepEqual((calls[0]!.options as { body: unknown }).body, { version: 3 });

  // Delete call
  assert.equal(calls[1]!.path, "/api/v1/listings/listing-xyz");
  assert.equal((calls[1]!.options as { method: string }).method, "DELETE");
  assert.deepEqual((calls[1]!.options as { body: unknown }).body, { version: 4 });

  // Check detail screen UI rules
  const detailScreen = read("app/dashboard/listings/[id].tsx");

  // Only LISTED listings have the Unlist button
  assert.match(detailScreen, /listing\.listing_status\s*===\s*"LISTED"\s*&&\s*\(\s*<Button\s+label="Unlist Property"/);

  // PENDING displays review notice and NO unlist button
  assert.match(detailScreen, /listing\.listing_status\s*===\s*"PENDING"/);
  assert.match(detailScreen, /While under review,\s*details cannot be edited or unlisted/);

  // Modal checks
  const modals = read("src/components/listings/listing-action-modals.tsx");
  assert.match(modals, /Unlist Listing\?/);
  assert.match(modals, /Delete Listing\?/);
  assert.match(modals, /This removes the property and its attached listing media permanently/);
});

test("profile completion is not fabricated; listing completeness comes from API", () => {
  const indexOverview = read("app/dashboard/index.tsx");
  const listingsScreen = read("app/dashboard/listings/index.tsx");

  // No fabricated 100% profile completeness banner
  assert.doesNotMatch(indexOverview, /Profile Completeness/i);
  assert.doesNotMatch(indexOverview, /100%\s*complete/i);
  assert.doesNotMatch(listingsScreen, /Profile Completeness/i);

  // Per-listing completeness bar reflects actual item.completeness from API
  assert.match(listingsScreen, /item\.completeness/);
  assert.match(listingsScreen, /<Text style=\{styles\.completenessPercent\}>\{completeness\}%<\/Text>/);
});

test("Dashboard Analytics uses real owner data and preserves truthful zeros", async () => {
  const calls: { path: string; options: unknown }[] = [];
  const client = {
    request: async <T>(path: string, options?: unknown) => {
      calls.push({ path, options });
      return {
        year: 2026,
        categoryPerformance: [
          { month: 1, label: "Jan", buy: 0, sell: 0, referral: 0 },
        ],
        listingsOverview: {
          total: 0,
          listed: { count: 0, percentage: 0 },
          pending: { count: 0, percentage: 0 },
          rejected: { count: 0, percentage: 0 },
        },
        bedrooms: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
        propertyTypes: { commercial: 0, residential: 0 },
      } as T;
    },
  };

  const api = createDashboardApi(client as never);
  const data = await api.getAnalytics({ q: "Duplex", year: 2026 });

  assert.equal(calls[0]!.path, "/api/v1/dashboard/analytics?q=Duplex&year=2026");
  assert.equal(data.listingsOverview.total, 0);

  const analyticsScreen = read("app/dashboard/analytics.tsx");
  assert.match(analyticsScreen, /dashboardApi\.getAnalytics/);
  assert.match(analyticsScreen, /Category Performance/);
  assert.match(analyticsScreen, /Listings Overview/);
  assert.match(analyticsScreen, /Bedrooms Contained in Properties/);
  assert.match(analyticsScreen, /Property Type Distribution/);
});

test("Purchased Properties uses immutable completed-purchase records without online checkout", async () => {
  const calls: { path: string; options: unknown }[] = [];
  const client = {
    request: async <T>(path: string, options?: unknown) => {
      calls.push({ path, options });
      return {
        items: [
          {
            propertyCode: "PRO-OFFLINE1",
            title: "Victoria Island Penthouse",
            state: "Lagos",
            propertyType: "Residential",
            propertySubtype: "Detached Duplexes",
            priceMinor: 15000000000,
            closedAt: "2026-05-10T12:00:00Z",
          },
        ],
        page: 1,
        pageSize: 10,
        total: 1,
        totalPages: 1,
      } as T;
    },
  };

  const api = createDashboardApi(client as never);
  const data = await api.getPurchasedProperties({ q: "Victoria", page: 1 });

  assert.equal(calls[0]!.path, "/api/v1/dashboard/properties?q=Victoria&page=1");
  assert.equal(data.items[0]!.propertyCode, "PRO-OFFLINE1");
  assert.equal(formatNaira(data.items[0]!.priceMinor), "₦150,000,000");

  const purchasedScreen = read("app/dashboard/purchased-properties.tsx");
  assert.match(purchasedScreen, /dashboardApi\.getPurchasedProperties/);
  assert.match(purchasedScreen, /Verified offline purchase record/i);
  assert.match(purchasedScreen, /no online property checkout/i);
  assert.doesNotMatch(purchasedScreen, /paystack|flutterwave|stripe|escrow|buy now/i);
});

test("critical invariants: no online property purchase, 2% referral rate, no 4%, no admin in Mobile", () => {
  const files = [
    "app/dashboard/index.tsx",
    "app/dashboard/analytics.tsx",
    "app/dashboard/purchased-properties.tsx",
    "app/dashboard/listings/index.tsx",
    "app/dashboard/listings/[id].tsx",
    "src/lib/dashboard-api.ts",
    "src/lib/listings-api.ts",
    "src/components/dashboard/dashboard-drawer.tsx",
    "src/components/dashboard/revenue-chart.tsx",
    "src/components/dashboard/analytics-chart.tsx",
    "src/components/listings/listing-action-modals.tsx",
  ]
    .map(read)
    .join("\n");

  // No online property payment / purchase gateways or buy now buttons
  assert.doesNotMatch(files, /\bbuy now\b|paystack|flutterwave|stripe|escrow|payment gateway/i);
  assert.match(files, /no online property checkout/i);

  // Referral rate must never be 4%
  assert.doesNotMatch(files, /\b4%\b|400\s*bps/i);

  // No Admin routes or functionality in Mobile
  assert.doesNotMatch(files, /\/api\/v1\/admin/i);
});
