begin;

create or replace function public.reopen_rejected_marketplace_property(
  p_property_id uuid,
  p_owner_id uuid,
  p_now timestamptz default now()
)
returns table(
  outcome text,
  property_id uuid,
  reference_id text,
  marketplace_status text,
  current_step text,
  rejection_reason text,
  rejected_at timestamptz,
  reviewed_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_property public.properties%rowtype;
begin
  select * into v_property
  from public.properties p
  where p.id = p_property_id and p.owner_id = p_owner_id
  for update;

  if not found then
    return query select 'NOT_FOUND'::text, null::uuid, null::text, null::text, null::text, null::text, null::timestamptz, null::timestamptz;
    return;
  end if;

  if v_property.marketplace_status <> 'REJECTED' then
    return query select
      (case when v_property.marketplace_status = 'DRAFT' and v_property.marketplace_rejected_at is not null then 'ALREADY_REOPENED' else 'NOT_REJECTED' end)::text,
      v_property.id, v_property.property_code::text, v_property.marketplace_status,
      v_property.marketplace_current_step, v_property.rejection_reason,
      v_property.marketplace_rejected_at, v_property.marketplace_reviewed_at;
    return;
  end if;

  update public.properties p
  set marketplace_status = 'DRAFT',
      marketplace_current_step = 'REVIEW',
      status = 'pending',
      is_published = false,
      updated_at = p_now
  where p.id = p_property_id and p.owner_id = p_owner_id
  returning p.* into v_property;

  return query select 'REOPENED'::text, v_property.id, v_property.property_code::text,
    v_property.marketplace_status, v_property.marketplace_current_step,
    v_property.rejection_reason, v_property.marketplace_rejected_at,
    v_property.marketplace_reviewed_at;
end;
$$;

revoke all on function public.reopen_rejected_marketplace_property(uuid,uuid,timestamptz) from public, anon, authenticated;
grant execute on function public.reopen_rejected_marketplace_property(uuid,uuid,timestamptz) to service_role;

commit;
