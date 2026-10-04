-- PTPN schema. Paste into Supabase Dashboard > SQL Editor > Run.

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role text not null default 'client' check (role in ('client','coach')),
  created_at timestamptz not null default now()
);

create table public.programmes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  notes text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.programme_exercises (
  id uuid primary key default gen_random_uuid(),
  programme_id uuid not null references public.programmes(id) on delete cascade,
  day_label text not null default 'Day 1',
  exercise text not null,
  sets int,
  reps text,
  notes text not null default '',
  sort int not null default 0
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
alter table public.programmes enable row level security;
alter table public.programme_exercises enable row level security;
alter table public.measurements enable row level security;
alter table public.sessions enable row level security;
alter table public.bookings enable row level security;

-- profiles: read own or all if coach; users edit own name only (role is locked)
create policy "profiles read" on public.profiles for select
  using (id = auth.uid() or public.is_coach());
create policy "profiles update own" on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid() and role = (select role from public.profiles where id = auth.uid()));
create policy "profiles coach update" on public.profiles for update using (public.is_coach());

-- programmes: client reads own, coach manages all
create policy "programmes read" on public.programmes for select
  using (client_id = auth.uid() or public.is_coach());
create policy "programmes coach write" on public.programmes for all
  using (public.is_coach()) with check (public.is_coach());

create policy "pex read" on public.programme_exercises for select
  using (public.is_coach() or exists (select 1 from public.programmes p where p.id = programme_id and p.client_id = auth.uid()));
create policy "pex coach write" on public.programme_exercises for all
  using (public.is_coach()) with check (public.is_coach());

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

-- To make yourself the coach, after signing up once:
-- update public.profiles set role = 'coach' where id = (select id from auth.users where email = 'YOUR@EMAIL');
