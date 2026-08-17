-- Called by the hash-photo Edge Function (service role only) once it has
-- computed a photo's perceptual hash: stores it, then flags any other
-- dog's photo within Hamming distance p_threshold as a likely duplicate.

create function hash_and_flag_photo(p_photo_id uuid, p_hash_hex text, p_threshold int default 10)
returns setof flagged_listings
language plpgsql
security definer set search_path = public
as $$
declare
  v_hash bit(64) := ('x' || p_hash_hex)::bit(64);
  v_dog_id uuid;
begin
  select dog_id into v_dog_id from dog_photos where id = p_photo_id;
  if v_dog_id is null then
    raise exception 'photo % not found', p_photo_id;
  end if;

  update dog_photos set phash = v_hash where id = p_photo_id;

  return query
  insert into flagged_listings (photo_id, matched_photo_id, hamming_distance)
  select p_photo_id, dp.id, bit_count(v_hash # dp.phash)
  from dog_photos dp
  where dp.id <> p_photo_id
    and dp.dog_id <> v_dog_id
    and dp.phash is not null
    and bit_count(v_hash # dp.phash) <= p_threshold
    and not exists (
      select 1 from flagged_listings fl
      where (fl.photo_id = p_photo_id and fl.matched_photo_id = dp.id)
         or (fl.photo_id = dp.id and fl.matched_photo_id = p_photo_id)
    )
  returning flagged_listings.*;
end;
$$;

revoke execute on function hash_and_flag_photo(uuid, text, int) from public;
grant execute on function hash_and_flag_photo(uuid, text, int) to service_role;
