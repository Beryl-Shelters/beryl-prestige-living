begin;

create table public.public_property_viewings (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.customer_listings(id) on delete restrict,
  status text not null default 'NEW' check (status = 'NEW'),
  first_name text not null check (char_length(first_name) between 2 and 80 and first_name = btrim(first_name) and first_name !~ '[[:cntrl:]]'),
  last_name text not null check (char_length(last_name) between 2 and 80 and last_name = btrim(last_name) and last_name !~ '[[:cntrl:]]'),
  email text not null check (char_length(email) between 3 and 254 and email = lower(btrim(email)) and email !~ '[[:cntrl:]]'),
  phone text not null check (char_length(phone) between 7 and 25 and phone = btrim(phone) and phone !~ '[[:cntrl:]]'),
  preferred_date date,
  preferred_time time without time zone,
  flexible_dates boolean not null default false,
  created_at timestamptz not null default clock_timestamp(),
  constraint property_viewing_schedule_check check (flexible_dates or (preferred_date is not null and preferred_time is not null))
);

create index public_property_viewings_created_idx on public.public_property_viewings (created_at desc);
create index public_property_viewings_listing_idx on public.public_property_viewings (listing_id, created_at desc);
alter table public.public_property_viewings enable row level security;
revoke all on public.public_property_viewings from public, anon, authenticated, service_role;

create function public.record_public_property_viewing(
  p_property_code text, p_first_name text, p_last_name text, p_email text, p_phone text,
  p_preferred_date date, p_preferred_time time without time zone, p_flexible_dates boolean
) returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_listing_id uuid; v_id uuid;
begin
  select id into v_listing_id from public.customer_listings
    where listing_code = p_property_code and listing_status = 'LISTED' for share;
  if not found then return null; end if;
  insert into public.public_property_viewings(listing_id,first_name,last_name,email,phone,preferred_date,preferred_time,flexible_dates)
    values(v_listing_id,p_first_name,p_last_name,p_email,p_phone,p_preferred_date,p_preferred_time,p_flexible_dates)
    returning id into v_id;
  return v_id;
end $$;

revoke all on function public.record_public_property_viewing(text,text,text,text,text,date,time without time zone,boolean) from public, anon, authenticated;
grant execute on function public.record_public_property_viewing(text,text,text,text,text,date,time without time zone,boolean) to service_role;

commit;
