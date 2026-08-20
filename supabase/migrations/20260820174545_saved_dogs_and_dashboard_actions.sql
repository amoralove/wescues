-- Schema additions to support the new mockup-driven pages: saved dogs
-- (adopter account), in-app check-in confirmation (shelter dashboard,
-- as an alternative to the email link), and merging a confirmed
-- duplicate listing into the original (moderator review).

create table saved_dogs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  dog_id uuid not null references dogs (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, dog_id)
);

alter table saved_dogs enable row level security;

create policy "users can view their own saved dogs"
  on saved_dogs for select
  to authenticated
  using (user_id = auth.uid());

create policy "users can save dogs"
  on saved_dogs for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "users can unsave their own saved dogs"
  on saved_dogs for delete
  to authenticated
  using (user_id = auth.uid());

-- Lets a shelter confirm a dog's listing directly from their dashboard,
-- instead of only via the emailed check-in link. Resolves any pending
-- check-in for the dog if one exists, and always bumps last_confirmed_at.
create function confirm_dog_checkin_as_shelter(p_dog_id uuid, p_response text)
returns dogs
language plpgsql
security definer set search_path = public
as $$
declare
  v_dog dogs;
begin
  if p_response not in ('still_available', 'adopted') then
    raise exception 'invalid response: %', p_response;
  end if;

  select * into v_dog from dogs where id = p_dog_id;
  if v_dog.id is null then
    raise exception 'dog % not found', p_dog_id;
  end if;

  if v_dog.shelter_id <> auth_shelter_id() then
    raise exception 'not authorized to confirm this dog';
  end if;

  update dog_checkins
  set status = case when p_response = 'adopted' then 'confirmed_adopted' else 'confirmed_available' end,
      responded_at = now()
  where dog_id = p_dog_id and status = 'pending';

  update dogs
  set last_confirmed_at = now(),
      status = case when p_response = 'adopted' then 'adopted' else status end
  where id = p_dog_id
  returning * into v_dog;

  return v_dog;
end;
$$;

revoke execute on function confirm_dog_checkin_as_shelter(uuid, text) from public;
grant execute on function confirm_dog_checkin_as_shelter(uuid, text) to authenticated;

-- Moderator action: merges a confirmed-duplicate listing into the
-- original -- reassigns its applications rather than losing them, then
-- deletes it (which also cascades away its photos and the flag entry).
create function merge_duplicate_dog(p_primary_dog_id uuid, p_duplicate_dog_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not is_platform_admin() then
    raise exception 'not authorized';
  end if;

  if p_primary_dog_id = p_duplicate_dog_id then
    raise exception 'cannot merge a dog into itself';
  end if;

  update applications set dog_id = p_primary_dog_id where dog_id = p_duplicate_dog_id;

  delete from dogs where id = p_duplicate_dog_id;
end;
$$;

revoke execute on function merge_duplicate_dog(uuid, uuid) from public;
grant execute on function merge_duplicate_dog(uuid, uuid) to authenticated;
