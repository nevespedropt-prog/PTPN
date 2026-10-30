-- v29: thumbnails for the Workout videos page.
-- The coach picks a picture (for example a screenshot of the video) for each video. It is stored in a public bucket
-- (the pictures are not sensitive), only the coach can add or remove them, and the video row remembers the path.
alter table public.resources add column if not exists thumbnail_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('video-thumbnails', 'video-thumbnails', true, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

drop policy if exists "video thumbnails read" on storage.objects;
create policy "video thumbnails read" on storage.objects for select to authenticated
  using (bucket_id = 'video-thumbnails');
drop policy if exists "video thumbnails coach upload" on storage.objects;
create policy "video thumbnails coach upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'video-thumbnails' and (select public.is_coach()));
drop policy if exists "video thumbnails coach update" on storage.objects;
create policy "video thumbnails coach update" on storage.objects for update to authenticated
  using (bucket_id = 'video-thumbnails' and (select public.is_coach()));
drop policy if exists "video thumbnails coach delete" on storage.objects;
create policy "video thumbnails coach delete" on storage.objects for delete to authenticated
  using (bucket_id = 'video-thumbnails' and (select public.is_coach()));
