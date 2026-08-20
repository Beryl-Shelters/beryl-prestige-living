begin;

-- Marketplace drafts are intentionally partial. These legacy listing columns
-- become mandatory again at submit/review time through the existing atomic
-- Marketplace completeness checks.
alter table public.properties
  alter column title drop not null,
  alter column category drop not null,
  alter column property_type drop not null,
  alter column price drop not null,
  alter column state drop not null;

commit;
