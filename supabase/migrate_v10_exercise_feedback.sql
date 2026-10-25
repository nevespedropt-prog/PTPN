-- Private technique clips with separately protected coach responses.
create table public.exercise_videos (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  client_workout_id uuid not null references public.client_workouts(id) on delete cascade,
  workout_item_id uuid not null,
  exercise_name text not null check (length(btrim(exercise_name)) between 1 and 300),
  question text not null default '' check (length(question) <= 1000),
  video_path text not null unique check (split_part(video_path, '/', 1) = client_id::text and split_part(video_path, '/', 2) = id::text),
  created_at timestamptz not null default now()
);
create index exercise_videos_workout on public.exercise_videos(client_workout_id, workout_item_id);
create index exercise_videos_client on public.exercise_videos(client_id);
create table public.exercise_video_reviews (
  video_id uuid primary key references public.exercise_videos(id) on delete cascade,
  feedback text not null default '' check (length(feedback) <= 4000),
  audio_path text check (audio_path is null or split_part(audio_path, '/', 2) = video_id::text),
  check (length(btrim(feedback)) > 0 or audio_path is not null)
);
alter table public.exercise_videos enable row level security;
alter table public.exercise_video_reviews enable row level security;
revoke all on public.exercise_videos, public.exercise_video_reviews from anon, authenticated;
grant select, insert on public.exercise_videos to authenticated;
grant select, insert, update on public.exercise_video_reviews to authenticated;
create policy "exercise videos read" on public.exercise_videos for select to authenticated
  using (client_id = (select auth.uid()) or (select public.is_coach()));
create policy "exercise videos submit own" on public.exercise_videos for insert to authenticated
  with check (client_id = (select auth.uid()) and exists (
    select 1 from public.client_workouts cw join public.workout_items wi on wi.workout_id = cw.workout_id
    where cw.id = client_workout_id and cw.client_id = (select auth.uid()) and wi.id = workout_item_id and wi.exercise_name = exercise_videos.exercise_name
  ));
create policy "exercise video reviews read" on public.exercise_video_reviews for select to authenticated
  using (exists (select 1 from public.exercise_videos v where v.id = video_id));
create policy "exercise video reviews insert coach" on public.exercise_video_reviews for insert to authenticated
  with check ((select public.is_coach()));
create policy "exercise video reviews update coach" on public.exercise_video_reviews for update to authenticated
  using ((select public.is_coach())) with check ((select public.is_coach()));

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types) values
  ('exercise-videos','exercise-videos',false,20971520,array['video/mp4','video/webm','video/quicktime']),
  ('exercise-voice','exercise-voice',false,5242880,array['audio/mp4','audio/webm','audio/ogg','audio/mpeg','audio/wav','audio/aac'])
on conflict (id) do nothing;
create policy "exercise clips read" on storage.objects for select to authenticated
  using (bucket_id in ('exercise-videos','exercise-voice') and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_coach())));
create policy "exercise clips upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'exercise-videos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "exercise clips cleanup own" on storage.objects for delete to authenticated
  using (bucket_id = 'exercise-videos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "exercise voice upload coach" on storage.objects for insert to authenticated
  with check (bucket_id = 'exercise-voice' and (select public.is_coach()));
create policy "exercise voice cleanup coach" on storage.objects for delete to authenticated
  using (bucket_id = 'exercise-voice' and (select public.is_coach()));