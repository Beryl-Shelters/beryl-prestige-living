begin;

-- Public reports are write-only through the service-role API, separate from customer tickets.
create table public.public_support_reports (
  id uuid primary key default gen_random_uuid(),
  report_type text not null check (report_type = 'AGENT'),
  agent_identifier text not null check (char_length(agent_identifier) between 1 and 80 and agent_identifier = btrim(agent_identifier) and agent_identifier !~ '[[:cntrl:]]'),
  agent_name text check (agent_name is null or (char_length(agent_name) between 1 and 120 and agent_name = btrim(agent_name) and agent_name !~ '[[:cntrl:]]')),
  reason text not null check (char_length(reason) between 1 and 3000 and reason ~ '[^[:space:]]' and replace(replace(reason,E'\n',''),E'\r','') !~ '[[:cntrl:]]'),
  created_at timestamptz not null default clock_timestamp()
);

alter table public.public_support_reports enable row level security;
revoke all on public.public_support_reports from public,anon,authenticated,service_role;
grant insert on public.public_support_reports to service_role;
commit;
