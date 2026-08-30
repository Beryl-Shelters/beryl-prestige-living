# Preview Supabase schema baseline runbook

## Purpose and safety boundary

This runbook describes the future, manually approved creation of an isolated
Preview Supabase project. It does not authorize a Production change, database
reset, migration push, migration repair, or data transfer.

The Preview API and Production API must use different Supabase projects. The
Preview project must have its own empty Auth user store, API credentials, JWT
and OTP secrets, encryption key, and test records.

Never place database URLs, passwords, Supabase keys, API keys, JWT secrets, or
provider credentials in this document, a baseline SQL file, terminal output,
or version control.

## Why a baseline is required

The tracked migration chain is not a complete database history. Its first file
alters `public.profiles`, which already had to exist. Later migrations also
depend on legacy objects without tracked `CREATE TABLE` statements.

Direct migration prerequisites missing from the tracked history are:

- `profiles`
- `properties`
- `property_images`
- `mandates`
- `inquiries`
- `referrals`

Other application tables that appear to predate migration tracking include:

- `audit_logs`
- `listings`
- `notifications`
- `property_viewings`
- `reports`
- `saved_properties`
- `support_tickets`
- `ticket_messages`
- `transactions`

A fresh project must therefore receive a reviewed current-state schema
baseline. Replaying the repository migrations against a blank project is not a
valid bootstrap procedure.

## Baseline scope

The baseline must contain schema definitions only:

- required extensions
- public types and enums
- tables, columns, generated values, sequences, and defaults
- primary, unique, check, and foreign-key constraints
- indexes
- functions and procedures, including security and search-path attributes
- triggers
- Row Level Security enablement and force settings
- RLS policies
- explicitly reviewed grants and revokes for application roles

The baseline must not contain table rows, seeds, credentials, provider secrets,
Vault values, or storage objects.

## Managed Supabase schemas

Do not export or restore Production `auth` or `storage` data. A newly created
Supabase project supplies its own managed `auth` and `storage` schemas.

In particular, never copy Production `auth.users`. Preview registrations must
create Preview Auth identities normally. Public foreign keys that reference
`auth.users(id)` are structurally valid because the managed table exists in the
new project even when it is empty. The application registration flow first
creates a user in the configured Preview Auth project, then inserts the related
`public.profiles` row.

The application currently stores media in Cloudinary rather than Supabase
Storage. No Production Storage objects or files are required for Preview.

## Current-state cutoff

The approved baseline represents the complete canonical schema after migration
version:

```text
202608290001
```

It therefore represents every existing migration file through
`202608290001_admin_referrer_payments.sql`.

Do not apply the baseline and then rerun the existing 21 migrations. Doing so
would duplicate or overwrite changes already represented by the baseline.
Only migrations created after `202608290001` may run normally after the
baseline and migration-history cutoff have been verified.

## Phase 1: read-only inventory and export

Perform this phase only after written approval and using an operator authorized
for read-only schema inspection.

1. Confirm the source project ref is the canonical Production project. Record
   the ref in the private change ticket, not in repository files.
2. Record the 21 migration filenames through the cutoff and their SHA-256
   hashes in the change ticket. This is the immutable history manifest that the
   baseline represents.
3. Use a short-lived, securely supplied database connection. Do not paste it
   into source files, command history, chat, screenshots, or logs.
4. Generate a schema-only dump of `public`. One approved CLI shape is shown
   below as a template; do not execute it until the change is authorized:

   ```text
   supabase db dump --db-url <READ_ONLY_PRODUCTION_DATABASE_URL> --schema public --file <SECURE_TEMP_PATH>/preview-schema-through-202608290001.sql
   ```

   The operation must remain schema-only. Never add `--data-only`, `--use-copy`,
   Auth export, or Storage export options.
5. Separately inventory required extensions and role privileges because managed
   schemas, extension-owned objects, role ownership, or grants may be excluded
   or unsuitable for direct restoration.
6. Remove source ownership and unsafe role-specific statements. Curate only the
   grants/revokes required by `anon`, `authenticated`, and `service_role`.
7. Place a reviewed baseline artifact in a dedicated baseline location, not in
   the normal migrations directory, until the migration-history plan below is
   approved.

No Production rows are required at any point.

## Phase 2: mandatory baseline review

Two reviewers must inspect the complete SQL before it can be applied. Search
case-insensitively for all of the following:

- top-level `INSERT INTO`
- `COPY`
- email-like values
- phone-number-like values
- OTP values or hashes
- account numbers, ciphertext, IVs, or authentication tags
- payment amounts or receipt identifiers
- API keys, bearer tokens, JWTs, or signing secrets
- Cloudinary cloud names, keys, secrets, URLs, or public IDs
- Termii credentials or sender configuration
- Resend credentials or sender configuration
- Vault objects or secret values

Function bodies legitimately contain SQL such as `INSERT INTO`, and schemas
legitimately contain column names such as `email`, `phone`, `otp`, `account`,
and `payment`. Every match must be classified, but only schema definitions and
function logic may remain. Top-level data inserts, `COPY` data blocks, literal
customer/provider values, and secrets are forbidden.

Also verify that the artifact includes:

