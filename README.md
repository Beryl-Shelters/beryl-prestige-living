# Beryl Shelter Nigeria Limited

Clean rebuild based on the client's approved existing Beryl Shelter website and workflows.

Previous implementation archived separately.

## Workspace

This repository contains the clean V2 foundation:

- `apps/web` — public Next.js application
- `apps/api` — Express API
- `apps/admin` — minimal Next.js admin placeholder
- `apps/mobile` — documented placeholder; Expo bootstrap is deferred
- `packages/config` — reserved for generic shared configuration
- `packages/types` — reserved for generic shared types

Install dependencies with `npm install`, then use the root scripts in
`package.json` to develop, type-check, lint, and build each bootstrapped app.

No legacy product features or domain models are part of this foundation.

## Human-facing codes

Use a three-letter prefix, a hyphen and six uppercase letters/digits (10
characters total): `RES-D5K7Y2` for residential listings, `COM-H8Q4Z6` for
commercial listings, and `REF-N4K7P2` for future referral codes. Exclude I/O/0/1
to avoid transcription errors. Generate these on the server/database using
`public.generate_display_code(prefix)`, with a database UNIQUE constraint and
bounded collision retries for every consuming feature. Never truncate UUIDs
in the UI or shorten authentication tokens, sessions, OTPs or private media IDs.

`202609100001_short_display_codes.sql` changes future listing inserts only;
existing codes and shared URLs remain unchanged. A property's prefix reflects
its type when created and remains stable if its type is edited later. Apply this
migration after the customer-listings migration through the approved database
release process; adding it to this repository does not apply it to Supabase.
The referral-code convention and generator are ready for future use; this does
not introduce a referral program or replace the current share-link placeholder.

## Property document uploads

Each upload has one title, document type, description and file (PDF/JPG/PNG,
up to 10 MB). Additional documents can be uploaded separately. The multipart
contract uses a `data` JSON field with singular `description`, plus one
`document` file field. Existing stored documents and historical batches remain
intact. Release `202609100002_single_document_upload.sql` alongside the updated
API and Web form through the approved migration process; the migration is not
automatically applied by the application.
