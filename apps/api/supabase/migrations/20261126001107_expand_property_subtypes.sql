begin;
set local lock_timeout = '5s';

-- Add specific search/upload categories without changing the broad
-- Residential/Commercial property_type contract or any existing row.
alter table public.customer_listings
  drop constraint customer_listings_property_subtype_check,
  add constraint customer_listings_property_subtype_check check (property_subtype in (
    'Bungalow','Semi-Detached House','Block of flats','Terraced Duplexes',
    'Terraced Bungalows','Semi-Detached Bungalows','Detached Bungalows','Detached Duplexes',
    'Flat','Duplex','Land','Detached House','Terraced House','Townhouse',
    'Studio Apartment','Penthouse','Maisonette','Mansion','Office Space',
    'Shop','Warehouse','Commercial Building','Mixed-Use Property'));

alter table public.public_buy_assistance_requests
  drop constraint public_buy_assistance_requests_property_subtype_check,
  add constraint public_buy_assistance_requests_property_subtype_check check (
    property_subtype is null or property_subtype in (
      'Bungalow','Semi-Detached House','Block of flats','Terraced Duplexes',
      'Terraced Bungalows','Semi-Detached Bungalows','Detached Bungalows','Detached Duplexes',
      'Flat','Duplex','Land','Detached House','Terraced House','Townhouse',
      'Studio Apartment','Penthouse','Maisonette','Mansion','Office Space',
      'Shop','Warehouse','Commercial Building','Mixed-Use Property'));

alter table public.customer_completed_purchases
  drop constraint customer_completed_purchases_property_subtype_check,
  add constraint customer_completed_purchases_property_subtype_check check (
    property_subtype is null or property_subtype in (
      'Bungalow','Semi-Detached House','Block of flats','Terraced Duplexes',
      'Terraced Bungalows','Semi-Detached Bungalows','Detached Bungalows','Detached Duplexes',
      'Flat','Duplex','Land','Detached House','Terraced House','Townhouse',
      'Studio Apartment','Penthouse','Maisonette','Mansion','Office Space',
      'Shop','Warehouse','Commercial Building','Mixed-Use Property')),
  drop constraint completed_purchase_type_check,
  add constraint completed_purchase_type_check check (
    (property_type = 'Residential' and property_subtype is not null)
    or property_type = 'Commercial');

commit;