- all legacy tables listed above
- the `profiles.id` relationship required by the Auth flow
- Marketplace, lead-management, Admin, and referral functions
- RLS enablement and every required policy
- expected indexes and constraints
- security-definer functions with explicit safe `search_path` values
- only necessary grants

Compute and record the final baseline SHA-256 hash in the private change ticket.

## Phase 3: create and bootstrap the Preview project

This phase is manual and must not begin during preparation of this runbook.

1. Create a new Supabase project clearly named for Preview.
2. Do not enable any option that imports or clones Production data, Auth users,
   or Storage objects.
3. Obtain the new Preview project ref and its Preview-only `SUPABASE_URL`, anon
   key, and service-role key. Store keys only in the approved secret manager.
4. Apply the reviewed schema baseline once to the empty Preview project using a
   single controlled change window.
5. Verify tables, columns, types, constraints, indexes, functions, triggers,
   grants, RLS enablement, and policies against the signed inventory.
6. Verify `auth.users` and all public application tables contain no Production
   rows.
7. Configure the Preview Render API with the variables listed below.
8. Deploy Preview API and confirm the startup environment guard accepts the new
   Preview ref.
9. Register a synthetic Preview customer through the normal Preview signup and
   verification flow.
10. Bootstrap a Preview super-admin through the approved project mechanism with
    Preview-only credentials.
11. Complete the isolation acceptance tests in this runbook.
12. Leave Production configuration, schema, Auth users, and records untouched.

## Migration-history alignment

Do not run `db push` or any normal migration deployment immediately after the
baseline. An empty migration-history table would cause the tooling to treat all
21 historical files as pending even though their effects are already present.

After the schema comparison passes, an authorized database operator must use an
approved Supabase migration-history registration procedure to record the 21
versions through `202608290001` as represented by the reviewed baseline. This
history-only operation requires a separate approval and must be checked against
the filename/hash manifest before execution. Do not execute migration repair as
part of creating or reviewing this runbook.

After alignment:

1. confirm no version through the cutoff is reported as pending;
2. confirm the baseline hash and history manifest are attached to the change
   ticket;
3. apply only migrations with versions later than `202608290001`;
4. test future migrations first against an empty disposable/local database
   bootstrapped from the same baseline.

## Preview Render configuration

After the new Preview project exists, configure these server-only values:

```text
DEPLOYMENT_ENVIRONMENT=preview
EXPECTED_SUPABASE_PROJECT_REF=<NEW_PREVIEW_PROJECT_REF>
SUPABASE_URL=https://<NEW_PREVIEW_PROJECT_REF>.supabase.co
SUPABASE_ANON_KEY=<NEW_PREVIEW_ANON_KEY>
SUPABASE_SERVICE_ROLE_KEY=<NEW_PREVIEW_SERVICE_ROLE_KEY>
```

Generate fresh Preview-only values for all of the following. Never reuse the
Production values:

```text
CUSTOMER_ACCESS_TOKEN_SECRET
CUSTOMER_REFRESH_TOKEN_SECRET
ADMIN_ACCESS_TOKEN_SECRET
ADMIN_REFRESH_TOKEN_SECRET
OTP_HASH_SECRET
ADMIN_INVITATION_TOKEN_SECRET
REFERRAL_PAYOUT_ENCRYPTION_KEY
```

Keep Preview URLs, CORS origins, email/OTP provider settings, and
`MIXPANEL_ENVIRONMENT=test` scoped to Preview. The Web/Admin/Expo Preview clients
must continue to call `https://dev-api.berylshelter.com/api/v1`.

Production must retain its own values and add only the matching guard identity:

```text
DEPLOYMENT_ENVIRONMENT=production
EXPECTED_SUPABASE_PROJECT_REF=<PRODUCTION_PROJECT_REF>
```

Do not change Production `SUPABASE_URL` or keys while introducing the guard.

## Cloudinary isolation

Cloudinary is outside Supabase project isolation. Before Preview media testing,
choose one of these approaches:

1. use a separate Preview Cloudinary account/cloud and Preview-only credentials;
2. add an explicit, enforced Preview folder/environment namespace before sharing
   a Cloudinary account.

Do not copy Production media and do not implement Cloudinary changes as part of
the Supabase baseline operation.

## Bug #1 acceptance test

1. On Preview, register
   `preview-isolation-test-<timestamp>@example.com` with a unique test password
   and complete verification.
2. Confirm login succeeds through the Preview API.
3. Submit the same credentials to the Production API. Production must return an
   invalid-credentials/user-not-found response without revealing account state.
4. Confirm the Preview customer does not appear in Production Auth or public
   application tables.
5. If an authorized Production test identity is available, confirm it does not
   exist and cannot log in through Preview.
6. Send the Preview customer access token to an authenticated Production API
   endpoint. Expected result: HTTP `401`.
7. Send the Production customer access token to Preview. Expected result: HTTP
   `401`.
8. Repeat the cross-environment check with refresh tokens. Both APIs must reject
   the foreign token.
9. Confirm Preview signup/login still succeeds and Production behavior is
   otherwise unchanged.

No account, session, OTP, Admin identity, referral payout data, or media object
should automatically appear in both environments.
