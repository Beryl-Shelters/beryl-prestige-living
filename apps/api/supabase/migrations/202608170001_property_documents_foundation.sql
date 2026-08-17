begin;
create table if not exists public.property_documents (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  document_type text not null check (document_type in ('OWNERSHIP_PAPERS','SURVEY_PLAN','DEED','CERTIFICATE_OF_OCCUPANCY','OTHER')),
  display_name text not null,
  cloudinary_public_id text not null,
  cloudinary_resource_type text not null default 'raw',
  mime_type text not null,
  size_bytes bigint not null check (size_bytes >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists property_documents_property_created_idx on public.property_documents(property_id, created_at asc);
alter table public.property_documents enable row level security;
commit;
