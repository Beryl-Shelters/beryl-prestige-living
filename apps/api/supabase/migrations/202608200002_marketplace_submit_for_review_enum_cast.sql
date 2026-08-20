begin;

-- The canonical properties.category column is the legacy property_category
-- enum. Cast enum-backed values before applying text functions so a complete
-- draft can reach the atomic DRAFT -> IN_REVIEW transition.
create or replace function public.submit_marketplace_property_for_review(
  p_property_id uuid,
  p_owner_id uuid
)
returns table(
  outcome text,
  property_id uuid,
  reference_id text,
  marketplace_status text,
  submitted_at timestamptz,
  missing_sections text[],
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
  v_missing_sections text[] := array[]::text[];
  v_missing_fields text[] := array[]::text[];
begin
  select * into v_property
  from public.properties p
  where p.id = p_property_id and p.owner_id = p_owner_id
  for update;

  if not found then
    return query select 'NOT_FOUND'::text, null::uuid, null::text, null::text, null::timestamptz, array[]::text[], array[]::text[];
    return;
  end if;

  if v_property.marketplace_status = 'IN_REVIEW' then
    return query select 'ALREADY_SUBMITTED'::text, v_property.id, v_property.property_code::text, v_property.marketplace_status, v_property.marketplace_submitted_at, array[]::text[], array[]::text[];
    return;
  end if;

  if v_property.marketplace_status <> 'DRAFT' then
    return query select 'NOT_EDITABLE'::text, v_property.id, v_property.property_code::text, v_property.marketplace_status, v_property.marketplace_submitted_at, array[]::text[], array[]::text[];
    return;
  end if;

  if nullif(btrim(v_property.title), '') is null then v_missing_fields := array_append(v_missing_fields, 'title'); end if;
  if nullif(btrim(v_property.description), '') is null then v_missing_fields := array_append(v_missing_fields, 'description'); end if;
  if nullif(btrim(v_property.category::text), '') is null then v_missing_fields := array_append(v_missing_fields, 'propertyCategory'); end if;
  if nullif(btrim(v_property.property_type::text), '') is null then v_missing_fields := array_append(v_missing_fields, 'propertyType'); end if;
  if nullif(btrim(v_property.ownership_type), '') is null then v_missing_fields := array_append(v_missing_fields, 'ownershipType'); end if;
  if nullif(btrim(v_property.public_location), '') is null then v_missing_fields := array_append(v_missing_fields, 'publicLocation'); end if;
  if nullif(btrim(v_property.full_address), '') is null then v_missing_fields := array_append(v_missing_fields, 'fullAddress'); end if;
  if v_property.price is null then v_missing_fields := array_append(v_missing_fields, 'askingPrice'); end if;
  if nullif(btrim(v_property.property_condition), '') is null then v_missing_fields := array_append(v_missing_fields, 'condition'); end if;
  if cardinality(v_missing_fields) > 0 then v_missing_sections := array_append(v_missing_sections, 'PROPERTY_INFORMATION'); end if;

  select count(*)::integer,
         count(*) filter (where i.is_cover)::integer,
         count(distinct i.sort_order)::integer,
         min(i.sort_order),
         max(i.sort_order)
  into v_photo_count, v_cover_count, v_distinct_orders, v_min_order, v_max_order
  from public.property_images i
  where i.property_id = p_property_id;

  if v_photo_count < 1 or v_photo_count > 10 then v_missing_fields := array_append(v_missing_fields, 'images'); end if;
  if v_cover_count <> 1 then v_missing_fields := array_append(v_missing_fields, 'coverImage'); end if;
  if v_photo_count > 0 and (v_distinct_orders <> v_photo_count or v_min_order <> 0 or v_max_order <> v_photo_count - 1) then v_missing_fields := array_append(v_missing_fields, 'imageOrder'); end if;
  if v_photo_count < 1 or v_photo_count > 10 or v_cover_count <> 1 or (v_photo_count > 0 and (v_distinct_orders <> v_photo_count or v_min_order <> 0 or v_max_order <> v_photo_count - 1)) then v_missing_sections := array_append(v_missing_sections, 'PHOTOS'); end if;

  select * into v_mandate
  from public.mandates m
  where m.property_id = p_property_id and m.marketplace_mandate_type is not null
  limit 1;

  if not found then
    v_missing_sections := array_append(v_missing_sections, 'SALES_MANDATE');
    v_missing_fields := array_append(v_missing_fields, 'mandate');
  else
    if v_mandate.marketplace_mandate_type not in ('EXCLUSIVE', 'OPEN') then v_missing_fields := array_append(v_missing_fields, 'mandateType'); end if;
    if nullif(btrim(v_mandate.full_name), '') is null then v_missing_fields := array_append(v_missing_fields, 'sellerFullName'); end if;
    if not v_mandate.ownership_confirmed then v_missing_fields := array_append(v_missing_fields, 'ownershipConfirmed'); end if;
    if not v_mandate.mandate_accepted then v_missing_fields := array_append(v_missing_fields, 'mandateAccepted'); end if;
    if v_mandate.accepted_at is null then v_missing_fields := array_append(v_missing_fields, 'acceptedAt'); end if;
    if not (v_mandate.marketplace_mandate_type in ('EXCLUSIVE', 'OPEN') and nullif(btrim(v_mandate.full_name), '') is not null and v_mandate.ownership_confirmed and v_mandate.mandate_accepted and v_mandate.accepted_at is not null) then v_missing_sections := array_append(v_missing_sections, 'SALES_MANDATE'); end if;
  end if;

  if cardinality(v_missing_sections) > 0 then
    return query select 'INCOMPLETE'::text, v_property.id, v_property.property_code::text, v_property.marketplace_status, v_property.marketplace_submitted_at, v_missing_sections, v_missing_fields;
    return;
  end if;

  update public.properties p
  set marketplace_status = 'IN_REVIEW',
      marketplace_current_step = 'REVIEW',
      marketplace_submitted_at = now(),
      updated_at = now()
  where p.id = p_property_id
  returning p.* into v_property;

  return query select 'SUBMITTED'::text, v_property.id, v_property.property_code::text, v_property.marketplace_status, v_property.marketplace_submitted_at, array[]::text[], array[]::text[];
end;
$$;

revoke all on function public.submit_marketplace_property_for_review(uuid, uuid) from public;
revoke all on function public.submit_marketplace_property_for_review(uuid, uuid) from anon;
revoke all on function public.submit_marketplace_property_for_review(uuid, uuid) from authenticated;
grant execute on function public.submit_marketplace_property_for_review(uuid, uuid) to service_role;

commit;
