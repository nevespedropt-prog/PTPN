-- PTPN schema. Paste into Supabase Dashboard > SQL Editor > Run, then run seed.sql for the built-in library.

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role text not null default 'client' check (role in ('client','coach')),
  created_at timestamptz not null default now()
);

create table public.measurements (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  date date not null default current_date,
  weight_kg numeric,
  body_fat_pct numeric,
  notes text not null default '',
  created_at timestamptz not null default now()
);

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  starts_at timestamptz not null,
  duration_min int not null default 60,
  title text not null default 'PT session',
  created_at timestamptz not null default now()
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references public.sessions(id) on delete cascade,
  client_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- helper: is the caller a coach?
create function public.is_coach() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'coach');
$$;
revoke execute on function public.is_coach() from public, anon;
grant execute on function public.is_coach() to authenticated;

-- new users always start as clients
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
revoke execute on function public.handle_new_user() from public, anon, authenticated;

alter table public.profiles enable row level security;
alter table public.measurements enable row level security;
alter table public.sessions enable row level security;
alter table public.bookings enable row level security;

-- profiles: read own or all if coach; users edit own name only (role is locked)
create policy "profiles read" on public.profiles for select
  using (id = auth.uid() or public.is_coach());
create policy "profiles update own" on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid() and role = (select role from public.profiles where id = auth.uid()));
create policy "profiles coach update" on public.profiles for update using (public.is_coach());

-- measurements: client manages own, coach reads all
create policy "meas read" on public.measurements for select
  using (client_id = auth.uid() or public.is_coach());
create policy "meas insert own" on public.measurements for insert with check (client_id = auth.uid());
create policy "meas delete own" on public.measurements for delete using (client_id = auth.uid());

-- sessions: everyone signed in can see slots, coach manages them
create policy "sessions read" on public.sessions for select using (auth.uid() is not null);
create policy "sessions coach write" on public.sessions for all
  using (public.is_coach()) with check (public.is_coach());

-- bookings: unique(session_id) stops double booking
create policy "bookings read" on public.bookings for select using (client_id = auth.uid() or public.is_coach());
create policy "bookings insert own" on public.bookings for insert with check (client_id = auth.uid());
create policy "bookings delete own" on public.bookings for delete using (client_id = auth.uid() or public.is_coach());

-- Slots show as taken without exposing who booked them
create function public.booked_session_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select session_id from public.bookings;
$$;
revoke execute on function public.booked_session_ids() from public, anon;
grant execute on function public.booked_session_ids() to authenticated;

-- Habits and daily check-ins
create table public.habits (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  kind text not null default 'check' check (kind in ('check','number')),
  unit text not null default '',
  target numeric,
  active boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now()
);

create table public.habit_logs (
  id uuid primary key default gen_random_uuid(),
  habit_id uuid not null references public.habits(id) on delete cascade,
  client_id uuid not null references public.profiles(id) on delete cascade,
  date date not null default current_date,
  value numeric not null default 1,
  unique (habit_id, date)
);
create index habit_logs_client_date on public.habit_logs (client_id, date);

create table public.checkins (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  date date not null default current_date,
  mood int check (mood between 1 and 5),
  energy int check (energy between 1 and 5),
  sleep_hours numeric,
  note text not null default '',
  created_at timestamptz not null default now(),
  unique (client_id, date)
);

alter table public.habits enable row level security;
alter table public.habit_logs enable row level security;
alter table public.checkins enable row level security;

-- habits: client reads own, coach manages all
create policy "habits read" on public.habits for select
  using (client_id = auth.uid() or public.is_coach());
create policy "habits coach write" on public.habits for all
  using (public.is_coach()) with check (public.is_coach());

-- habit logs: client manages own (for their own habits only), coach reads all
create policy "hlogs read" on public.habit_logs for select
  using (client_id = auth.uid() or public.is_coach());
create policy "hlogs insert own" on public.habit_logs for insert
  with check (client_id = auth.uid() and exists (select 1 from public.habits h where h.id = habit_id and h.client_id = auth.uid()));
create policy "hlogs update own" on public.habit_logs for update
  using (client_id = auth.uid())
  with check (client_id = auth.uid() and exists (select 1 from public.habits h where h.id = habit_id and h.client_id = auth.uid()));
create policy "hlogs delete own" on public.habit_logs for delete using (client_id = auth.uid());

-- check-ins: client manages own, coach reads all
create policy "checkins read" on public.checkins for select
  using (client_id = auth.uid() or public.is_coach());
create policy "checkins insert own" on public.checkins for insert with check (client_id = auth.uid());
create policy "checkins update own" on public.checkins for update
  using (client_id = auth.uid()) with check (client_id = auth.uid());

-- Custom metrics and %1RM
create table public.metrics (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  unit text not null default '',
  lower_is_better boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.metric_logs (
  id uuid primary key default gen_random_uuid(),
  metric_id uuid not null references public.metrics(id) on delete cascade,
  client_id uuid not null references public.profiles(id) on delete cascade,
  date date not null default current_date,
  value numeric not null,
  unique (metric_id, date)
);
create index metric_logs_client_date on public.metric_logs (client_id, date);

create table public.one_rep_maxes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  exercise text not null,
  weight_kg numeric not null check (weight_kg > 0),
  date date not null default current_date,
  created_at timestamptz not null default now()
);
create index one_rep_maxes_client on public.one_rep_maxes (client_id, date);

