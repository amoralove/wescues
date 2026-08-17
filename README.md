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
  for moderation. `flagged_listings_detail` is a view joining in both
  sides' dog/shelter/photo info for a review UI.

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

**Upload path:** photos go into the public `dog-photos` Storage bucket,
under `<shelter_id>/<filename>` — RLS on `storage.objects` only lets a
shelter's staff write into their own folder. After uploading, the client
inserts the resulting URL into `dog_photos`; an `AFTER INSERT` trigger
(`dog_photos_hash_on_insert`) then calls the `hash-photo` Edge Function
via `pg_net` automatically, so hashing and duplicate-flagging happen
without any extra step. Verified end-to-end by inserting a photo that
reused an existing dog's exact image — it was hashed and flagged within
seconds, with no manual function call.

**Reviewing flags:** a `platform_admin` reads `flagged_listings_detail`
(joins in both dogs, shelters, and photo URLs) and resolves a flag with a
plain `update flagged_listings set status = 'confirmed_duplicate' | 'dismissed' where id = ...`
— RLS already restricts that update to admins, so no separate RPC was needed.

**Known gaps:**
- Only decodes JPEG today — PNG support needs a pure-JS PNG decoder added
  alongside `jpeg-js`.
- `hash_and_flag_photo`'s duplicate search is a full table scan per photo
  (fine at seed-data scale; would want an index — e.g. pgvector's Hamming
  distance support — once there are many thousands of photos).
- Confirming a flag doesn't yet do anything to the underlying `dogs` row
  (e.g. auto-hiding a confirmed-duplicate listing) — deferred until there's
  a real product decision on what should happen to the listing itself.

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
