-- Website backend (enquiries, packages, payments) brought into the repo, plus security fixes.
-- These objects were first applied straight to Supabase (website_backend_v1 and later migrations).
-- Safe to run on a database that already has them.

create table if not exists public.enquiries (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone text not null default '',
  package text not null default 'Not sure yet, advise me',
  goal text not null default '',
  frequency text not null default '',
  message text not null default '',
  status text not null default 'new' check (status in ('new','contacted','converted','lost','spam')),
  created_at timestamptz not null default now(),
  first_name text not null default '',
  last_name text not null default '',
  gender text not null default '',
  marketing boolean not null default false
);
create index if not exists enquiries_created on public.enquiries (created_at desc);
create index if not exists enquiries_status on public.enquiries (status);

create table if not exists public.client_packages (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  package_name text not null check (package_name in ('Express','Ignition','Momentum','Signature','Duo')),
  sessions_total integer not null check (sessions_total > 0),
  sessions_used integer not null default 0 check (sessions_used >= 0),
  total_gbp numeric not null check (total_gbp >= 0),
  status text not null default 'active' check (status in ('active','completed','cancelled')),
  started_on date not null default current_date,
  notes text not null default '',
  created_at timestamptz not null default now(),
  constraint sessions_used_lte_total check (sessions_used <= sessions_total)
);
create index if not exists client_packages_client on public.client_packages (client_id);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  package_id uuid references public.client_packages(id) on delete set null,
  amount_gbp numeric not null check (amount_gbp <> 0),
  method text not null default 'cash' check (method in ('cash','bank','other')),
  paid_on date not null default current_date,
  note text not null default '',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists payments_client on public.payments (client_id, paid_on desc);

alter table public.enquiries enable row level security;
alter table public.client_packages enable row level security;
alter table public.payments enable row level security;

-- Policies as they exist live. Coach manages everything; a client reads only their own packages and payments.
-- Enquiries: anyone (the public website form) may insert, only the coach reads, updates or deletes.
drop policy if exists "packages coach write" on public.client_packages;
create policy "packages coach write" on public.client_packages for all using (public.is_coach()) with check (public.is_coach());
drop policy if exists "packages read own or coach" on public.client_packages;
create policy "packages read own or coach" on public.client_packages for select using (client_id = auth.uid() or public.is_coach());
drop policy if exists "payments coach write" on public.payments;
create policy "payments coach write" on public.payments for all using (public.is_coach()) with check (public.is_coach());
drop policy if exists "payments read own or coach" on public.payments;
create policy "payments read own or coach" on public.payments for select using (client_id = auth.uid() or public.is_coach());
drop policy if exists "enquiries insert anyone" on public.enquiries;
create policy "enquiries insert anyone" on public.enquiries for insert with check (true);
drop policy if exists "enquiries read coach" on public.enquiries;
create policy "enquiries read coach" on public.enquiries for select using (public.is_coach());
drop policy if exists "enquiries update coach" on public.enquiries;
create policy "enquiries update coach" on public.enquiries for update using (public.is_coach()) with check (public.is_coach());
drop policy if exists "enquiries delete coach" on public.enquiries;
create policy "enquiries delete coach" on public.enquiries for delete using (public.is_coach());

-- Nobody without a login touches these tables. Signed-in users get only what RLS then allows.
revoke all on public.enquiries, public.client_packages, public.payments from anon;
grant insert on public.enquiries to anon; -- the public website form
revoke truncate, references, trigger on public.enquiries, public.client_packages, public.payments from authenticated;

-- Balance per client. Runs with the caller's rights, so the coach sees everyone and a client only their own.
create or replace view public.client_balances with (security_invoker = true) as
select p.id as client_id,
  coalesce(pkg.owed, 0::numeric) as owed_gbp,
  coalesce(pay.paid, 0::numeric) as paid_gbp,
  coalesce(pkg.owed, 0::numeric) - coalesce(pay.paid, 0::numeric) as balance_gbp
from public.profiles p
left join (select client_id, sum(total_gbp) as owed from public.client_packages where status <> 'cancelled' group by client_id) pkg on pkg.client_id = p.id
left join (select client_id, sum(amount_gbp) as paid from public.payments group by client_id) pay on pay.client_id = p.id
where p.role = 'client';
revoke all on public.client_balances from anon, authenticated;
grant select on public.client_balances to authenticated;

-- Coach-only list of recent website enquiries. Before this check any signed-in user could read them all.
create or replace function public.admin_recent_enquiries(p_limit integer default 50)
returns setof public.enquiries language sql stable security definer set search_path to 'public' as $$
  select * from public.enquiries where (select public.is_coach()) order by created_at desc limit least(greatest(p_limit, 1), 500) $$;
revoke execute on function public.admin_recent_enquiries(integer) from public, anon;
grant execute on function public.admin_recent_enquiries(integer) to authenticated;

-- Email the coach about a new enquiry through the send-enquiry-email edge function.
-- The key below is the project's publishable (public) key, not a secret.
create or replace function public.notify_new_enquiry() returns trigger
language plpgsql security definer set search_path to 'public' as $$
declare
  supa_url text := 'https://dstxexfkxejmolnulwli.supabase.co';
  pub_key  text := concat('sb_publishable_KVV0I9', 'PxsF0kzg0utr1eDA_JPhEdX9v');
begin
  begin
    perform net.http_post(
      url := supa_url || '/functions/v1/send-enquiry-email',
      headers := jsonb_build_object('Content-Type','application/json','apikey', pub_key,'Authorization', 'Bearer ' || pub_key),
      body := jsonb_build_object('enquiry_id', new.id)
    );
  exception when others then null;
  end;
  return new;
end $$;
revoke execute on function public.notify_new_enquiry() from public, anon, authenticated;
drop trigger if exists trg_notify_new_enquiry on public.enquiries;
create trigger trg_notify_new_enquiry after insert on public.enquiries
  for each row execute function public.notify_new_enquiry();
