-- Onboarding: lets an authenticated user create a shelter and become its
-- first staff member in one transaction, closing the gap noted in the
-- initial schema migration.

create function create_shelter(
  p_name text,
  p_slug text,
  p_description text default null,
  p_website_url text default null,
  p_email text default null,
  p_phone text default null,
  p_address text default null,
  p_city text default null,
  p_state text default null,
  p_postal_code text default null
)
returns shelters
language plpgsql
security definer set search_path = public
as $$
declare
  v_shelter shelters;
begin
  if auth.uid() is null then
    raise exception 'Must be authenticated to create a shelter';
  end if;

  if (select shelter_id from profiles where id = auth.uid()) is not null then
    raise exception 'You already belong to a shelter';
  end if;

  insert into shelters (name, slug, description, website_url, email, phone, address, city, state, postal_code)
  values (p_name, p_slug, p_description, p_website_url, p_email, p_phone, p_address, p_city, p_state, p_postal_code)
  returning * into v_shelter;

  update profiles
  set shelter_id = v_shelter.id, role = 'shelter_staff'
  where id = auth.uid();

  return v_shelter;
end;
$$;

revoke execute on function create_shelter from public;
grant execute on function create_shelter to authenticated;
