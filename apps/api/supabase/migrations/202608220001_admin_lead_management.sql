begin;

alter table public.inquiries
  add column if not exists lead_stage text;

update public.inquiries
set lead_stage = case lower(coalesce(status::text, ''))
  when 'contacted' then 'CONTACTED'
  when 'in_progress' then 'CONTACTED'
  when 'scheduled' then 'CONTACTED'
  when 'resolved' then 'WON'
  when 'closed' then 'LOST'
  else 'NEW'
end
where lead_stage is null;

alter table public.inquiries
  alter column lead_stage set default 'NEW',
  alter column lead_stage set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'inquiries_lead_stage_check'
      and conrelid = 'public.inquiries'::regclass
  ) then
    alter table public.inquiries add constraint inquiries_lead_stage_check
      check (lead_stage in ('NEW', 'CONTACTED', 'WON', 'LOST'));
  end if;
end $$;

create index if not exists inquiries_lead_stage_created_idx
  on public.inquiries(lead_stage, created_at desc, id desc);

create table if not exists public.inquiry_lead_stage_history (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid not null references public.inquiries(id) on delete cascade,
  previous_stage text not null check (previous_stage in ('NEW', 'CONTACTED', 'WON', 'LOST')),
  new_stage text not null check (new_stage in ('NEW', 'CONTACTED', 'WON', 'LOST')),
  changed_by_admin_id uuid not null references public.admins(id),
  created_at timestamptz not null default now()
);

create index if not exists inquiry_lead_stage_history_inquiry_idx
  on public.inquiry_lead_stage_history(inquiry_id, created_at desc);

alter table public.inquiries enable row level security;
alter table public.inquiry_lead_stage_history enable row level security;

create or replace function public.list_admin_inquiry_leads(
  p_query text default null,
  p_per_stage_limit integer default 20
)
returns table(
  lead_id uuid,
  reference_id text,
  customer_name text,
  property_id uuid,
  property_title text,
  property_reference_id text,
  stage text,
  inquiry_type text,
  received_at timestamptz,
  stage_total bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with matching as (
    select
      i.id,
      'ENQ-' || upper(left(replace(i.id::text, '-', ''), 8)) as reference_id,
      coalesce(nullif(btrim(i.full_name), ''), 'Unknown customer') as customer_name,
      i.property_id,
      p.title as property_title,
      p.property_code::text as property_reference_id,
      i.lead_stage,
      i.inquiry_type::text,
      i.created_at,
      count(*) over (partition by i.lead_stage) as stage_total,
      row_number() over (partition by i.lead_stage order by i.created_at desc, i.id desc) as stage_row
    from public.inquiries i
    left join public.properties p on p.id = i.property_id
    where nullif(btrim(p_query), '') is null
       or i.full_name ilike '%' || btrim(p_query) || '%'
       or p.title ilike '%' || btrim(p_query) || '%'
       or p.property_code::text ilike '%' || btrim(p_query) || '%'
       or i.id::text ilike '%' || btrim(p_query) || '%'
       or ('ENQ-' || upper(left(replace(i.id::text, '-', ''), 8))) ilike '%' || btrim(p_query) || '%'
  )
  select id, reference_id, customer_name, property_id, property_title,
    property_reference_id, lead_stage, inquiry_type, created_at, stage_total
  from matching
  where stage_row <= greatest(1, least(coalesce(p_per_stage_limit, 20), 50))
  order by case lead_stage when 'NEW' then 1 when 'CONTACTED' then 2 when 'WON' then 3 else 4 end,
    created_at desc, id desc;
$$;

create or replace function public.transition_admin_inquiry_lead_stage(
  p_inquiry_id uuid,
  p_admin_id uuid,
  p_expected_stage text,
  p_new_stage text,
  p_now timestamptz default now()
)
returns table(
  outcome text,
  inquiry_id uuid,
  previous_stage text,
  current_stage text,
  changed_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_inquiry public.inquiries%rowtype;
begin
  select * into v_inquiry
  from public.inquiries i
  where i.id = p_inquiry_id
  for update;

  if not found then
    return query select 'NOT_FOUND'::text, null::uuid, null::text, null::text, null::timestamptz;
    return;
  end if;

  if v_inquiry.lead_stage <> p_expected_stage then
    return query select 'STALE'::text, v_inquiry.id, p_expected_stage, v_inquiry.lead_stage, null::timestamptz;
    return;
  end if;

  if not (
    (v_inquiry.lead_stage = 'NEW' and p_new_stage = 'CONTACTED') or
    (v_inquiry.lead_stage = 'CONTACTED' and p_new_stage in ('WON', 'LOST'))
  ) then
    return query select 'INVALID_TRANSITION'::text, v_inquiry.id, v_inquiry.lead_stage, v_inquiry.lead_stage, null::timestamptz;
    return;
  end if;

  update public.inquiries
  set lead_stage = p_new_stage,
      updated_at = p_now
  where id = v_inquiry.id;

  insert into public.inquiry_lead_stage_history(
    inquiry_id, previous_stage, new_stage, changed_by_admin_id, created_at
  ) values (
    v_inquiry.id, v_inquiry.lead_stage, p_new_stage, p_admin_id, p_now
  );

  return query select 'UPDATED'::text, v_inquiry.id, v_inquiry.lead_stage, p_new_stage, p_now;
end;
$$;

revoke all on function public.list_admin_inquiry_leads(text, integer) from public, anon, authenticated;
grant execute on function public.list_admin_inquiry_leads(text, integer) to service_role;
revoke all on function public.transition_admin_inquiry_lead_stage(uuid, uuid, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.transition_admin_inquiry_lead_stage(uuid, uuid, text, text, timestamptz) to service_role;

commit;
