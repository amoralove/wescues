-- Lets a platform_admin permanently delete a dog (used from the
-- moderation dashboard for a confirmed fake/duplicate listing, as an
-- alternative to hiding). This cascades: dog_photos, applications, and
-- any flagged_listings referencing this dog's photos are all deleted too
-- (see the foreign keys in the initial schema and photo_dedup migrations).
-- Unlike hide/unhide, this is not reversible.

create policy "platform admins can delete any dog"
  on dogs for delete
  to authenticated
  using (is_platform_admin());