alter table public.metrics enable row level security;
alter table public.metric_logs enable row level security;
alter table public.one_rep_maxes enable row level security;

-- metrics: client reads own, coach manages all
create policy "metrics read" on public.metrics for select
  using (client_id = auth.uid() or public.is_coach());
create policy "metrics coach write" on public.metrics for all
  using (public.is_coach()) with check (public.is_coach());

-- metric logs: client logs against own metrics, coach can log test results for any client
create policy "mlogs read" on public.metric_logs for select
  using (client_id = auth.uid() or public.is_coach());
create policy "mlogs insert" on public.metric_logs for insert
  with check (public.is_coach() or (client_id = auth.uid() and exists (select 1 from public.metrics m where m.id = metric_id and m.client_id = auth.uid())));
create policy "mlogs update" on public.metric_logs for update
  using (client_id = auth.uid() or public.is_coach())
  with check (public.is_coach() or (client_id = auth.uid() and exists (select 1 from public.metrics m where m.id = metric_id and m.client_id = auth.uid())));
create policy "mlogs delete" on public.metric_logs for delete
  using (client_id = auth.uid() or public.is_coach());

-- one-rep maxes: client and coach can record, client reads own, coach reads all
create policy "1rm read" on public.one_rep_maxes for select
  using (client_id = auth.uid() or public.is_coach());
create policy "1rm insert" on public.one_rep_maxes for insert
  with check (client_id = auth.uid() or public.is_coach());
create policy "1rm update" on public.one_rep_maxes for update
  using (client_id = auth.uid() or public.is_coach())
  with check (client_id = auth.uid() or public.is_coach());
create policy "1rm delete" on public.one_rep_maxes for delete
  using (client_id = auth.uid() or public.is_coach());

-- ========== Training: exercise library, workout builder, programmes, scheduling ==========
create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  muscle text not null default '',
  equipment text not null default '',
  category text not null default 'strength' check (category in ('strength','cardio','mobility','plyometric','core')),
  instructions text not null default '',
  video_url text not null default '',
  created_by uuid references public.profiles(id) on delete cascade, -- null = built-in library
  created_at timestamptz not null default now()
);
create unique index exercises_builtin_name on public.exercises (lower(name)) where created_by is null;

create table public.workouts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  format text not null default 'standard' check (format in ('standard','circuit','amrap','emom','intervals')),
  duration_min int check (duration_min > 0),
  rounds int check (rounds > 0),
  created_by uuid references public.profiles(id) on delete cascade, -- null = built-in template
  created_at timestamptz not null default now()
);

create table public.workout_items (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workouts(id) on delete cascade,
  exercise_id uuid references public.exercises(id) on delete set null,
  exercise_name text not null,
  sort int not null default 0,
  group_label text not null default '', -- items sharing a label form a superset / circuit block
  set_style text not null default 'single' check (set_style in ('single','superset','triset')),
  sets int check (sets > 0),
  reps text not null default '',
  load text not null default '',
  percent_1rm numeric check (percent_1rm > 0 and percent_1rm <= 150),
  rest_sec int check (rest_sec >= 0),
  tempo text not null default '',
  notes text not null default ''
);
create index workout_items_workout on public.workout_items (workout_id, sort);

create table public.programs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  goal text not null default '',
  level text not null default '',
  weeks int not null default 4 check (weeks between 1 and 52),
  created_by uuid references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.program_days (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  week int not null check (week >= 1),
  day int not null check (day between 1 and 7),
  workout_id uuid not null references public.workouts(id) on delete cascade,
  unique (program_id, week, day, workout_id)
);

create table public.client_workouts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  workout_id uuid not null references public.workouts(id) on delete cascade,
  date date not null,
  program_id uuid references public.programs(id) on delete set null,
  status text not null default 'scheduled' check (status in ('scheduled','done','skipped')),
  log jsonb not null default '{}'::jsonb,
  rating int check (rating between 1 and 5),
  client_note text not null default '',
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create index client_workouts_client_date on public.client_workouts (client_id, date);

create table public.client_session_credits (
  client_id uuid primary key references public.profiles(id) on delete cascade,
  sessions_purchased integer not null default 0 check (sessions_purchased >= 0),
  completed_baseline integer not null default 0 check (completed_baseline >= 0),
  updated_at timestamptz not null default now()
);
alter table public.client_session_credits enable row level security;
create policy "session credits read" on public.client_session_credits for select to authenticated
  using (client_id = (select auth.uid()) or (select public.is_coach()));
create policy "session credits coach insert" on public.client_session_credits for insert to authenticated
  with check ((select public.is_coach()));
create policy "session credits coach update" on public.client_session_credits for update to authenticated
  using ((select public.is_coach())) with check ((select public.is_coach()));
grant select, insert, update on public.client_session_credits to authenticated;

alter table public.exercises enable row level security;
alter table public.workouts enable row level security;
alter table public.workout_items enable row level security;
alter table public.programs enable row level security;
alter table public.program_days enable row level security;
alter table public.client_workouts enable row level security;

create policy "exercises read" on public.exercises for select using (auth.uid() is not null);
create policy "exercises insert" on public.exercises for insert with check (public.is_coach() and created_by = auth.uid());
create policy "exercises update" on public.exercises for update using (public.is_coach()) with check (public.is_coach());
create policy "exercises delete" on public.exercises for delete using (public.is_coach() and created_by is not null);

