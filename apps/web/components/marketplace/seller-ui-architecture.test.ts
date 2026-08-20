// @vitest-environment node

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (relativePath: string) => readFileSync(new URL(relativePath, import.meta.url), "utf8");

describe("Seller desktop UI architecture", () => {
  it("provides the PDF-defined Seller shell navigation and account controls", () => {
    const shell = source("./seller-shell.tsx");
    for (const label of ["Dashboard", "My Listings", "Payments", "Subaccounts", "Save-as-you-earn", "Invest", "Refer & earn", "Support", "Settings"]) {
      expect(shell).toContain(label);
    }
    expect(shell).toContain("seller-topbar");
    expect(shell).toContain("PersonaSwitcher");
    expect(shell).toContain("await logout()");
  });

  it("wraps My Listings and listing management in the shell without wrapping initial creation", () => {
    expect(source("../../app/(protected)/seller/listings/page.tsx")).toContain("<SellerShell><SellerListingsScreen");
    expect(source("../../app/(protected)/seller/listings/[propertyId]/page.tsx")).toContain("<SellerShell><SellerListingManagementScreen");
    expect(source("../../app/(protected)/seller/listings/new/page.tsx")).not.toContain("SellerShell");
  });

  it("keeps List property available in the heading and empty state", () => {
    const listings = source("./seller-listings-screen.tsx");
    expect(listings.match(/href=\"\/seller\/listings\/new\"/g)).toHaveLength(2);
    expect(listings).toContain("seller-listing-empty");
    expect(listings).toContain("seller-listing-rows");
  });

  it("uses canonical status actions and four-part draft progress", () => {
    const listings = source("./seller-listings-screen.tsx");
    expect(listings).toContain("sellerListingRouteForAction(item.nextAction, item.id)");
    expect(listings).toContain("Fix &amp; Resend");
    expect(listings).toContain("See buyer view");
    expect(listings).toContain("Array.from({ length: 4 }");
    expect(listings).toContain("Step {step.number} of 4");
  });

  it("distinguishes the creation wizard from status-aware correction editing", () => {
    const editor = source("./seller-draft-editor.tsx");
    expect(editor).toContain("usesSellerShell");
    expect(editor).toContain("Edit this property");
    expect(editor).toContain("Property Details");
    expect(editor).toContain("Photos");
    expect(editor).toContain("Documents");
    expect(editor).toContain("Listing your property is straightforward");
  });

  it("uses the branded hydration state instead of the malformed bare spinner", () => {
    const editor = source("./seller-draft-editor.tsx");
    const styles = source("../../app/seller-editor.css");
    expect(editor).toContain("<SellerListingLoader />");
    expect(editor).toContain("<BerylShelterLogo className=\"seller-loading-brand\"");
    expect(editor).not.toContain("<Spinner label=\"Loading draft\"");
    expect(styles).toContain(".seller-listing-loader");
    expect(styles).toContain("seller-brand-pulse");
    expect(styles).toContain("@media(prefers-reduced-motion:reduce)");
  });
});
