-- Duplicate/fake listing detection: track one row per dog photo (instead of
-- a bare url array) with a perceptual hash, and flag near-identical photos
-- across the platform for manual review.

alter table profiles drop constraint profiles_role_check;
alter table profiles add constraint profiles_role_check
  check (role in ('adopter', 'shelter_staff', 'platform_admin'));

create function is_platform_admin()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'platform_admin'
  );
$$;

-- dog_photos replaces dogs.photo_urls so each photo can carry its own hash
-- and be flagged individually.
create table dog_photos (
  id uuid primary key default gen_random_uuid(),
  dog_id uuid not null references dogs (id) on delete cascade,
  url text not null,
  -- 64-bit perceptual hash (blockhash), null until the hash-photo function processes it.
  phash bit(64),
  created_at timestamptz not null default now()
);

create index dog_photos_dog_id_idx on dog_photos (dog_id);
create index dog_photos_phash_idx on dog_photos (phash) where phash is not null;

alter table dog_photos enable row level security;

create policy "dog photos are publicly readable"
  on dog_photos for select
  using (true);

create policy "shelter staff can add photos to their dogs"
  on dog_photos for insert
  to authenticated
  with check (exists (
    select 1 from dogs where dogs.id = dog_photos.dog_id and dogs.shelter_id = auth_shelter_id()
  ));

create policy "shelter staff can update photos on their dogs"
  on dog_photos for update
  to authenticated
  using (exists (
    select 1 from dogs where dogs.id = dog_photos.dog_id and dogs.shelter_id = auth_shelter_id()
  ));

create policy "shelter staff can delete photos on their dogs"
  on dog_photos for delete
  to authenticated
  using (exists (
    select 1 from dogs where dogs.id = dog_photos.dog_id and dogs.shelter_id = auth_shelter_id()
  ));

alter table dogs drop column photo_urls;

-- flagged_listings: a near-duplicate photo match awaiting moderation.
-- Written by the hash-photo Edge Function using the service role, which
-- bypasses RLS, so no insert policy is granted here.
create table flagged_listings (
  id uuid primary key default gen_random_uuid(),
  photo_id uuid not null references dog_photos (id) on delete cascade,
  matched_photo_id uuid not null references dog_photos (id) on delete cascade,
  hamming_distance int not null,
  status text not null default 'pending' check (status in ('pending', 'confirmed_duplicate', 'dismissed')),
  created_at timestamptz not null default now(),
  constraint flagged_listings_distinct_photos check (photo_id <> matched_photo_id),
  constraint flagged_listings_unique_pair unique (photo_id, matched_photo_id)
);

alter table flagged_listings enable row level security;

create policy "platform admins can view flagged listings"
  on flagged_listings for select
  to authenticated
  using (is_platform_admin());

create policy "platform admins can update flagged listings"
  on flagged_listings for update
  to authenticated
  using (is_platform_admin());