-- workouts: library templates visible to the coach; clients see built-ins, their own, and anything scheduled for them
create policy "workouts read" on public.workouts for select using (
  public.is_coach() or created_by is null or created_by = auth.uid()
  or exists (select 1 from public.client_workouts cw where cw.workout_id = workouts.id and cw.client_id = auth.uid()));
create policy "workouts insert" on public.workouts for insert with check (created_by = auth.uid());
create policy "workouts update" on public.workouts for update
  using (public.is_coach() or created_by = auth.uid()) with check (public.is_coach() or created_by = auth.uid());
create policy "workouts delete" on public.workouts for delete using (public.is_coach() or created_by = auth.uid());

create policy "items read" on public.workout_items for select
  using (exists (select 1 from public.workouts w where w.id = workout_id));
create policy "items write" on public.workout_items for all
  using (exists (select 1 from public.workouts w where w.id = workout_id and (public.is_coach() or w.created_by = auth.uid())))
  with check (exists (select 1 from public.workouts w where w.id = workout_id and (public.is_coach() or w.created_by = auth.uid())));

create policy "programs read" on public.programs for select using (auth.uid() is not null);
create policy "programs coach write" on public.programs for all using (public.is_coach()) with check (public.is_coach());
create policy "program days read" on public.program_days for select using (auth.uid() is not null);
create policy "program days coach write" on public.program_days for all using (public.is_coach()) with check (public.is_coach());

create policy "cw read" on public.client_workouts for select using (client_id = auth.uid() or public.is_coach());
create policy "cw insert" on public.client_workouts for insert with check (client_id = auth.uid() or public.is_coach());
create policy "cw update" on public.client_workouts for update
  using (client_id = auth.uid() or public.is_coach()) with check (client_id = auth.uid() or public.is_coach());
create policy "cw delete" on public.client_workouts for delete using (client_id = auth.uid() or public.is_coach());

-- ========== Nutrition: foods, recipes, targets, meal plans, food diary ==========
create table public.foods (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  serving_label text not null default '100 g',
  serving_g numeric not null default 100 check (serving_g > 0),
  kcal numeric not null default 0, -- all macros per 100 g
  protein numeric not null default 0,
  carbs numeric not null default 0,
  fat numeric not null default 0,
  created_by uuid references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  meal_type text not null default 'lunch' check (meal_type in ('breakfast','lunch','dinner','snack')),
  description text not null default '',
  prep_min int,
  kcal numeric not null default 0, -- per serving
  protein numeric not null default 0,
  carbs numeric not null default 0,
  fat numeric not null default 0,
  ingredients text[] not null default '{}',
  steps text[] not null default '{}',
  tags text[] not null default '{}',
  created_by uuid references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.nutrition_targets (
  client_id uuid primary key references public.profiles(id) on delete cascade,
  kcal int check (kcal > 0),
  protein int check (protein >= 0),
  carbs int check (carbs >= 0),
  fat int check (fat >= 0),
  notes text not null default '',
  updated_at timestamptz not null default now()
);

create table public.meal_plan_items (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  day int not null check (day between 1 and 7), -- 1 = Monday
  meal_type text not null check (meal_type in ('breakfast','lunch','dinner','snack')),
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  servings numeric not null default 1 check (servings > 0),
  sort int not null default 0
);
create index meal_plan_items_client on public.meal_plan_items (client_id, day);

create table public.food_logs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  date date not null default current_date,
  meal_type text not null check (meal_type in ('breakfast','lunch','dinner','snack')),
  name text not null,
  amount_label text not null default '',
  kcal numeric not null default 0,
  protein numeric not null default 0,
  carbs numeric not null default 0,
  fat numeric not null default 0,
  food_id uuid references public.foods(id) on delete set null,
  recipe_id uuid references public.recipes(id) on delete set null,
  created_at timestamptz not null default now()
);
create index food_logs_client_date on public.food_logs (client_id, date);

alter table public.foods enable row level security;
alter table public.recipes enable row level security;
alter table public.nutrition_targets enable row level security;
alter table public.meal_plan_items enable row level security;
alter table public.food_logs enable row level security;

create policy "foods read" on public.foods for select using (auth.uid() is not null);
create policy "foods insert" on public.foods for insert with check (created_by = auth.uid());
create policy "foods update" on public.foods for update using (created_by = auth.uid() or public.is_coach()) with check (created_by = auth.uid() or public.is_coach());
create policy "foods delete" on public.foods for delete using (created_by = auth.uid() or (public.is_coach() and created_by is not null));

create policy "recipes read" on public.recipes for select using (auth.uid() is not null);
create policy "recipes coach write" on public.recipes for all using (public.is_coach()) with check (public.is_coach());

create policy "targets read" on public.nutrition_targets for select using (client_id = auth.uid() or public.is_coach());
create policy "targets coach write" on public.nutrition_targets for all using (public.is_coach()) with check (public.is_coach());

create policy "meal plan read" on public.meal_plan_items for select using (client_id = auth.uid() or public.is_coach());
create policy "meal plan coach write" on public.meal_plan_items for all using (public.is_coach()) with check (public.is_coach());

create policy "food logs read" on public.food_logs for select using (client_id = auth.uid() or public.is_coach());
create policy "food logs insert own" on public.food_logs for insert with check (client_id = auth.uid());
create policy "food logs update own" on public.food_logs for update using (client_id = auth.uid()) with check (client_id = auth.uid());
create policy "food logs delete own" on public.food_logs for delete using (client_id = auth.uid());

