begin;

create table public.public_real_estate_inquiries (
  id uuid primary key default gen_random_uuid(),
  inquiry_type text not null check (inquiry_type in ('Property Inquiry','Buying a Property','Selling/Listing a Property','Property Viewing','General Inquiry','Other')),
  full_name text not null check (char_length(full_name) between 2 and 120 and full_name = btrim(full_name) and full_name !~ '[[:cntrl:]]'),
  phone text not null check (char_length(phone) between 7 and 25 and phone = btrim(phone) and phone !~ '[[:cntrl:]]'),
  email text not null check (char_length(email) between 3 and 254 and email = lower(btrim(email)) and email !~ '[[:cntrl:]]'),
  message text not null check (char_length(message) between 2 and 3000 and message = btrim(message) and replace(replace(message,E'\n',''),E'\r','') !~ '[[:cntrl:]]'),
  source_page text not null check (source_page in ('home','about','referrals','buy','sell','analytics','careers','support','saved-properties','compare-properties','mortgage-calculator','other')),
  status text not null default 'NEW' check (status = 'NEW'),
  created_at timestamptz not null default clock_timestamp()
);

create index public_real_estate_inquiries_created_idx on public.public_real_estate_inquiries (created_at desc);
alter table public.public_real_estate_inquiries enable row level security;
revoke all on public.public_real_estate_inquiries from public, anon, authenticated, service_role;
grant insert on public.public_real_estate_inquiries to service_role;

commit;
