-- Additive marketplace-draft fields on the canonical properties table. Apply manually.
begin;
alter table public.properties
  add column if not exists marketplace_status text not null default 'DRAFT',
  add column if not exists marketplace_current_step text not null default 'PROPERTY_INFORMATION',
  add column if not exists ownership_type text,
  add column if not exists public_location text,
  add column if not exists full_address text,
  add column if not exists negotiable boolean not null default false,
  add column if not exists initial_deposit_type text,
  add column if not exists initial_deposit_value numeric,
  add column if not exists property_condition text,
  add column if not exists furnishing text,
  add column if not exists number_of_floors integer,
  add column if not exists parking_capacity integer;
create index if not exists properties_marketplace_owner_status_idx on public.properties(owner_id, marketplace_status, updated_at desc);
commit;