-- ========== Messaging ==========
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade, -- the conversation (one per client)
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (length(body) between 1 and 4000),
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index messages_client_created on public.messages (client_id, created_at);
alter table public.messages enable row level security;

create policy "messages read" on public.messages for select using (client_id = auth.uid() or public.is_coach());
create policy "messages send" on public.messages for insert
  with check (sender_id = auth.uid() and (client_id = auth.uid() or public.is_coach()) and read_at is null);

-- marks the other side's messages as read; there is no general update policy, so bodies cannot be edited
create function public.mark_conversation_read(p_client uuid) returns void
language sql security definer set search_path = public as $$
  update public.messages set read_at = now()
  where client_id = p_client and sender_id <> auth.uid() and read_at is null
    and (p_client = auth.uid() or public.is_coach());
$$;
revoke execute on function public.mark_conversation_read(uuid) from public, anon;
grant execute on function public.mark_conversation_read(uuid) to authenticated;

-- ========== Progress photos (private storage bucket, one folder per client) ==========
create table public.progress_photos (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  path text not null,
  pose text not null default 'front' check (pose in ('front','side','back','other')),
  date date not null default current_date,
  created_at timestamptz not null default now()
);
create index progress_photos_client on public.progress_photos (client_id, date);
alter table public.progress_photos enable row level security;
create policy "photos read" on public.progress_photos for select using (client_id = auth.uid() or public.is_coach());
create policy "photos insert own" on public.progress_photos for insert
  with check (client_id = auth.uid() and split_part(path, '/', 1) = auth.uid()::text);
create policy "photos delete" on public.progress_photos for delete using (client_id = auth.uid() or public.is_coach());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('progress-photos', 'progress-photos', false, 10485760, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy "progress photos read" on storage.objects for select to authenticated
  using (bucket_id = 'progress-photos' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_coach()));
create policy "progress photos upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "progress photos delete" on storage.objects for delete to authenticated
  using (bucket_id = 'progress-photos' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_coach()));

-- ========== Community: announcements, challenges, resources ==========
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (length(body) between 1 and 4000),
  pinned boolean not null default false,
  publish_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
alter table public.posts enable row level security;
create policy "posts read" on public.posts for select using (public.is_coach() or (auth.uid() is not null and publish_at <= now()));
create policy "posts coach write" on public.posts for all using (public.is_coach()) with check (public.is_coach() and author_id = auth.uid());

create table public.challenges (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  unit text not null default '',
  goal numeric check (goal > 0),
  start_date date not null default current_date,
  end_date date not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);
create table public.challenge_entries (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  client_id uuid not null references public.profiles(id) on delete cascade,
  date date not null default current_date,
  value numeric not null check (value >= 0),
  created_at timestamptz not null default now(),
  unique (challenge_id, client_id, date)
);
alter table public.challenges enable row level security;
alter table public.challenge_entries enable row level security;
create policy "challenges read" on public.challenges for select using (auth.uid() is not null);
create policy "challenges coach write" on public.challenges for all using (public.is_coach()) with check (public.is_coach());
create policy "entries read" on public.challenge_entries for select using (client_id = auth.uid() or public.is_coach());
create policy "entries insert own" on public.challenge_entries for insert with check (client_id = auth.uid());
create policy "entries update own" on public.challenge_entries for update using (client_id = auth.uid()) with check (client_id = auth.uid());
create policy "entries delete own" on public.challenge_entries for delete using (client_id = auth.uid() or public.is_coach());

-- leaderboard shows first names and totals only, without opening up profiles or other people's entries
create function public.challenge_leaderboard(p_challenge uuid)
returns table (client_id uuid, display_name text, total numeric)
language sql stable security definer set search_path = public as $$
  select e.client_id, coalesce(nullif(split_part(p.full_name, ' ', 1), ''), 'Member'), sum(e.value)
  from public.challenge_entries e join public.profiles p on p.id = e.client_id
  where e.challenge_id = p_challenge and auth.uid() is not null
  group by e.client_id, p.full_name
  order by 3 desc
  limit 100;
$$;
revoke execute on function public.challenge_leaderboard(uuid) from public, anon;
grant execute on function public.challenge_leaderboard(uuid) to authenticated;

create table public.resources (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  url text not null check (url ~* '^https?://'),
  category text not null default '',
  description text not null default '',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.resources enable row level security;
create policy "resources read" on public.resources for select using (auth.uid() is not null);
create policy "resources coach write" on public.resources for all using (public.is_coach()) with check (public.is_coach());

-- live chat updates
alter publication supabase_realtime add table public.messages;

-- To make yourself the coach, after signing up once:
-- update public.profiles set role = 'coach' where id = (select id from auth.users where email = 'YOUR@EMAIL');


-- ========== v3: meal plan library (templates and recipe photos) ==========
alter table public.recipes add column if not exists image_url text;

create table if not exists public.meal_plan_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  goal text not null default 'Balanced',
  kcal int not null default 2000,
  description text not null default '',
  image_url text,
  plan_no int,
  created_by uuid references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.meal_plan_template_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.meal_plan_templates(id) on delete cascade,
  day int not null check (day between 1 and 7),
  meal_type text not null check (meal_type in ('breakfast','lunch','dinner','snack')),
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  servings numeric not null default 1 check (servings > 0),
  sort int not null default 0
);
create index if not exists meal_plan_template_items_tpl on public.meal_plan_template_items (template_id, day);

