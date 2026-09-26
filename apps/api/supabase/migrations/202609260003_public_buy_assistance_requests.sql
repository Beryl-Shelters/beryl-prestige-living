begin;

create table public.public_buy_assistance_requests (
  id uuid primary key,
  status text not null default 'PENDING' check (status in ('PENDING','ACCEPTED')),
  contact_name text not null check (char_length(contact_name) between 2 and 120 and contact_name = btrim(contact_name) and contact_name !~ '[[:cntrl:]]'),
  preferred_contact_method text not null check (preferred_contact_method in ('Phone','Email')),
  contact_phone text check (contact_phone is null or (char_length(contact_phone) between 7 and 25 and contact_phone = btrim(contact_phone) and contact_phone !~ '[[:cntrl:]]')),
  contact_email text check (contact_email is null or (char_length(contact_email) between 3 and 254 and contact_email = lower(btrim(contact_email)) and contact_email !~ '[[:cntrl:]]')),
  property_type text not null check (property_type in ('Residential','Commercial')),
  property_subtype text check (property_subtype is null or property_subtype in ('Bungalow','Semi-Detached House','Block of flats','Terraced Duplexes','Terraced Bungalows','Semi-Detached Bungalows','Detached Bungalows','Detached Duplexes')),
  bedrooms text check (bedrooms is null or bedrooms in ('1','2','3','4','5','6','7+')),
  bathrooms text check (bathrooms is null or bathrooms in ('1','2','3','4','5','6','7+')),
  locality text check (locality is null or (char_length(locality) between 1 and 120 and locality = btrim(locality) and locality !~ '[[:cntrl:]]')),
  state text not null check (state in ('Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno','Cross River','Delta','Ebonyi','Edo','Ekiti','Enugu','Gombe','Imo','Jigawa','Kaduna','Kano','Katsina','Kebbi','Kogi','Kwara','Lagos','Nasarawa','Niger','Ogun','Ondo','Osun','Oyo','Plateau','Rivers','Sokoto','Taraba','Yobe','Zamfara','Federal Capital Territory (FCT)')),
  city text check (city is null or (char_length(city) between 1 and 100 and city = btrim(city) and city !~ '[[:cntrl:]]')),
  facilities text[] not null default '{}' check (facilities <@ array['Swimming Pool','Balcony/Terrace','Children Play Area','Tennis Court','Basketball Court','Gym/Fitness Center','CCTV','Air Conditioning','Laundry','Garden','Wi-Fi','Housekeeping Services','Car Park','24Hrs Security']::text[]),
  budget_minor bigint not null check (budget_minor between 1 and 999999999999999),
  payment_intent text check (payment_intent is null or payment_intent in ('Outright Cash Purchase','Mortgage')),
  timing text check (timing is null or timing in ('Immediately','Within 1 Month','Within 3 Months','Within 6 Months','Within 12 Months','Flexible')),
  likely_transferable_giftings text check (likely_transferable_giftings is null or (char_length(likely_transferable_giftings) between 1 and 1000 and likely_transferable_giftings = btrim(likely_transferable_giftings) and likely_transferable_giftings !~ '[[:cntrl:]]')),
  created_at timestamptz not null default clock_timestamp(), accepted_at timestamptz,
  constraint buy_assistance_contact_check check ((preferred_contact_method='Phone' and contact_phone is not null) or (preferred_contact_method='Email' and contact_email is not null)),
  constraint buy_assistance_property_check check ((property_type='Residential' and property_subtype is not null) or (property_type='Commercial' and property_subtype is null and bedrooms is null and bathrooms is null)),
  constraint buy_assistance_status_check check ((status='PENDING' and accepted_at is null) or (status='ACCEPTED' and accepted_at is not null))
);

create table public.public_buy_assistance_assets (
  id uuid primary key default gen_random_uuid(), request_id uuid not null unique references public.public_buy_assistance_requests(id) on delete cascade,
  public_id text not null unique check (char_length(public_id) between 1 and 300), mime_type text not null check (mime_type='application/pdf'),
  size_bytes integer not null check (size_bytes between 1 and 10485760)
);
create index public_buy_assistance_pending_idx on public.public_buy_assistance_requests(created_at) where status='PENDING';
alter table public.public_buy_assistance_requests enable row level security;
alter table public.public_buy_assistance_assets enable row level security;
revoke all on public.public_buy_assistance_requests, public.public_buy_assistance_assets from public, anon, authenticated, service_role;
grant select, insert, update, delete on public.public_buy_assistance_requests, public.public_buy_assistance_assets to service_role;

commit;
