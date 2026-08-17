# Wescues

A platform that aggregates animal shelter listings in one place, instead of
each shelter's dogs being scattered across their own separate sites.

## Backend

Backend is [Supabase](https://supabase.com) (Postgres + Auth + Row Level
Security). Schema lives in `supabase/migrations/`.

**Core tables**

- `shelters` — org accounts that own dog listings (name, contact info, location).
- `profiles` — one row per authenticated user, with `role` (`adopter` or
  `shelter_staff`) and, for staff, the `shelter_id` they belong to. Created
  automatically on signup via a trigger on `auth.users`.
- `dogs` — listings owned by a shelter (`status`: `available` / `pending` /
  `adopted` / `hold`).
- `applications` — a user's request to adopt a specific dog, with a
  `status` a shelter can move through `submitted` → `reviewing` →
  `approved`/`rejected`.

**Access model (Row Level Security)**

- Shelters and dogs are publicly readable (no login needed to browse).
- Only a shelter's own staff (matched via `profiles.shelter_id`) can create,
  edit, or delete that shelter's dogs, or update applications against them.
- Users can only see and create their own applications; they can withdraw
  one but not otherwise change its status.

**Known gap:** there's no onboarding flow yet to link a newly-created
shelter to the staff member who created it (`profiles.shelter_id` has to be
set some other way for now — e.g. directly in the dashboard). That'll need
a dedicated signup flow (likely a Postgres function called via RPC that
creates the shelter and sets the creator's `shelter_id` in one transaction).

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