alter table public.meal_plan_templates enable row level security;
alter table public.meal_plan_template_items enable row level security;
create policy "meal templates read" on public.meal_plan_templates for select using (auth.uid() is not null);
create policy "meal templates coach write" on public.meal_plan_templates for all using (public.is_coach()) with check (public.is_coach());
create policy "meal template items read" on public.meal_plan_template_items for select using (auth.uid() is not null);
create policy "meal template items coach write" on public.meal_plan_template_items for all using (public.is_coach()) with check (public.is_coach());

-- ========== v4: push notifications (tables) ==========
-- One row per browser/phone that turned notifications on.
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
create policy "push own read" on public.push_subscriptions for select using (user_id = auth.uid());
create policy "push own insert" on public.push_subscriptions for insert with check (user_id = auth.uid());
create policy "push own update" on public.push_subscriptions for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "push own delete" on public.push_subscriptions for delete using (user_id = auth.uid());

-- Server-only settings (VAPID keys, shared secret, app address). RLS is on with no policies and
-- no grants, so only the service role (the send-push function) can read it.
create table if not exists public.push_config (
  id int primary key default 1 check (id = 1),
  vapid_public text not null,
  vapid_private text not null,
  subject text not null default 'mailto:nevespedro.pt@gmail.com',
  secret text not null,
  app_url text not null
);
alter table public.push_config enable row level security;
revoke all on public.push_config from anon, authenticated;

-- The public half of the key is safe to share: the app needs it to subscribe.
create or replace function public.push_public_key() returns text
language sql stable security definer set search_path = public as $$
  select vapid_public from public.push_config where id = 1 $$;
revoke execute on function public.push_public_key() from public, anon;
grant execute on function public.push_public_key() to authenticated;

-- Announcements are pushed once; scheduled ones go out when their time arrives.
alter table public.posts add column if not exists pushed_at timestamptz;

-- Booked PT sessions get one reminder on the first reminder run at or inside eight hours.
alter table public.bookings add column if not exists reminder_sent_at timestamptz;
create index if not exists bookings_reminder_pending on public.bookings (session_id) where reminder_sent_at is null;

create or replace function public.claim_booking_reminders()
returns table (booking_id uuid, client_id uuid, starts_at timestamptz, title text)
language sql volatile security invoker set search_path = public as $$
  with due as (
    select b.id
    from public.bookings b
    join public.sessions s on s.id = b.session_id
    where b.reminder_sent_at is null
      and s.starts_at > now()
      and s.starts_at <= now() + interval '8 hours'
    order by s.starts_at
    for update of b skip locked
  )
  update public.bookings b
  set reminder_sent_at = now()
  from due, public.sessions s
  where b.id = due.id and s.id = b.session_id
  returning b.id, b.client_id, s.starts_at, s.title
$$;
revoke execute on function public.claim_booking_reminders() from public, anon, authenticated;
grant execute on function public.claim_booking_reminders() to service_role;

