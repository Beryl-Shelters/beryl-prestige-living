begin;

-- A pending reservation owns the private CV before upload. Only ACCEPTED rows
-- represent applications; abandoned reservations are eligible for cleanup.
create table public.public_career_applications (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'PENDING' check (status in ('PENDING','ACCEPTED')),
  resume_public_id text not null unique check (char_length(resume_public_id) between 1 and 200),
  resume_mime_type text check (resume_mime_type is null or resume_mime_type = 'application/pdf'),
  resume_size_bytes integer check (resume_size_bytes is null or resume_size_bytes between 1 and 10485760),
  full_name text,
  email text,
  phone text,
  position text,
  cover_letter text,
  created_at timestamptz not null default clock_timestamp(),
  accepted_at timestamptz,
  constraint career_accepted_complete check (status = 'PENDING' or (
    full_name is not null and email is not null and phone is not null and position is not null
    and resume_mime_type is not null and resume_size_bytes is not null and accepted_at is not null)),
  constraint career_name_valid check (full_name is null or (char_length(full_name) between 2 and 120 and full_name = btrim(full_name) and full_name !~ '[[:cntrl:]]')),
  constraint career_email_valid check (email is null or (char_length(email) between 3 and 254 and email = btrim(email) and email !~ '[[:cntrl:]]')),
  constraint career_phone_valid check (phone is null or (char_length(phone) between 7 and 25 and phone = btrim(phone) and phone !~ '[[:cntrl:]]')),
  constraint career_position_valid check (position is null or position in ('Frontend Developer','Backend Developer','Real Estate Agent','Sales Manager','Marketing Specialist')),
  constraint career_notes_valid check (cover_letter is null or (char_length(cover_letter) <= 3000 and replace(replace(cover_letter,E'\n',''),E'\r','') !~ '[[:cntrl:]]'))
);

create index public_career_applications_pending_idx on public.public_career_applications (created_at) where status = 'PENDING';
alter table public.public_career_applications enable row level security;
revoke all on public.public_career_applications from public, anon, authenticated, service_role;
grant select, insert, update, delete on public.public_career_applications to service_role;

commit;
