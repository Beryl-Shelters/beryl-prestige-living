begin;

-- Human-facing identifiers, not authentication tokens. Six base-32 characters
-- provide 32^6 combinations per prefix; consumers still need a UNIQUE
-- constraint and bounded collision retries. Exclude ambiguous I/O/0/1.
create function public.generate_display_code(p_prefix text)
returns text language plpgsql volatile set search_path = pg_catalog, pg_temp as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_random bytea := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
  v_code text;
begin
  if p_prefix is null or p_prefix !~ '^[A-Z]{3}$' then
    raise exception using errcode='23514', message='Invalid display-code prefix';
  end if;
  v_code := p_prefix || '-';
  -- UUID bytes 0..5 are random (no version/variant bits). Modulo 32 is
  -- unbiased because 256 is exactly divisible by 32.
  for i in 0..5 loop
    v_code := v_code || substr(v_alphabet, (get_byte(v_random, i) % 32) + 1, 1);
  end loop;
  return v_code;
end $$;

create function public.assign_customer_listing_code()
returns trigger language plpgsql set search_path = pg_catalog, pg_temp as $$
begin
  if new.listing_code is null then
    new.listing_code := public.generate_display_code(
      case new.property_type when 'Residential' then 'RES' when 'Commercial' then 'COM' end);
  end if;
  return new;
end $$;

-- Only future inserts change. Existing codes, UUIDs and shared URLs survive.
-- The existing UNIQUE constraint + repository CREATE retry handle collisions.
alter table public.customer_listings alter column listing_code drop default;
create trigger customer_listing_code_before_insert
before insert on public.customer_listings
for each row execute function public.assign_customer_listing_code();

revoke all on function public.generate_display_code(text) from public, anon, authenticated;
revoke all on function public.assign_customer_listing_code() from public, anon, authenticated;
grant execute on function public.generate_display_code(text) to service_role;
grant execute on function public.assign_customer_listing_code() to service_role;
commit;
