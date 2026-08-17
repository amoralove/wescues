-- Periodic "is this dog still here?" check-ins. A dog not confirmed by its
-- shelter in ~2 months gets an email with two links (still available /
-- adopted); no response within a grace period hides the listing (not a
-- hard delete -- reversible, and doesn't cascade-destroy its application
-- history over one missed email).

alter table dogs add column last_confirmed_at timestamptz not null default now();

create table dog_checkins (
  id uuid primary key default gen_random_uuid(),
  dog_id uuid not null references dogs (id) on delete cascade,
  token text not null unique default encode(extensions.gen_random_bytes(24), 'hex'),
  status text not null default 'pending' check (status in ('pending', 'confirmed_available', 'confirmed_adopted', 'expired')),
  sent_at timestamptz not null default now(),
  responded_at timestamptz,
  expires_at timestamptz not null
);

create index dog_checkins_dog_id_idx on dog_checkins (dog_id);
create index dog_checkins_pending_expiry_idx on dog_checkins (expires_at) where status = 'pending';
-- At most one open check-in per dog at a time.
create unique index dog_checkins_one_pending_per_dog on dog_checkins (dog_id) where status = 'pending';

alter table dog_checkins enable row level security;

create policy "shelter staff can view checkins for their dogs"
  on dog_checkins for select
  to authenticated
  using (exists (
    select 1 from dogs where dogs.id = dog_checkins.dog_id and dogs.shelter_id = auth_shelter_id()
  ));

create policy "platform admins can view all checkins"
  on dog_checkins for select
  to authenticated
  using (is_platform_admin());

-- Called by the respond-dog-checkin Edge Function (service role) once a
-- shelter clicks a response link. The token is the only authorization --
-- there's no login for this, by design, to keep the email frictionless.
create function respond_to_checkin(p_token text, p_response text)
returns dog_checkins
language plpgsql
security definer set search_path = public
as $$
declare
  v_checkin dog_checkins;
begin
  if p_response not in ('still_available', 'adopted') then
    raise exception 'invalid response: %', p_response;
  end if;

  select * into v_checkin
  from dog_checkins
  where token = p_token and status = 'pending' and expires_at > now();

  if v_checkin.id is null then
    raise exception 'check-in not found, already answered, or expired';
  end if;

  update dog_checkins
  set status = case when p_response = 'adopted' then 'confirmed_adopted' else 'confirmed_available' end,
      responded_at = now()
  where id = v_checkin.id
  returning * into v_checkin;

  update dogs
  set last_confirmed_at = now(),
      status = case when p_response = 'adopted' then 'adopted' else status end
  where id = v_checkin.dog_id;

  return v_checkin;
end;
$$;

revoke execute on function respond_to_checkin(text, text) from public;
grant execute on function respond_to_checkin(text, text) to service_role;

-- Cron entry point 1: open a check-in (and email it) for every available,
-- visible dog that hasn't been confirmed in 2 months and doesn't already
-- have one pending.
create function start_due_dog_checkins()
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  r record;
  v_checkin_id uuid;
begin
  for r in
    select d.id
    from dogs d
    where d.status = 'available'
      and d.hidden_at is null
      and d.last_confirmed_at < now() - interval '2 months'
      and not exists (
        select 1 from dog_checkins c where c.dog_id = d.id and c.status = 'pending'
      )
  loop
    insert into dog_checkins (dog_id, expires_at)
    values (r.id, now() + interval '14 days')
    returning id into v_checkin_id;

    perform net.http_post(
      url := 'https://lgpgrxhswhcfliroklio.supabase.co/functions/v1/send-dog-checkin',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxncGdyeGhzd2hjZmxpcm9rbGlvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY5OTA2MTQsImV4cCI6MjEwMjU2NjYxNH0.IRzWzb7rTm_D-IVSwQlVqh1-4HvKBVKyzUYhCBx_CXk'
      ),
      body := jsonb_build_object('checkin_id', v_checkin_id)
    );
  end loop;
end;
$$;

-- Cron entry point 2: expire pending check-ins past their grace period and
-- hide the dogs that never responded.
create function expire_dog_checkins()
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  update dog_checkins
  set status = 'expired'
  where status = 'pending' and expires_at < now();

  update dogs d
  set hidden_at = now(),
      hidden_reason = 'No shelter response to 2-month check-in'
  from dog_checkins c
  where c.dog_id = d.id
    and c.status = 'expired'
    and c.responded_at is null
    and d.hidden_at is null;
end;
$$;

create extension if not exists pg_cron;

select cron.schedule('dog-checkins-start', '0 14 * * *', 'select start_due_dog_checkins();');
select cron.schedule('dog-checkins-expire', '30 14 * * *', 'select expire_dog_checkins();');
