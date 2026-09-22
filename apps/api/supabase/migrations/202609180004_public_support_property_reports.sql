begin;

-- Extend the already-applied Agent-only table without rewriting existing rows.
alter table public.public_support_reports
  drop constraint public_support_reports_report_type_check,
  alter column agent_identifier drop not null,
  add column property_code text,
  add column property_name text,
  add constraint public_support_reports_report_type_check check (report_type in ('AGENT','PROPERTY')),
  add constraint public_support_reports_property_code_check check (property_code is null or (char_length(property_code) between 1 and 80 and property_code = btrim(property_code) and property_code !~ '[[:cntrl:]]')),
  add constraint public_support_reports_property_name_check check (property_name is null or (char_length(property_name) between 1 and 120 and property_name = btrim(property_name) and property_name !~ '[[:cntrl:]]')),
  add constraint public_support_reports_subject_check check (
    (report_type = 'AGENT' and agent_identifier is not null and property_code is null and property_name is null)
    or
    (report_type = 'PROPERTY' and property_code is not null and agent_identifier is null and agent_name is null)
  );

commit;
