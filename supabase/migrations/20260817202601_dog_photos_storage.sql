-- Storage bucket dog photos are actually uploaded to. Files are keyed
-- <shelter_id>/<filename> so ownership can be checked from the path alone.

insert into storage.buckets (id, name, public)
values ('dog-photos', 'dog-photos', true)
on conflict (id) do nothing;

create policy "shelter staff can upload photos to their own folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'dog-photos'
    and (storage.foldername(name))[1] = auth_shelter_id()::text
  );

create policy "shelter staff can update photos in their own folder"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'dog-photos'
    and (storage.foldername(name))[1] = auth_shelter_id()::text
  );

create policy "shelter staff can delete photos in their own folder"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'dog-photos'
    and (storage.foldername(name))[1] = auth_shelter_id()::text
  );

create policy "dog photos bucket is publicly readable"
  on storage.objects for select
  using (bucket_id = 'dog-photos');
