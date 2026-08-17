-- Automatically hash a photo (and check for duplicates) as soon as its
-- dog_photos row is created, instead of requiring a manual call to the
-- hash-photo Edge Function.
--
-- Uses the anon key, which is meant to be public (it's what browser
-- clients embed) -- the Edge Function itself uses its own service role
-- key internally and never receives this one.

create extension if not exists pg_net with schema extensions;

create function trigger_hash_photo()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  perform net.http_post(
    url := 'https://lgpgrxhswhcfliroklio.supabase.co/functions/v1/hash-photo',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxncGdyeGhzd2hjZmxpcm9rbGlvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY5OTA2MTQsImV4cCI6MjEwMjU2NjYxNH0.IRzWzb7rTm_D-IVSwQlVqh1-4HvKBVKyzUYhCBx_CXk'
    ),
    body := jsonb_build_object('photo_id', new.id)
  );
  return new;
end;
$$;

create trigger dog_photos_hash_on_insert
  after insert on dog_photos
  for each row execute function trigger_hash_photo();
