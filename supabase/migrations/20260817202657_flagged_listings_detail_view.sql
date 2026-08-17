-- Joined view for the moderation review flow, so a platform_admin can see
-- both sides of a flagged photo match (dog, shelter, photo url) in one
-- query instead of stitching it together client-side. Confirming or
-- dismissing a flag is still just a direct RLS-guarded
-- `update flagged_listings set status = ...`.

create view flagged_listings_detail
with (security_invoker = true)
as
select
  fl.id,
  fl.status,
  fl.hamming_distance,
  fl.created_at,
  p1.id as photo_id,
  p1.url as photo_url,
  d1.id as dog_id,
  d1.name as dog_name,
  s1.id as shelter_id,
  s1.name as shelter_name,
  p2.id as matched_photo_id,
  p2.url as matched_photo_url,
  d2.id as matched_dog_id,
  d2.name as matched_dog_name,
  s2.id as matched_shelter_id,
  s2.name as matched_shelter_name
from flagged_listings fl
join dog_photos p1 on p1.id = fl.photo_id
join dogs d1 on d1.id = p1.dog_id
join shelters s1 on s1.id = d1.shelter_id
join dog_photos p2 on p2.id = fl.matched_photo_id
join dogs d2 on d2.id = p2.dog_id
join shelters s2 on s2.id = d2.shelter_id;

grant select on flagged_listings_detail to authenticated;
