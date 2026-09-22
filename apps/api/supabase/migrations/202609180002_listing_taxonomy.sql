begin;

-- Expand only the existing allowlists. No rows, status transitions, RLS, or
-- privileges are modified; previously accepted values remain accepted.
alter table public.customer_listings
  drop constraint customer_listings_property_subtype_check,
  add constraint customer_listings_property_subtype_check check (property_subtype in
    ('Bungalow','Semi-Detached House','Block of flats','Terraced Duplexes',
     'Terraced Bungalows','Semi-Detached Bungalows','Detached Bungalows','Detached Duplexes')),
  drop constraint customer_listings_facilities_check,
  add constraint customer_listings_facilities_check check (facilities <@ array[
    'Swimming Pool','Balcony/Terrace','Children Play Area','Tennis Court','Basketball Court',
    'Gym/Fitness Center','CCTV','Air Conditioning','Laundry','Garden','Wi-Fi',
    'Housekeeping Services','Car Park','24Hrs Security']::text[]);

commit;
