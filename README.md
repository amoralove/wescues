# Wescues

A platform that aggregates animal shelter listings in one place, instead of
each shelter's dogs being scattered across their own separate sites.

## Backend

Backend is [Supabase](https://supabase.com) (Postgres + Auth + Row Level
Security). Schema lives in `supabase/migrations/`.

**Core tables**

- `shelters` — org accounts that own dog listings (name, contact info, location).
- `profiles` — one row per authenticated user, with `role` (`adopter`,
  `shelter_staff`, or `platform_admin`) and, for staff, the `shelter_id`
  they belong to. Created automatically on signup via a trigger on
  `auth.users`.
- `dogs` — listings owned by a shelter (`status`: `available` / `pending` /
  `adopted` / `hold`).
- `dog_photos` — one row per photo on a dog, holding its `phash` (perceptual
  hash) once processed. See "Duplicate photo detection" below.
- `applications` — a user's request to adopt a specific dog, with a
  `status` a shelter can move through `submitted` → `reviewing` →
  `approved`/`rejected`.
- `flagged_listings` — pairs of `dog_photos` flagged as likely duplicates,
  for moderation.

**Access model (Row Level Security)**

- Shelters, dogs, and dog photos are publicly readable (no login needed to browse).
- Only a shelter's own staff (matched via `profiles.shelter_id`) can create,
  edit, or delete that shelter's dogs/photos, or update applications against them.
- Users can only see and create their own applications; they can withdraw
  one but not otherwise change its status.
- Only `platform_admin` profiles can see or act on `flagged_listings`.

**Shelter onboarding:** call the `create_shelter(...)` RPC as an
authenticated user to create a shelter and become its first
`shelter_staff` member in one transaction.

### Duplicate photo detection

Shelters sometimes end up with the same photo posted under different dog
names — a copy-pasted stock photo, a scraped listing, or an outright fake.
Each dog photo gets a 64-bit perceptual hash (via the `hash-photo` Edge
Function, `supabase/functions/hash-photo/`), stored on `dog_photos.phash`.
On hashing, `hash_and_flag_photo()` compares it against every other dog's
photo hashes (Hamming distance, threshold 10 of 64 bits) and records any
close match in `flagged_listings` for a moderator to review — it never
auto-rejects, since legitimate lookalikes happen.

The Edge Function is invoked manually per photo for now
(`POST /functions/v1/hash-photo` with `{"photo_id": "<uuid>"}`); it isn't
yet wired to run automatically when a shelter uploads a photo. It also
only decodes JPEG today — PNG support needs a pure-JS PNG decoder added
alongside `jpeg-js`.

**Known gaps:**
- No automatic trigger yet on photo upload (needs a DB webhook or storage
  trigger calling the Edge Function — deferred pending the real upload flow).
- PNG photos aren't hashed yet (JPEG only).

### Local setup

```bash
# Install the CLI (already done if you're reading this after setup)
brew install supabase/tap/supabase

# Requires Docker Desktop running
supabase start
```

### Using a hosted project

1. Create a project at [supabase.com/dashboard](https://supabase.com/dashboard).
2. Link this repo to it: `supabase link --project-ref <your-project-ref>`
3. Push the schema: `supabase db push`

`supabase db push --include-seed` only (re-)applies `supabase/seed.sql` on
a fresh database — it won't rerun it just because the file changed on an
already-seeded project. To apply seed changes to an existing hosted
project, run it directly: `supabase db query --linked -f supabase/seed.sql`.
