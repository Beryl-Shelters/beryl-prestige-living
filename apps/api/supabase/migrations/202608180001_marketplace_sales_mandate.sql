begin;

alter table public.mandates
  add column if not exists marketplace_mandate_type text,
  add column if not exists ownership_confirmed boolean not null default false,
  add column if not exists mandate_accepted boolean not null default false,
  add column if not exists accepted_at timestamptz,
  add column if not exists agreement_version text,
  add column if not exists commission_percentage numeric,
  add column if not exists commission_amount numeric;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'mandates_marketplace_mandate_type_check'
      and conrelid = 'public.mandates'::regclass
  ) then
    alter table public.mandates add constraint mandates_marketplace_mandate_type_check
      check (marketplace_mandate_type is null or marketplace_mandate_type in ('EXCLUSIVE', 'OPEN'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'mandates_marketplace_acceptance_check'
      and conrelid = 'public.mandates'::regclass
  ) then
    alter table public.mandates add constraint mandates_marketplace_acceptance_check
      check (not mandate_accepted or (ownership_confirmed and accepted_at is not null));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'mandates_commission_percentage_check'
      and conrelid = 'public.mandates'::regclass
  ) then
    alter table public.mandates add constraint mandates_commission_percentage_check
      check (commission_percentage is null or (commission_percentage >= 0 and commission_percentage <= 100));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'mandates_commission_amount_check'
      and conrelid = 'public.mandates'::regclass
  ) then
    alter table public.mandates add constraint mandates_commission_amount_check
      check (commission_amount is null or commission_amount >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint c
    where c.conrelid = 'public.mandates'::regclass
      and c.confrelid = 'public.properties'::regclass
      and c.contype = 'f'
  ) then
    alter table public.mandates add constraint mandates_property_id_marketplace_fkey
      foreign key (property_id) references public.properties(id) on delete cascade;
  end if;
end $$;

create unique index if not exists mandates_marketplace_property_uidx
  on public.mandates(property_id)
  where marketplace_mandate_type is not null;

alter table public.mandates enable row level security;

commit;
