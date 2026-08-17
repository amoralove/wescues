-- Confirming a flagged_listings match doesn't tell us *which* dog (if
-- either) is the fraudulent one -- that's a human call. So instead of
-- acting automatically, give admins (and a shelter correcting its own
-- duplicate entry) an explicit action to hide a specific listing.

alter table dogs add column hidden_at timestamptz;
alter table dogs add column hidden_reason text;

drop policy "dogs are publicly readable" on dogs;

create policy "dogs are publicly readable"
  on dogs for select
  using (hidden_at is null);

create policy "shelter staff can view their own dogs"
  on dogs for select
  to authenticated
  using (shelter_id = auth_shelter_id());

create policy "platform admins can view all dogs"
  on dogs for select
  to authenticated
  using (is_platform_admin());

-- Same visibility rule for a hidden dog's photos.
drop policy "dog photos are publicly readable" on dog_photos;

create policy "dog photos are publicly readable"
  on dog_photos for select
  using (exists (
    select 1 from dogs where dogs.id = dog_photos.dog_id and dogs.hidden_at is null
  ));

create policy "shelter staff can view photos of their own dogs"
  on dog_photos for select
  to authenticated
  using (exists (
    select 1 from dogs where dogs.id = dog_photos.dog_id and dogs.shelter_id = auth_shelter_id()
  ));

create policy "platform admins can view all dog photos"
  on dog_photos for select
  to authenticated
  using (is_platform_admin());

create function set_dog_hidden(p_dog_id uuid, p_hidden boolean, p_reason text default null)
returns dogs
language plpgsql
security definer set search_path = public
as $$
declare
  v_dog dogs;
  v_shelter_id uuid;
begin
  select shelter_id into v_shelter_id from dogs where id = p_dog_id;
  if v_shelter_id is null then
    raise exception 'dog % not found', p_dog_id;
  end if;

  if not (is_platform_admin() or v_shelter_id = auth_shelter_id()) then
    raise exception 'not authorized to modify this dog';
  end if;

  update dogs
  set hidden_at = case when p_hidden then now() else null end,
      hidden_reason = case when p_hidden then p_reason else null end
  where id = p_dog_id
  returning * into v_dog;

  return v_dog;
end;
$$;

revoke execute on function set_dog_hidden(uuid, boolean, text) from public;
grant execute on function set_dog_hidden(uuid, boolean, text) to authenticated;

-- Security fix: the existing "users can update their own profile" policy
-- restricts which *row* a user can touch, but not which *columns* -- so
-- any authenticated user could currently PATCH their own role to
-- 'platform_admin', or shelter_id to someone else's shelter. Column-level
-- grants close that: only full_name is user-editable directly. role and
-- shelter_id can only change via the security-definer create_shelter RPC.
revoke update on profiles from authenticated;
grant update (full_name) on profiles to authenticated;
