-- Core schema for Wescues: shelters listing dogs, users applying to adopt them.

create extension if not exists pgcrypto;

-- Shelters: org accounts that own dog listings.
create table shelters (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  website_url text,
  email text,
  phone text,
  address text,
  city text,
  state text,
  postal_code text,
  lat double precision,
  lng double precision,
  created_at timestamptz not null default now()
);

-- Profiles: one row per authenticated user (adopter or shelter staff).
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  role text not null default 'adopter' check (role in ('adopter', 'shelter_staff')),
  shelter_id uuid references shelters (id) on delete set null,
  created_at timestamptz not null default now()
);

-- Auto-create a profile row whenever a new auth user signs up.
create function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Dogs: listings owned by a shelter.
create table dogs (
  id uuid primary key default gen_random_uuid(),
  shelter_id uuid not null references shelters (id) on delete cascade,
  name text not null,
  breed text,
  age_months int,
  sex text check (sex in ('male', 'female', 'unknown')),
  size text check (size in ('small', 'medium', 'large')),
  description text,
  status text not null default 'available' check (status in ('available', 'pending', 'adopted', 'hold')),
  photo_urls text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index dogs_shelter_id_idx on dogs (shelter_id);
create index dogs_status_idx on dogs (status);

create function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger dogs_set_updated_at
  before update on dogs
  for each row execute function set_updated_at();

-- Applications: a user's request to adopt a specific dog.
create table applications (
  id uuid primary key default gen_random_uuid(),
  dog_id uuid not null references dogs (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  message text,
  status text not null default 'submitted' check (status in ('submitted', 'reviewing', 'approved', 'rejected', 'withdrawn')),
  created_at timestamptz not null default now()
);

create index applications_dog_id_idx on applications (dog_id);
create index applications_user_id_idx on applications (user_id);

-- Row Level Security

alter table shelters enable row level security;
alter table profiles enable row level security;
alter table dogs enable row level security;
alter table applications enable row level security;

-- Helper: the shelter_id of the calling user, if they're shelter staff.
create function auth_shelter_id()
returns uuid
language sql
security definer set search_path = public
stable
as $$
  select shelter_id from profiles where id = auth.uid();
$$;

-- shelters: publicly readable; only staff of that shelter can edit it;
-- any authenticated user can create one (becomes its first staff member's org).
create policy "shelters are publicly readable"
  on shelters for select
  using (true);

create policy "authenticated users can create a shelter"
  on shelters for insert
  to authenticated
  with check (true);

create policy "shelter staff can update their own shelter"
  on shelters for update
  to authenticated
  using (id = auth_shelter_id());

-- profiles: users manage their own profile only.
create policy "users can view their own profile"
  on profiles for select
  to authenticated
  using (id = auth.uid());

create policy "users can update their own profile"
  on profiles for update
  to authenticated
  using (id = auth.uid());

-- dogs: publicly readable; only staff of the owning shelter can write.
create policy "dogs are publicly readable"
  on dogs for select
  using (true);

create policy "shelter staff can add dogs to their shelter"
  on dogs for insert
  to authenticated
  with check (shelter_id = auth_shelter_id());

create policy "shelter staff can update their shelter's dogs"
  on dogs for update
  to authenticated
  using (shelter_id = auth_shelter_id());

create policy "shelter staff can delete their shelter's dogs"
  on dogs for delete
  to authenticated
  using (shelter_id = auth_shelter_id());

-- applications: a user manages their own applications; shelter staff see
-- and update applications for dogs belonging to their shelter.
create policy "users can view their own applications"
  on applications for select
  to authenticated
  using (user_id = auth.uid());

create policy "users can create their own applications"
  on applications for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "users can withdraw their own applications"
  on applications for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and status = 'withdrawn');

create policy "shelter staff can view applications for their dogs"
  on applications for select
  to authenticated
  using (exists (
    select 1 from dogs
    where dogs.id = applications.dog_id
    and dogs.shelter_id = auth_shelter_id()
  ));

create policy "shelter staff can update applications for their dogs"
  on applications for update
  to authenticated
  using (exists (
    select 1 from dogs
    where dogs.id = applications.dog_id
    and dogs.shelter_id = auth_shelter_id()
  ));
