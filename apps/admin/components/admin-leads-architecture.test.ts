import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd().endsWith("apps\\admin") || process.cwd().endsWith("apps/admin") ? process.cwd() : join(process.cwd(), "apps", "admin");
const source = (path: string) => readFileSync(join(root, path), "utf8");
const board = source("components/admin-leads-board.tsx");
const detail = source("components/admin-lead-detail.tsx");
const shell = source("components/admin-dashboard.tsx");
const css = source("app/globals.css");
const boardRoute = source("app/api/admin/leads/route.ts");
const detailRoute = source("app/api/admin/leads/[leadId]/route.ts");
const stageRoute = source("app/api/admin/leads/[leadId]/stage/route.ts");

describe("Admin lead management interface", () => {
  it("places Leads in the canonical Admin sidebar", () => expect(shell).toContain(">Leads</Link>"));
  it("uses the approved primary navigation and gates Admin Management", () => { ["Dashboard", "Users", "Properties", "Leads", "Referrers", "Admin Management"].forEach((label) => expect(shell).toContain(label)); expect(shell).toContain('admin.adminRole === "SUPER_ADMIN"'); });
  it("removes unrelated marketplace-customer sidebar items", () => ["My Listings", "Payments", "Subaccounts", "Save-as-you-earn", "Invest", "Refer & Earn", "Support"].forEach((label) => expect(shell).not.toContain(label)));
  it("keeps Settings, profile, and logout at the sidebar bottom", () => { expect(shell).toContain("sidebar-footer"); expect(shell).toContain("sidebar-profile"); expect(shell).toContain("Log out"); });
  it("renders four explicit pipeline stages", () => ["NEW", "CONTACTED", "WON", "LOST"].forEach((stage) => expect(board).toContain(stage)));
  it("shows database counts rather than deriving them from visible cards", () => expect(board).toContain("data.counts[value]"));
  it("uses a server-driven search query", () => expect(board).toContain("/api/admin/leads?"));
  it("trims blank search input", () => expect(board).toContain("query.trim()"));
  it("bounds the board request", () => expect(board).toContain('limit: "20"'));
  it("includes customer identity on each lead card", () => expect(board).toContain("lead.customerName"));
  it("includes property context on each lead card", () => expect(board).toContain("lead.propertyTitle"));
  it("includes received time on each lead card", () => expect(board).toContain("lead.receivedAt"));
  it("links cards with the canonical inquiry UUID, not a display reference", () => {
    expect(board).toContain("/dashboard/leads/${lead.id}");
    expect(board).not.toContain("/dashboard/leads/${lead.referenceId}");
    expect(board).not.toContain("/dashboard/leads/${lead.propertyId}");
  });
  it("has loading skeletons", () => expect(board).toContain("skeleton-card"));
  it("has retryable API errors", () => { expect(board).toContain("Try again"); expect(detail).toContain("Try again"); });
  it("has the approved global, filtered, column, and message empty states", () => { ["No Enquiries Yet", "Buyer enquiries will land here as they come in.", "No enquiries match this search", "No leads in"].forEach((copy) => expect(board).toContain(copy)); expect(detail).toContain("did not include a message"); });
  it("renders operational customer contact details", () => ["Email", "Phone", "Preferred contact"].forEach((label) => expect(detail).toContain(label)));
  it("renders customer persona badges", () => expect(detail).toContain("lead.customer.personas"));
  it("renders plain text message content", () => expect(detail).toContain('<p className="lead-message">{lead.message}</p>'));
  it("renders safe property context", () => ["Property interested in", "publicLocation", "askingPrice", "propertyCategory", "propertyType"].forEach((label) => expect(detail).toContain(label)));
  it("shows bounded referred-by context only when supplied", () => { expect(detail).toContain("lead.referredBy"); expect(detail).toContain("Referred by"); });
  it("uses the shared protected Admin property route", () => { expect(detail).toContain("adminPropertyFromLeadPath(lead.property.id, lead.id)"); expect(detail).toContain(">View property</Link>"); });
  it("supports NEW to CONTACTED", () => expect(detail).toContain('transition("CONTACTED")'));
  it("requires an explicit Won confirmation before CONTACTED to WON", () => {
    ["Move this enquiry to a Won Lead?", '"Confirm"', "Cancel", 'role="dialog"', 'await transition("WON")'].forEach((value) => expect(detail).toContain(value));
    expect(detail).not.toContain('onClick={() => void transition("WON")}');
  });
  it("supports CONTACTED to LOST", () => expect(detail).toContain('transition("LOST")'));
  it("sends expected stage for concurrency protection", () => expect(detail).toContain("expectedStage: lead.stage"));
  it("disables controls during updates", () => expect(detail).toContain("disabled={Boolean(updating)}"));
  it("renders immutable stage history", () => expect(detail).toContain("lead.history.map"));
  it("forwards board search through the cookie BFF", () => { expect(boardRoute).toContain("request.nextUrl.searchParams.toString()"); expect(boardRoute).toContain("protectedAdminRequest"); });
  it("encodes dynamic lead identifiers", () => { expect(detailRoute).toContain("encodeURIComponent"); expect(stageRoute).toContain("encodeURIComponent"); });
  it("forwards stage updates as PATCH", () => expect(stageRoute).toContain('"PATCH"'));
  it("keeps tokens server-only", () => { expect(board).not.toMatch(/accessToken|refreshToken|localStorage/); expect(detail).not.toMatch(/accessToken|refreshToken|localStorage/); });
  it("allows horizontal scrolling for compact boards", () => expect(css).toMatch(/\.lead-board[\s\S]*overflow-x: auto/));
  it("keeps stage controls sticky on desktop", () => expect(css).toMatch(/\.stage-panel[\s\S]*position: sticky/));
  it("removes sticky behavior on small screens", () => expect(css).toContain(".stage-panel { position: static; }"));
});
