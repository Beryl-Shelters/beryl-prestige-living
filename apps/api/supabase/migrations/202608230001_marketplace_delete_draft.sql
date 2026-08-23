begin;

create or replace function public.delete_marketplace_draft_property(
  p_property_id uuid,
  p_owner_id uuid
)
returns table(
  outcome text,
  property_id uuid
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
  where p.id = p_property_id
    and p.owner_id = p_owner_id
  for update;

  if not found then
    return query select 'NOT_FOUND'::text, null::uuid;
    return;
  end if;

  if v_property.marketplace_status <> 'DRAFT' then
    return query select 'NOT_EDITABLE'::text, v_property.id;
    return;
  end if;

  delete from public.properties p
  where p.id = p_property_id
    and p.owner_id = p_owner_id
    and p.marketplace_status = 'DRAFT';

  return query select 'DELETED'::text, v_property.id;
end;
$$;

revoke all on function public.delete_marketplace_draft_property(uuid, uuid) from public, anon, authenticated;
grant execute on function public.delete_marketplace_draft_property(uuid, uuid) to service_role;

commit;
