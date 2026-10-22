# Task 2A: Sell/List Property + Sales Mandate Architecture Analysis

This document serves as the discovery and architecture analysis report for updating the Beryl Shelter "Sell/List Property" flow with an "Exclusive Sales Mandate." No files have been modified, and no implementations have begun.

## 1. Complete Field-Gap Matrix (Current Listing Data Model)
The current `customer_listings` table includes: `user_id`, `title`, `description`, `occupancy_type`, `ownership_type`, `property_type`, `property_subtype`, `has_lien`, `bedrooms`, `bathrooms`, `parking_spaces`, `units`, `land_area`, `year_built`, `facilities`, `property_cost_minor`, `minimum_down_payment_minor`, `location`, `state`, `city`, `longitude`, `latitude`, `listing_status`, `property_status`, `version`, `created_at`, `updated_at`, `requested_at`, and `listed_at`.

Classification of new Property Data design fields:
* **Registered title/document title for the property:** **B** (Supported by the `title` field if it means the display name. If it strictly means the legal title deed name, it requires **C** — a new column).
* **Property images:** **A** (`customer_listing_images`).
* **Property description:** **A** (`description`).
* **Residential or Commercial classification:** **A** (`occupancy_type`).
* **Personal or Family property classification:** **A** (`ownership_type`).
* **Location:** **A** (`location`, `state`, `city`).
* **Property Type:** **A** (`property_type`).
* **Property Subtype:** **A** (`property_subtype`).
* **Whether the property has a lien:** **A** (`has_lien`).
* **Number of bedrooms:** **A** (`bedrooms`).
* **Number of bathrooms:** **A** (`bathrooms`).
* **Parking spaces:** **A** (`parking_spaces`).
* **Number of units:** **A** (`units`).
* **Land area in Sq.Ft.:** **A** (`land_area`).
* **Year built:** **A** (`year_built`).
* **Additional facilities:** **A** (`facilities`).
* **Other information:** **B** (Can be appended to `description`, or requires **C** if a discrete DB column is strictly needed).
* **Selling Price:** **A** (`property_cost_minor`).
* **Minimum Down Payment:** **A** (`minimum_down_payment_minor`).

## 2. Current Listing Lifecycle & Status Transitions
* **Existing States:** `UNLISTED`, `PENDING`, `LISTED`, `REJECTED`.
* **Editing after submission:** Sellers **cannot** edit after submission. The DB function `mutate_customer_listing` explicitly checks `v_old.listing_status not in ('UNLISTED','REJECTED') then raise exception 'Unlist before editing'`.
* **Cause of LISTED/public state:** The customer API only permits the `REQUEST_APPROVAL` action (which sets status to `PENDING`). The `LISTED` transition is handled externally by Admins.
* **Review/approval state:** Yes, the `PENDING` state exists precisely for this.
* **Rejected/requested-changes:** Yes, the `REJECTED` state exists, allowing sellers to re-edit.
* **listed_at behavior:** It is populated when approved by Admin and is used by the frontend to calculate the `time_on_market` (e.g., days since published).

## 3. Proposed Lifecycle
The core lifecycle statuses (`UNLISTED`, `PENDING`, `LISTED`, `REJECTED`) perfectly map to the new wizard requirements and do not require modification. 
* **Drafting:** Step 1 saves the listing in the `UNLISTED` state.
* **Mandate:** Step 2 creates the mandate record.
* **Submission:** Final submission triggers `REQUEST_APPROVAL`, moving the listing to `PENDING` where it awaits Admin review of the attached mandate.

## 4. Public Buy Relationship
The public Buy UI and API remain strictly isolated. The `presentListing` public API formatter strictly relies on the listing being in the `LISTED` state. Draft (`UNLISTED`), review (`PENDING`), or `REJECTED` listings cannot leak into public search results.

## 5. Upload/Document-Storage Analysis
* **Busboy Streams:** Both listing images and KYC documents use `busboy` in Express to parse multipart streams efficiently, enforcing strict size limits (5 MiB for images, 10 MiB for documents) without buffering huge payloads into memory.
* **Hardcoded Limits Blocking Mandates:** The new mandate requires "Attach copy of title documents (supports multiple documents)". Currently, `listings/uploads.ts` hardcodes `limits: { files: document ? 1 : MAX_IMAGES }`. Furthermore, the DB migration `202609100002_single_document_upload.sql` explicitly enforces `if jsonb_array_length(p_documents) <> 1 then raise exception 'Exactly one document is required'`. **These hard limits will block multiple document uploads and must be updated.**

## 6. Mandate Data-Model Recommendation
* **Recommendation:** Mandate PII MUST live in a separate, strongly-typed `sales_mandates` table rather than being appended to the listings table.
* **Why:** Mandates represent highly sensitive PII and legal contracts. The listings table is heavily utilized for public presentation. Splitting them enables strict Row Level Security (RLS) on mandates, ensuring public API queries can never accidentally leak dates of birth, exact legal names, or signatures.
* **Proposed Schema:**
  * `id` (UUID, PK)
  * `listing_id` (UUID, FK to `customer_listings`)
  * `user_id` (UUID, FK to owner)
  * `seller_title` (Text)
  * `surname` (Text)
  * `first_names` (Text)
  * `gender` (Enum/Text)
  * `email` (Text)
  * `date_of_birth` (Date)
  * `nationality` (Text)
  * `post_code` (Text)
  * `address` (Text)
  * `property_development_name` (Text)
  * `document_title` (Text)
  * `agreed_to_mandate` (Boolean) / `signature_data` (Text)

