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
