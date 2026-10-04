-- ========== v3: meal plan library (templates, recipe photos and sources) ==========
alter table public.recipes add column if not exists image_url text;
alter table public.recipes add column if not exists image_credit text;
alter table public.recipes add column if not exists inspired_by text;
alter table public.recipes add column if not exists inspired_url text;

create table if not exists public.meal_plan_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  goal text not null default 'Balanced',
  kcal int not null default 2000,
  description text not null default '',
  image_url text,
  image_credit text,
  source_name text,
  source_title text,
  source_url text,
  source_posted date,
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
