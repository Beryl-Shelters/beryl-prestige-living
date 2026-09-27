begin;

-- Customer-visible review feedback is real moderation data. Keep it nullable
-- for legacy rejected rows while preventing feedback from appearing on any
-- non-rejected lifecycle state.
alter table public.customer_listings
  add column rejection_reason text,
  add column rejected_at timestamptz,
  add constraint customer_listings_rejection_reason_check check (
    rejection_reason is null or (
      char_length(rejection_reason) between 1 and 2000
      and rejection_reason = btrim(rejection_reason)
      and replace(replace(rejection_reason, E'\n', ''), E'\r', '') !~ '[[:cntrl:]]'
    )
  ),
  add constraint customer_listings_rejection_state_check check (
    listing_status = 'REJECTED' or (rejection_reason is null and rejected_at is null)
  );

create function public.enforce_customer_listing_lifecycle()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if new.listing_status is distinct from old.listing_status and not (
    (old.listing_status = 'UNLISTED' and new.listing_status = 'PENDING')
    or (old.listing_status = 'REJECTED' and new.listing_status = 'PENDING')
    or (old.listing_status = 'PENDING' and new.listing_status in ('LISTED', 'REJECTED'))
    or (old.listing_status = 'LISTED' and new.listing_status = 'UNLISTED')
  ) then
    raise exception using errcode = '23514', message = 'Invalid listing status transition';
  end if;

  if new.listing_status <> 'REJECTED' then
    new.rejection_reason := null;
    new.rejected_at := null;
  end if;
  return new;
end $$;

create trigger customer_listing_lifecycle
before update on public.customer_listings
for each row execute function public.enforce_customer_listing_lifecycle();

-- Unlisting is deliberately separate from deletion and is valid only for a
-- currently public LISTED property. The existing version trigger supplies the
-- optimistic-lock increment and updated_at value.
create function public.unlist_customer_listing(p_owner uuid, p_id uuid, p_version integer)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_listing public.customer_listings%rowtype;
begin
  select * into v_listing
  from public.customer_listings
  where id = p_id and user_id = p_owner
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Listing not found';
  end if;
  if p_version is distinct from v_listing.version then
    raise exception using errcode = '40001', message = 'Listing changed';
  end if;
  if v_listing.listing_status <> 'LISTED' then
    raise exception using errcode = '23514', message = 'Only listed properties can be unlisted';
  end if;

  update public.customer_listings
  set listing_status = 'UNLISTED', requested_at = null
  where id = p_id;
  return p_id;
end $$;

revoke all on function public.unlist_customer_listing(uuid, uuid, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.unlist_customer_listing(uuid, uuid, integer)
  to service_role;

commit;