## 7. Seller-Profile Prefill Analysis
The Next.js frontend can securely fetch the user's `settings/profile` (Auth email, first/last name) and their verified KYC data (gender, date of birth, nationality, address) to prefill the Step 2 React `useState` form values. This removes friction by preventing retyping, while allowing the seller to adjust the legal entity name if necessary.

## 8. Signature Options and Recommendation
* **Repository Analysis:** `git grep` reveals no existing React signature canvas or drawing libraries in the repository. "Signature" is only used for backend cryptographic API hashes.
* **Standard Web Approaches:**
  1. **Type-to-Sign:** A text input where the user types their full legal name, accompanied by a checkbox confirming electronic signature intent. (High accessibility, zero dependencies).
  2. **Canvas Drawing:** Implement HTML5 Canvas (or `react-signature-canvas`) to draw a wet signature, exporting it as a base64 Data URL to be saved as an asset.
* **Recommendation:** Begin with **Type-to-Sign** as it is highly accessible, responsive, and requires zero external dependencies, mapping effectively to modern e-signature compliance norms unless strict wet-signature rendering is a firm legal requirement.

## 9. Dashboard Listings Integration
The existing `ListingEditorScreen` component currently assumes a single-page scrolling form that submits all data at once. The new design requires refactoring this into a wizard component (`step === 1 ? <PropertyData /> : <SalesMandate />`). The component must validate all Property Data fields before allowing progression to Step 2, and coordinate two API calls (or one combined transaction) to save both the listing and the mandate.

## 10. Future Admin Control Matrix
While Admin modifications are out of scope for this task, the architecture ensures future-proofing. Admins MUST eventually be provided a UI to view and download the securely stored Sales Mandate PDF/Data to legally authorize the property and fulfill offline physical sales.

## 11. Privacy/Security Analysis
* **Rule:** Property purchases **DO NOT** occur online (no checkout, escrow, or automatic ownership transfer).
* **Security:** Because of this offline reality, the Sales Mandate PII collected in Step 2 MUST remain highly confidential. It will be restricted entirely from the `presentListing` public API response and accessible only to the authenticated owner and system Admins via distinct Postgres RLS policies.

## 12. Migration Impact
* A new SQL migration will be required to `CREATE TABLE public.sales_mandates` with RLS restricted to the owner and `service_role`.
* A new SQL migration (or update) is required for `mutate_customer_listing` to remove the exact `jsonb_array_length(p_documents) <> 1` constraint, replacing it with a limit that supports multiple documents (e.g., `not between 1 and 10`).

## 13. Test Impact
The UI test suites (e.g., Playwright tests targeting the Listing dashboard) will break. The E2E tests currently expect to fill out a single form and press "List Property." They must be refactored to populate Step 1, assert the "Next" button, fill the Mandate fields in Step 2, and then submit.

## 14. Every Design Ambiguity/Blocker
* **"Registered title/document title" vs `title`:** Does this replace the public-facing display title (e.g., "4 Bedroom Duplex"), or is it a strict new legal field?
* **"Other information":** Should this be appended directly to the rich-text `description` field by the user, or does it mandate a discrete database column for structured separation?
* **Upload Limits:** The hardcoded exactly 1 document limit in both the Express Busboy layer and Postgres function is a strict blocker that must be removed.

## 15. Proposed Implementation Checkpoints
Implementation will be strictly staggered to ensure safety:
1. **Phase 1:** DB Migrations (Upload constraint changes, Mandate table creation).
2. **Phase 2:** Express API updates (Zod schemas, Busboy limits, listing model extensions).
3. **Phase 3:** Next.js UI updates (Wizard form, prefilling, signature).
*No code modifications will occur until explicit user approval is granted for the next phase.*

## 16. Exact Affected Files/Modules
* `apps/api/supabase/migrations/<new_timestamp>_sales_mandates.sql` (New)
* `apps/api/src/listings/model.ts` (API Types/Zod validation)
* `apps/api/src/listings/uploads.ts` (Busboy configuration)
* `apps/api/src/listings/service.ts` / `repository.ts` (API route logic)
* `apps/web/components/listings/listing-editor.tsx` (Dashboard UI Wizard)
* `apps/web/tests/listing-editor.browser.mjs` (UI Tests)

## 17. Risks
* **Data Loss on Form Drop-off:** Transitioning to a multi-step wizard means users might abandon at Step 2. If Step 1 does not automatically save a draft, they lose their Property Data. Conversely, if Step 1 saves immediately, we may accrue orphaned `UNLISTED` listings without mandates.
* **Test Fragility:** Heavily modifying the `ListingEditorScreen` into a wizard will require significant E2E test rewrites, risking temporary test suite instability.
