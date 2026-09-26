begin;

create table public.public_sell_assistance_requests (
  id uuid primary key,
  status text not null default 'PENDING' check (status in ('PENDING','ACCEPTED')),
  contact_name text not null check (char_length(contact_name) between 2 and 120 and contact_name = btrim(contact_name) and contact_name !~ '[[:cntrl:]]'),
  preferred_contact_method text not null check (preferred_contact_method in ('Phone','Email')),
  contact_phone text check (contact_phone is null or (char_length(contact_phone) between 7 and 25 and contact_phone = btrim(contact_phone) and contact_phone !~ '[[:cntrl:]]')),
  contact_email text check (contact_email is null or (char_length(contact_email) between 3 and 254 and contact_email = lower(btrim(contact_email)) and contact_email !~ '[[:cntrl:]]')),
  seller_type text check (seller_type is null or seller_type in ('Personal Property','Family Property','Developer')),
  property_location text not null check (char_length(property_location) between 1 and 300 and property_location = btrim(property_location) and property_location !~ '[[:cntrl:]]'),
  property_type text not null check (property_type in ('Residential','Commercial')),
  land_area numeric check (land_area is null or (land_area > 0 and land_area <= 1000000000)),
  parking_spaces smallint check (parking_spaces is null or parking_spaces between 0 and 100),
  facilities text[] not null default '{}' check (facilities <@ array['Swimming Pool','Balcony/Terrace','Children Play Area','Tennis Court','Basketball Court','Gym/Fitness Center','CCTV','Air Conditioning','Laundry','Garden','Wi-Fi','Housekeeping Services','Car Park','24Hrs Security']::text[]),
  units integer check (units is null or units between 1 and 100000),
  title_document text check (title_document is null or (char_length(title_document) between 1 and 200 and title_document = btrim(title_document) and title_document !~ '[[:cntrl:]]')),
  lien_status text check (lien_status is null or lien_status in ('Yes','No','Not Sure')),
  asking_price_minor bigint not null check (asking_price_minor between 1 and 999999999999999),
  minimum_down_payment_percent numeric(5,2) check (minimum_down_payment_percent is null or minimum_down_payment_percent between 0 and 100),
  sale_authorized boolean,
  likely_transferable_giftings text check (likely_transferable_giftings is null or (char_length(likely_transferable_giftings) between 1 and 1000 and likely_transferable_giftings = btrim(likely_transferable_giftings) and likely_transferable_giftings !~ '[[:cntrl:]]')),
  created_at timestamptz not null default clock_timestamp(),
  accepted_at timestamptz,
  constraint sell_assistance_contact_check check ((preferred_contact_method = 'Phone' and contact_phone is not null) or (preferred_contact_method = 'Email' and contact_email is not null)),
  constraint sell_assistance_status_check check ((status = 'PENDING' and accepted_at is null) or (status = 'ACCEPTED' and accepted_at is not null))
);

create table public.public_sell_assistance_assets (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.public_sell_assistance_requests(id) on delete cascade,
  asset_kind text not null check (asset_kind in ('PROPERTY_IMAGE','AUTHORIZATION_DOCUMENT')),
  public_id text not null unique check (char_length(public_id) between 1 and 300),
  mime_type text not null,
  size_bytes integer not null check (size_bytes > 0),
  sort_order smallint not null check (sort_order between 0 and 5),
  constraint sell_assistance_asset_type_check check (
    (asset_kind = 'PROPERTY_IMAGE' and mime_type in ('image/png','image/jpeg','image/webp') and size_bytes <= 5242880)
    or
    (asset_kind = 'AUTHORIZATION_DOCUMENT' and mime_type in ('application/pdf','image/png','image/jpeg') and size_bytes <= 10485760)
  ),
  unique (request_id, asset_kind, sort_order)
);

create unique index public_sell_assistance_authorization_idx on public.public_sell_assistance_assets (request_id) where asset_kind = 'AUTHORIZATION_DOCUMENT';
create index public_sell_assistance_pending_idx on public.public_sell_assistance_requests (created_at) where status = 'PENDING';
alter table public.public_sell_assistance_requests enable row level security;
alter table public.public_sell_assistance_assets enable row level security;
revoke all on public.public_sell_assistance_requests, public.public_sell_assistance_assets from public, anon, authenticated, service_role;
grant select, insert, update, delete on public.public_sell_assistance_requests, public.public_sell_assistance_assets to service_role;

commit;
