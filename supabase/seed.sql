-- Sample data for local/dev use.

insert into shelters (id, name, slug, description, email, city, state, postal_code)
values
  ('11111111-1111-1111-1111-111111111111', 'Sunny Paws Rescue', 'sunny-paws-rescue', 'A no-kill shelter serving the greater Austin area since 2010.', 'hello@sunnypaws.org', 'Austin', 'TX', '78701'),
  ('22222222-2222-2222-2222-222222222222', 'Second Chance Shelter', 'second-chance-shelter', 'Rescuing and rehoming dogs across the Pacific Northwest.', 'adopt@secondchance.org', 'Portland', 'OR', '97201'),
  ('33333333-3333-3333-3333-333333333333', 'Furry Friends Sanctuary', 'furry-friends-sanctuary', 'A small volunteer-run sanctuary focused on senior and special-needs dogs.', 'info@furryfriends.org', 'Denver', 'CO', '80202'),
  ('44444444-4444-4444-4444-444444444444', 'City Animal Control', 'city-animal-control', 'Municipal animal control facility.', 'contact@cityanimalcontrol.gov', 'Austin', 'TX', '78702')
on conflict (id) do nothing;

insert into dogs (id, shelter_id, name, breed, age_months, sex, size, description, status)
values
  ('a1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Biscuit', 'Labrador Mix', 18, 'male', 'large', 'Biscuit loves belly rubs and long walks. Good with kids.', 'available'),
  ('a2222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Luna', 'Border Collie', 24, 'female', 'medium', 'High energy and whip-smart -- needs an active home.', 'available'),
  ('a3333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 'Rocky', 'Pit Bull Mix', 36, 'male', 'medium', 'A gentle giant who is great with other dogs.', 'available'),
  ('a4444444-4444-4444-4444-444444444444', '22222222-2222-2222-2222-222222222222', 'Daisy', 'Beagle', 12, 'female', 'small', 'Curious and food-motivated, still working on leash manners.', 'pending'),
  ('a5555555-5555-5555-5555-555555555555', '33333333-3333-3333-3333-333333333333', 'Gus', 'Dachshund', 96, 'male', 'small', 'A sweet senior looking for a quiet retirement home.', 'available'),
  ('a6666666-6666-6666-6666-666666666666', '33333333-3333-3333-3333-333333333333', 'Willow', 'Shepherd Mix', 60, 'female', 'large', 'Recovering from a leg injury, needs a foster-to-adopt home.', 'hold'),
  ('a7777777-7777-7777-7777-777777777777', '44444444-4444-4444-4444-444444444444', 'Max', 'Labrador Mix', 18, 'male', 'large', 'Friendly boy looking for his forever home.', 'available')
on conflict (id) do nothing;

-- One photo per dog. Max's photo is deliberately identical to Biscuit's --
-- a stand-in for the "same photo, different name" pattern this is meant to catch.
insert into dog_photos (id, dog_id, url)
values
  ('b1111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', 'https://placedog.net/500/280?id=10'),
  ('b2222222-2222-2222-2222-222222222222', 'a2222222-2222-2222-2222-222222222222', 'https://placedog.net/500/280?id=11'),
  ('b3333333-3333-3333-3333-333333333333', 'a3333333-3333-3333-3333-333333333333', 'https://placedog.net/500/280?id=12'),
  ('b4444444-4444-4444-4444-444444444444', 'a4444444-4444-4444-4444-444444444444', 'https://placedog.net/500/280?id=13'),
  ('b5555555-5555-5555-5555-555555555555', 'a5555555-5555-5555-5555-555555555555', 'https://placedog.net/500/280?id=14'),
  ('b6666666-6666-6666-6666-666666666666', 'a6666666-6666-6666-6666-666666666666', 'https://placedog.net/500/280?id=15'),
  ('b7777777-7777-7777-7777-777777777777', 'a7777777-7777-7777-7777-777777777777', 'https://placedog.net/500/280?id=10')
on conflict (id) do nothing;
