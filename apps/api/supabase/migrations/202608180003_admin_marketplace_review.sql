begin;

alter table public.properties
  add column if not exists marketplace_reviewed_at timestamptz,
  add column if not exists marketplace_published_at timestamptz,
  add column if not exists marketplace_rejected_at timestamptz,
  add column if not exists marketplace_reviewed_by_admin_id uuid references public.admins(id) on delete set null;

create table if not exists public.marketplace_property_review_history (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  previous_status text not null,
  new_status text not null check (new_status in ('LIVE','REJECTED')),
  action text not null check (action in ('APPROVED','REJECTED')),
  reason text,
  reviewed_by_admin_id uuid not null references public.admins(id),
  created_at timestamptz not null default now()
);

create index if not exists marketplace_property_review_history_property_idx
  on public.marketplace_property_review_history(property_id, created_at desc);

alter table public.properties enable row level security;
alter table public.marketplace_property_review_history enable row level security;

create or replace function public.review_marketplace_property(
  p_property_id uuid,
  p_admin_id uuid,
  p_action text,
  p_reason text default null,
  p_now timestamptz default now()
)
returns table(
  outcome text,
  property_id uuid,
  reference_id text,
  marketplace_status text,
  reviewed_at timestamptz,
  published_at timestamptz,
  rejected_at timestamptz,
  rejection_reason text,
  missing_fields text[]
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_property public.properties%rowtype;
  v_mandate public.mandates%rowtype;
  v_photo_count integer := 0;
  v_cover_count integer := 0;
  v_distinct_orders integer := 0;
  v_min_order integer;
  v_max_order integer;
  v_missing_fields text[] := array[]::text[];
  v_reason text := nullif(btrim(p_reason), '');
begin
  select * into v_property
  from public.properties p
  where p.id = p_property_id
  for update;

  if not found then
    return query select 'NOT_FOUND'::text, null::uuid, null::text, null::text, null::timestamptz, null::timestamptz, null::timestamptz, null::text, array[]::text[];
    return;
  end if;

  if v_property.marketplace_status <> 'IN_REVIEW' then
    return query select (case when v_property.marketplace_status in ('LIVE','REJECTED') then 'ALREADY_REVIEWED' else 'NOT_IN_REVIEW' end)::text, v_property.id, v_property.property_code::text, v_property.marketplace_status, v_property.marketplace_reviewed_at, v_property.marketplace_published_at, v_property.marketplace_rejected_at, v_property.rejection_reason, array[]::text[];
    return;
  end if;

  if p_action is null or p_action not in ('APPROVE','REJECT') then
    return query select 'INVALID_ACTION'::text, v_property.id, v_property.property_code::text, v_property.marketplace_status, null::timestamptz, null::timestamptz, null::timestamptz, null::text, array[]::text[];
    return;
  end if;

  if p_action = 'REJECT' and (v_reason is null or length(v_reason) < 3 or length(v_reason) > 1000) then
    return query select 'INVALID_REASON'::text, v_property.id, v_property.property_code::text, v_property.marketplace_status, null::timestamptz, null::timestamptz, null::timestamptz, null::text, array[]::text[];
    return;
  end if;

  if p_action = 'APPROVE' then
    if nullif(btrim(v_property.title), '') is null then v_missing_fields := array_append(v_missing_fields, 'title'); end if;
    if nullif(btrim(v_property.description), '') is null then v_missing_fields := array_append(v_missing_fields, 'description'); end if;
    if nullif(btrim(v_property.category::text), '') is null then
  v_missing_fields := array_append(v_missing_fields, 'propertyCategory');
end if;

if nullif(btrim(v_property.property_type::text), '') is null then
  v_missing_fields := array_append(v_missing_fields, 'propertyType');
end if;
    if nullif(btrim(v_property.ownership_type), '') is null then v_missing_fields := array_append(v_missing_fields, 'ownershipType'); end if;
    if nullif(btrim(v_property.public_location), '') is null then v_missing_fields := array_append(v_missing_fields, 'publicLocation'); end if;
    if nullif(btrim(v_property.full_address), '') is null then v_missing_fields := array_append(v_missing_fields, 'fullAddress'); end if;
    if v_property.price is null then v_missing_fields := array_append(v_missing_fields, 'askingPrice'); end if;
    if nullif(btrim(v_property.property_condition), '') is null then v_missing_fields := array_append(v_missing_fields, 'condition'); end if;

    select count(*)::integer, count(*) filter (where i.is_cover)::integer,
           count(distinct i.sort_order)::integer, min(i.sort_order), max(i.sort_order)
    into v_photo_count, v_cover_count, v_distinct_orders, v_min_order, v_max_order
    from public.property_images i where i.property_id = p_property_id;
    if v_photo_count < 1 or v_photo_count > 10 then v_missing_fields := array_append(v_missing_fields, 'images'); end if;
    if v_cover_count <> 1 then v_missing_fields := array_append(v_missing_fields, 'coverImage'); end if;
    if v_photo_count > 0 and (v_distinct_orders <> v_photo_count or v_min_order <> 0 or v_max_order <> v_photo_count - 1) then v_missing_fields := array_append(v_missing_fields, 'imageOrder'); end if;

    select * into v_mandate from public.mandates m
    where m.property_id = p_property_id and m.marketplace_mandate_type is not null limit 1;
    if not found then
      v_missing_fields := array_append(v_missing_fields, 'mandate');
    else
      if v_mandate.marketplace_mandate_type not in ('EXCLUSIVE','OPEN') then v_missing_fields := array_append(v_missing_fields, 'mandateType'); end if;
      if nullif(btrim(v_mandate.full_name), '') is null then v_missing_fields := array_append(v_missing_fields, 'sellerFullName'); end if;
      if not v_mandate.ownership_confirmed then v_missing_fields := array_append(v_missing_fields, 'ownershipConfirmed'); end if;
      if not v_mandate.mandate_accepted then v_missing_fields := array_append(v_missing_fields, 'mandateAccepted'); end if;
      if v_mandate.accepted_at is null then v_missing_fields := array_append(v_missing_fields, 'acceptedAt'); end if;
    end if;

    if cardinality(v_missing_fields) > 0 then
      return query select 'INCOMPLETE'::text, v_property.id, v_property.property_code::text, v_property.marketplace_status, null::timestamptz, null::timestamptz, null::timestamptz, null::text, v_missing_fields;
      return;
    end if;

    update public.properties p set
      marketplace_status = 'LIVE', marketplace_reviewed_at = p_now,
      marketplace_published_at = p_now, marketplace_rejected_at = null,
      marketplace_reviewed_by_admin_id = p_admin_id, rejection_reason = null,
      status = 'approved', is_published = true, approved_at = p_now, updated_at = p_now
    where p.id = p_property_id returning p.* into v_property;

    insert into public.marketplace_property_review_history(property_id,previous_status,new_status,action,reason,reviewed_by_admin_id,created_at)
    values(v_property.id,'IN_REVIEW','LIVE','APPROVED',null,p_admin_id,p_now);
  else
    update public.properties p set
      marketplace_status = 'REJECTED', marketplace_reviewed_at = p_now,
      marketplace_published_at = null, marketplace_rejected_at = p_now,
      marketplace_reviewed_by_admin_id = p_admin_id, rejection_reason = v_reason,
      status = 'rejected', is_published = false, updated_at = p_now
    where p.id = p_property_id returning p.* into v_property;

    insert into public.marketplace_property_review_history(property_id,previous_status,new_status,action,reason,reviewed_by_admin_id,created_at)
    values(v_property.id,'IN_REVIEW','REJECTED','REJECTED',v_reason,p_admin_id,p_now);
  end if;

  return query select (case when p_action='APPROVE' then 'APPROVED' else 'REJECTED' end)::text,
    v_property.id, v_property.property_code::text, v_property.marketplace_status,
    v_property.marketplace_reviewed_at, v_property.marketplace_published_at,
    v_property.marketplace_rejected_at, v_property.rejection_reason, array[]::text[];
end;
$$;

revoke all on function public.review_marketplace_property(uuid,uuid,text,text,timestamptz) from public, anon, authenticated;
grant execute on function public.review_marketplace_property(uuid,uuid,text,text,timestamptz) to service_role;

commit;
