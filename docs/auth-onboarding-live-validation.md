# Live Supabase Validation — 2 August 2026

Read-only checks were performed against the configured Supabase project using
the service-role client and repeated on 2 August 2026. No schema or data
mutations were attempted.

## Completed checks

- PostgREST OpenAPI returned HTTP 200 and exposed 20 public tables:
  `analytics_property_summary`, `analytics_referral_summary`,
  `analytics_sales_summary`, `audit_logs`, `inquiries`, `listings`, `mandates`,
  `notifications`, `profiles`, `properties`, `property_comparison_items`,
  `property_comparisons`, `property_images`, `property_viewings`, `referrals`,
  `reports`, `saved_properties`, `support_tickets`, `ticket_messages`, and
  `transactions`.
- `profiles` exists with UUID primary key `id` and a self-referencing
  `referred_by -> profiles.id` foreign key exposed by PostgREST metadata.
- Required live `profiles` columns are `id`, `first_name`, `last_name`, `email`,
  `role`, `profile_type`, `verification_status`, `is_active`, `created_at`, and
  `updated_at`.
- Live legacy enums exposed by `profiles` are:
  - `user_role`: `super_admin`, `admin`, `support_agent`, `investor`,
    `property_developer`, `landlord`, `registered_agent`, `freelance_agent`.
  - `profile_type`: `personal`, `business`.
  - `verification_status`: `unverified`, `pending`, `verified`, `rejected`.
- The new `user_personas`, `buyer_profiles`, `seller_profiles`,
  `customer_records`, `otp_challenges`, `customer_sessions`, `admins`,
  `admin_sessions`, and `admin_invitations` tables are not present in the live
  exposed schema.
- Two `profiles` rows and two Supabase Auth users were checked.
- Duplicate normalized profile email groups: 0.
- Duplicate normalized profile phone groups using the API's Nigerian/E.164
  normalization algorithm: 0.
- Duplicate normalized Supabase Auth email groups: 0.
- Duplicate exact Supabase Auth phone groups: 0.

## Metadata not accessible through the configured connection

PostgREST rejected both `information_schema` and `supabase_migrations` schema
access with `PGRST106`. Consequently, existing complete constraint definitions,
indexes, RLS policies, and migration history were not validated live.

Run [auth_onboarding_live_checks.sql](../apps/api/supabase/validation/auth_onboarding_live_checks.sql)
in the Supabase SQL editor before applying the migrations. Then apply migrations
`202607280001` and `202607280002` in order and rerun that validation file.