-- ========== v5: health information and data consent ==========
-- One row per client. Health data is special category data, so we keep explicit, dated consent with a version.
create table if not exists public.client_health (
  client_id uuid primary key references public.profiles(id) on delete cascade,
  allergies text not null default '',
  health_conditions text not null default '',
  medications text not null default '',
  emergency_contact text not null default '',
  consent_data boolean not null default false,
  consent_health boolean not null default false,
  consent_accurate boolean not null default false,
  consent_version int not null default 1,
  consented_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.client_health enable row level security;
create policy "health read own or coach" on public.client_health for select using (client_id = auth.uid() or public.is_coach());
create policy "health insert own" on public.client_health for insert with check (client_id = auth.uid());
create policy "health update own" on public.client_health for update using (client_id = auth.uid()) with check (client_id = auth.uid());


-- v6: weight and effort wording, cardio targets (time, distance, speed)
alter table public.workout_items add column if not exists weight text not null default '';              -- kg ("80"), percent of the client's max ("75%") or text ("bodyweight")
alter table public.workout_items add column if not exists cardio_time text not null default '';          -- "20:00", "1:00", or minutes
alter table public.workout_items add column if not exists cardio_distance_km numeric check (cardio_distance_km >= 0);
alter table public.workout_items add column if not exists cardio_speed_kmh numeric check (cardio_speed_kmh >= 0);
-- Existing percent-of-max prescriptions show up in the new Weight field as "75%".
update public.workout_items set weight = (percent_1rm::float8)::text || '%' where weight = '' and percent_1rm is not null;
-- Coach-only client filing. Removing this marker restores a client; no history is deleted.
create table public.client_archives (
  client_id uuid primary key references public.profiles(id) on delete cascade,
  archived_at timestamptz not null default now()
);
alter table public.client_archives enable row level security;
revoke all on public.client_archives from public, anon, authenticated;
grant select, insert, delete on public.client_archives to authenticated;
grant all on public.client_archives to service_role;
create policy "coach reads client archives" on public.client_archives
  for select to authenticated using ((select public.is_coach()));
create policy "coach archives clients" on public.client_archives
  for insert to authenticated with check (
    (select public.is_coach()) and exists (
      select 1 from public.profiles p where p.id = client_id and p.role = 'client'
    )
  );
create policy "coach restores clients" on public.client_archives
  for delete to authenticated using ((select public.is_coach()));


-- Weekly submissions are immutable; coach feedback has separate permissions.
create table public.weekly_checkins (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  week_start date not null check (extract(isodow from week_start) = 1),
  training text not null check (length(btrim(training)) between 1 and 2000),
  nutrition text not null check (length(btrim(nutrition)) between 1 and 2000),
  sleep_hours numeric not null check (sleep_hours between 0 and 24),
  energy smallint not null check (energy between 1 and 5),
  biggest_win text not null check (length(btrim(biggest_win)) between 1 and 2000),
  difficulties text not null check (length(btrim(difficulties)) between 1 and 2000),
  submitted_at timestamptz not null default now(),
  unique (client_id, week_start)
);
create table public.weekly_reviews (
  checkin_id uuid primary key references public.weekly_checkins(id) on delete cascade,
  feedback text not null check (length(btrim(feedback)) between 1 and 2000),
  next_focus text not null check (length(btrim(next_focus)) between 1 and 1000)
);
alter table public.weekly_checkins enable row level security;
alter table public.weekly_reviews enable row level security;
revoke all on public.weekly_checkins, public.weekly_reviews from anon, authenticated;
grant select, insert on public.weekly_checkins to authenticated;
grant select, insert, update on public.weekly_reviews to authenticated;
create policy "weekly checkins read" on public.weekly_checkins for select to authenticated
  using (client_id = (select auth.uid()) or (select public.is_coach()));
create policy "weekly checkins submit own" on public.weekly_checkins for insert to authenticated
  with check (client_id = (select auth.uid()) and not (select public.is_coach()));
create policy "weekly reviews read" on public.weekly_reviews for select to authenticated
  using (exists (select 1 from public.weekly_checkins c where c.id = checkin_id));
create policy "weekly reviews insert coach" on public.weekly_reviews for insert to authenticated
  with check ((select public.is_coach()));
create policy "weekly reviews update coach" on public.weekly_reviews for update to authenticated
  using ((select public.is_coach())) with check ((select public.is_coach()));

-- Personal meal snapshots for quick reuse in the existing food diary.
create table public.saved_meals (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (name = btrim(name) and length(name) between 1 and 80),
  items jsonb not null check (
    jsonb_typeof(items) = 'array' and jsonb_array_length(items) between 1 and 100
    and octet_length(items::text) <= 65536
  ),
  unique (client_id, name)
);
alter table public.saved_meals enable row level security;
revoke all on public.saved_meals from anon, authenticated;
grant select, insert, delete on public.saved_meals to authenticated;
create policy "saved meals read" on public.saved_meals for select to authenticated
  using (client_id = (select auth.uid()) or (select public.is_coach()));
create policy "saved meals insert own" on public.saved_meals for insert to authenticated
  with check (client_id = (select auth.uid()));
create policy "saved meals delete own" on public.saved_meals for delete to authenticated
  using (client_id = (select auth.uid()));

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

-- ========== Coach taster session and fitness assessment ==========
create table public.taster_sessions (
  id uuid primary key default gen_random_uuid(), client_id uuid not null references public.profiles(id) on delete cascade,
  assessed_on date not null default current_date, goal text not null check (length(btrim(goal)) between 1 and 1200), target_date date not null,
  date_of_birth date not null, sex text not null check (sex in ('female','male')),
  activity_level text not null check (activity_level in ('sedentary','light','moderate','very','extra')),
  height_cm numeric not null check (height_cm between 100 and 250), weight_kg numeric not null check (weight_kg between 20 and 400),
  target_weight_kg numeric not null check (target_weight_kg between 20 and 400), body_fat_pct numeric check (body_fat_pct between 0 and 100), target_body_fat_pct numeric check (target_body_fat_pct between 0 and 100),
  bmi numeric not null check (bmi between 5 and 100), target_bmi numeric not null check (target_bmi between 5 and 100),
  bmr_kcal int not null check (bmr_kcal between 500 and 10000), target_bmr_kcal int not null check (target_bmr_kcal between 500 and 10000),
  estimated_maintenance_kcal int not null check (estimated_maintenance_kcal between 500 and 10000),
  target_kcal int not null check (target_kcal between 500 and 10000), target_protein int not null check (target_protein >= 0),
  target_carbs int not null check (target_carbs >= 0), target_fat int not null check (target_fat >= 0),
  job_description text not null default '' check (length(job_description) <= 500),
  fitness_level text not null default 'beginner' check (fitness_level in ('beginner','intermediate','advanced','athlete')),
  diet text not null default '' check (length(diet) <= 1200),
  goal_metric_label text not null default '' check (length(goal_metric_label) <= 80),
  goal_metric_current text not null default '' check (length(goal_metric_current) <= 80),
  goal_metric_target text not null default '' check (length(goal_metric_target) <= 80),
  goal_metric_unit text not null default '' check (length(goal_metric_unit) <= 40),
  new_habit text not null default '' check (length(new_habit) <= 200),
  emergency_contact_name text not null default '' check (length(emergency_contact_name) <= 160),
  emergency_contact_phone text not null default '' check (length(emergency_contact_phone) <= 80),
  emergency_contact_email text not null default '' check (length(emergency_contact_email) <= 320),
  parq_answers jsonb not null default '{}'::jsonb check (jsonb_typeof(parq_answers) = 'object'),
  parq_health_details text not null default '' check (length(parq_health_details) <= 2400),
  parq_injury_details text not null default '' check (length(parq_injury_details) <= 1600),
  parq_medication_details text not null default '' check (length(parq_medication_details) <= 1600),
  parq_allergy_details text not null default '' check (length(parq_allergy_details) <= 1600),
  parq_health_storage_consent boolean not null default false,
  parq_health_storage_consented_at timestamptz,
  parq_exercise_consent boolean not null default false,
  parq_consented_at timestamptz,
  client_summary text not null default '' check (length(client_summary) <= 2400), coach_notes text not null default '' check (length(coach_notes) <= 4000),
  created_by uuid not null references public.profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index taster_sessions_client_date on public.taster_sessions (client_id, assessed_on desc, created_at desc);
create table public.fitness_assessment_items (
  id uuid primary key default gen_random_uuid(), taster_session_id uuid not null references public.taster_sessions(id) on delete cascade,
  exercise_id uuid references public.exercises(id) on delete set null, exercise_name text not null check (length(btrim(exercise_name)) between 1 and 200),
  category text not null default '', result text not null default '' check (length(result) <= 200), unit text not null default '' check (length(unit) <= 80),
  notes text not null default '' check (length(notes) <= 1200), sort int not null default 0
);
create index fitness_assessment_items_session on public.fitness_assessment_items (taster_session_id, sort);
alter table public.measurements add column taster_session_id uuid unique references public.taster_sessions(id) on delete set null;
alter table public.taster_sessions enable row level security;
alter table public.fitness_assessment_items enable row level security;
revoke all on public.taster_sessions, public.fitness_assessment_items from anon, authenticated;
grant select, insert, update, delete on public.taster_sessions, public.fitness_assessment_items to authenticated;
create policy "taster read own or coach" on public.taster_sessions for select to authenticated using (client_id = (select auth.uid()) or (select public.is_coach()));
create policy "taster coach insert" on public.taster_sessions for insert to authenticated with check ((select public.is_coach()) and created_by = (select auth.uid()));
create policy "taster coach update" on public.taster_sessions for update to authenticated using ((select public.is_coach())) with check ((select public.is_coach()));
create policy "taster coach delete" on public.taster_sessions for delete to authenticated using ((select public.is_coach()));
create policy "assessment items coach read" on public.fitness_assessment_items for select to authenticated using ((select public.is_coach()));
create policy "assessment items client read own" on public.fitness_assessment_items for select to authenticated using (exists (select 1 from public.taster_sessions t where t.id = taster_session_id and t.client_id = (select auth.uid())));
create policy "assessment items coach insert" on public.fitness_assessment_items for insert to authenticated with check ((select public.is_coach()) and exists (select 1 from public.taster_sessions t where t.id = taster_session_id));
create policy "assessment items coach update" on public.fitness_assessment_items for update to authenticated using ((select public.is_coach())) with check ((select public.is_coach()));
create policy "assessment items coach delete" on public.fitness_assessment_items for delete to authenticated using ((select public.is_coach()));
create policy "meas coach insert" on public.measurements for insert to authenticated with check ((select public.is_coach()));
create policy "meas coach update" on public.measurements for update to authenticated using ((select public.is_coach())) with check ((select public.is_coach()));
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

-- Client onboarding (v11)
-- Optional client setup, kept separate from health consent and coaching plans.
create table public.client_onboarding (
  client_id uuid primary key references public.profiles(id) on delete cascade,
  goals text not null check (length(btrim(goals)) between 1 and 1200),
  experience text not null check (experience in ('beginner', 'returning', 'regular')),
  equipment text not null check (length(btrim(equipment)) between 1 and 1200),
  preferred_days smallint[] not null check (
    cardinality(preferred_days) between 1 and 7
    and preferred_days <@ array[1,2,3,4,5,6,7]::smallint[]
    and array_position(preferred_days, null) is null
  ),
  food_preferences text not null default '' check (length(food_preferences) <= 1200),
  training_ready boolean not null default false,
  nutrition_ready boolean not null default false,
  contact_ready boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.client_onboarding enable row level security;
revoke all on public.client_onboarding from anon, authenticated;
grant select, insert, update on public.client_onboarding to authenticated;
create policy "onboarding read own or coach" on public.client_onboarding for select to authenticated
  using (client_id = (select auth.uid()) or (select public.is_coach()));
create policy "onboarding insert own" on public.client_onboarding for insert to authenticated
  with check (client_id = (select auth.uid()) and not (select public.is_coach()));
create policy "onboarding update own" on public.client_onboarding for update to authenticated
  using (client_id = (select auth.uid()) and not (select public.is_coach()))
  with check (client_id = (select auth.uid()) and not (select public.is_coach()));


-- Monthly coach reviews (v12)
-- Coach-written monthly reviews, separate from the live training/measurement summary.
create table public.monthly_reviews (
  client_id uuid not null references public.profiles(id) on delete cascade,
  month_start date not null check (extract(day from month_start) = 1),
  feedback text not null check (length(btrim(feedback)) between 1 and 2000),
  next_focus text not null check (length(btrim(next_focus)) between 1 and 1000),
  updated_at timestamptz not null default now(),
  primary key (client_id, month_start)
);
alter table public.monthly_reviews enable row level security;
revoke all on public.monthly_reviews from anon, authenticated;
grant select, insert, update on public.monthly_reviews to authenticated;
create policy "monthly reviews read own or coach" on public.monthly_reviews for select to authenticated
  using (client_id = (select auth.uid()) or (select public.is_coach()));
create policy "monthly reviews insert coach" on public.monthly_reviews for insert to authenticated
  with check ((select public.is_coach()));
create policy "monthly reviews update coach" on public.monthly_reviews for update to authenticated
  using ((select public.is_coach())) with check ((select public.is_coach()));


-- Approved exercise alternatives (v13)
-- Coach approval lives on the template; the chosen prescription is snapshotted per session.
create table public.workout_alternatives (
  id uuid primary key default gen_random_uuid(),
  workout_item_id uuid not null references public.workout_items(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  exercise_name text not null check (length(btrim(exercise_name)) between 1 and 300),
  is_cardio boolean not null default false,
  sets smallint not null check (sets between 1 and 20),
  reps text not null default '' check (length(reps) <= 100),
  rest_sec integer not null default 90 check (rest_sec between 0 and 3600),
  notes text not null default '' check (length(notes) <= 1000),
  cardio_time text not null default '' check (length(cardio_time) <= 40),
  cardio_distance_km numeric check (cardio_distance_km > 0),
  cardio_speed_kmh numeric check (cardio_speed_kmh > 0),
  unique (workout_item_id, exercise_id)
);
alter table public.workout_alternatives enable row level security;
revoke all on public.workout_alternatives from anon, authenticated;
grant select, insert, update, delete on public.workout_alternatives to authenticated;
create policy "alternatives read assigned" on public.workout_alternatives for select to authenticated
  using (exists (select 1 from public.workout_items wi where wi.id = workout_item_id));
create policy "alternatives coach insert" on public.workout_alternatives for insert to authenticated with check ((select public.is_coach()));
create policy "alternatives coach update" on public.workout_alternatives for update to authenticated
  using ((select public.is_coach())) with check ((select public.is_coach()));
create policy "alternatives coach delete" on public.workout_alternatives for delete to authenticated using ((select public.is_coach()));

-- Invoker rights: enforce approval and retain unchanged historical snapshots after withdrawal.
create function public.validate_exercise_choices() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare
  before_choices jsonb := '{}'::jsonb;
  after_choices jsonb := coalesce(new.log->'exercise_choices', '{}'::jsonb);
  item_key text; selected jsonb; expected jsonb; wi public.workout_items%rowtype; alt public.workout_alternatives%rowtype;
begin
  if tg_op = 'UPDATE' then before_choices := coalesce(old.log->'exercise_choices', '{}'::jsonb); end if;
  if jsonb_typeof(after_choices) <> 'object' then raise exception 'Exercise choices must be an object'; end if;
  if tg_op = 'UPDATE' and new.workout_id <> old.workout_id and (before_choices <> '{}'::jsonb or after_choices <> '{}'::jsonb) then
    raise exception 'A session with exercise choices cannot change template';
  end if;
  for item_key in select jsonb_object_keys(before_choices || after_choices) loop
    if before_choices->item_key is not distinct from after_choices->item_key then continue; end if;
    if new.status <> 'scheduled' then raise exception 'Only unfinished sessions can change exercise'; end if;
    if tg_op = 'UPDATE' then
      if old.status <> 'scheduled' or exists (select 1 from jsonb_array_elements(coalesce(old.log->'items'->item_key, '[]'::jsonb)) s where s->>'done' = 'true') then
        raise exception 'This exercise already has completed sets';
      end if;
    end if;
    select * into wi from public.workout_items where id::text = item_key and workout_id = new.workout_id;
    if not found then raise exception 'Exercise is not in this workout'; end if;
    if exists (select 1 from jsonb_array_elements(coalesce(new.log->'items'->item_key, '[]'::jsonb)) s where s->>'done' = 'true') then
      raise exception 'Switch exercise before completing sets';
    end if;
    selected := after_choices->item_key;
    if selected is null then continue; end if; -- restore the original exercise
    select * into alt from public.workout_alternatives where id::text = selected->>'alternative_id' and workout_item_id = wi.id;
    if not found then raise exception 'This alternative is no longer approved'; end if;
    expected := jsonb_build_object('alternative_id', alt.id, 'is_cardio', alt.is_cardio, 'item',
      to_jsonb(wi) || jsonb_build_object('exercise_id', alt.exercise_id, 'exercise_name', alt.exercise_name,
        'sets', alt.sets, 'reps', alt.reps, 'rest_sec', alt.rest_sec, 'notes', alt.notes,
        'weight', '', 'percent_1rm', null, 'load', '', 'tempo', '', 'cardio_time', alt.cardio_time,
        'cardio_distance_km', alt.cardio_distance_km, 'cardio_speed_kmh', alt.cardio_speed_kmh));
    if selected <> expected then raise exception 'The alternative prescription changed. Reload before switching'; end if;
  end loop;
  return new;
end $$;
revoke all on function public.validate_exercise_choices() from public, anon, authenticated;
create trigger validate_session_exercise_choices before insert or update of log, workout_id, status on public.client_workouts
  for each row execute function public.validate_exercise_choices();

-- New technique clips use the actual session exercise, including preserved snapshots.
drop policy "exercise videos submit own" on public.exercise_videos;
create policy "exercise videos submit own" on public.exercise_videos for insert to authenticated
  with check (client_id = (select auth.uid()) and exists (
    select 1 from public.client_workouts cw where cw.id = client_workout_id and cw.client_id = (select auth.uid())
    and coalesce(cw.log->'exercise_choices'->(workout_item_id::text)->'item'->>'exercise_name',
      (select wi.exercise_name from public.workout_items wi where wi.id = workout_item_id and wi.workout_id = cw.workout_id)) = exercise_videos.exercise_name
  ));

