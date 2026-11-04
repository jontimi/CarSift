-- CarSift schema for Supabase. Run this once in the SQL Editor.
-- Access requires both an authenticated user and an administrator-added row in public.members.

create extension if not exists pgcrypto;

create table if not exists public.members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  added_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  budget_max integer not null default 120000 check (budget_max >= 0),
  year_min integer not null default 2019 check (year_min between 1980 and 2100),
  mileage_max integer not null default 120000 check (mileage_max >= 0),
  owners_max integer not null default 2 check (owners_max between 1 and 10),
  body_type text not null default '',
  fuel_type text not null default '',
  transmission text not null default '',
  weights jsonb not null default '{"reliability":8,"economy":7,"safety":7,"maintenance":6,"performance":4}'::jsonb,
  excluded_terms text[] not null default '{}',
  updated_at timestamptz not null default now()
);

create table if not exists public.cars (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  make text not null default '',
  model text not null default '',
  year integer check (year between 1950 and 2100),
  price_ils integer check (price_ils >= 0),
  mileage_km integer check (mileage_km >= 0),
  owners integer check (owners between 1 and 20),
  body_type text not null default '',
  fuel_type text not null default '',
  transmission text not null default '',
  engine text not null default '',
  trim text not null default '',
  city text not null default '',
  source_url text not null default '',
  notes text not null default '',
  reliability integer not null default 3 check (reliability between 1 and 5),
  economy integer not null default 3 check (economy between 1 and 5),
  safety integer not null default 3 check (safety between 1 and 5),
  performance integer not null default 3 check (performance between 1 and 5),
  maintenance integer not null default 3 check (maintenance between 1 and 5),
  features text[] not null default '{}',
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Upgrade path for databases created before the equipment filter existed.
alter table public.cars add column if not exists features text[] not null default '{}';

create table if not exists public.favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  car_id uuid not null references public.cars(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, car_id)
);

create or replace function public.is_carsift_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.members m where m.user_id = auth.uid()
  );
$$;

revoke all on function public.is_carsift_member() from public;
grant execute on function public.is_carsift_member() to authenticated;

alter table public.members enable row level security;
alter table public.profiles enable row level security;
alter table public.cars enable row level security;
alter table public.favorites enable row level security;

drop policy if exists "members can read own membership" on public.members;
create policy "members can read own membership"
  on public.members for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "members read own profile" on public.profiles;
create policy "members read own profile"
  on public.profiles for select to authenticated
  using (id = auth.uid() and public.is_carsift_member());

drop policy if exists "members create own profile" on public.profiles;
create policy "members create own profile"
  on public.profiles for insert to authenticated
  with check (id = auth.uid() and public.is_carsift_member());

drop policy if exists "members update own profile" on public.profiles;
create policy "members update own profile"
  on public.profiles for update to authenticated
  using (id = auth.uid() and public.is_carsift_member())
  with check (id = auth.uid() and public.is_carsift_member());

drop policy if exists "members read shared cars" on public.cars;
create policy "members read shared cars"
  on public.cars for select to authenticated
  using (public.is_carsift_member());

drop policy if exists "members add shared cars" on public.cars;
create policy "members add shared cars"
  on public.cars for insert to authenticated
  with check (public.is_carsift_member() and created_by = auth.uid());

drop policy if exists "members update shared cars" on public.cars;
create policy "members update shared cars"
  on public.cars for update to authenticated
  using (public.is_carsift_member())
  with check (public.is_carsift_member());

drop policy if exists "members remove shared cars" on public.cars;
create policy "members remove shared cars"
  on public.cars for delete to authenticated
  using (public.is_carsift_member());

drop policy if exists "users read own favorites" on public.favorites;
create policy "users read own favorites"
  on public.favorites for select to authenticated
  using (user_id = auth.uid() and public.is_carsift_member());

drop policy if exists "users add own favorites" on public.favorites;
create policy "users add own favorites"
  on public.favorites for insert to authenticated
  with check (user_id = auth.uid() and public.is_carsift_member());

drop policy if exists "users remove own favorites" on public.favorites;
create policy "users remove own favorites"
  on public.favorites for delete to authenticated
  using (user_id = auth.uid() and public.is_carsift_member());

create index if not exists cars_created_at_idx on public.cars (created_at desc);
create index if not exists cars_price_idx on public.cars (price_ils);
create index if not exists favorites_user_id_idx on public.favorites (user_id);
create index if not exists cars_make_model_idx on public.cars (make, model);
create index if not exists cars_features_idx on public.cars using gin (features);

-- Invite each approved email after they have signed in once with the magic link.
-- Run once per person, replacing the example email:
-- insert into public.members (user_id, email)
-- select id, email from auth.users where lower(email) = lower('you@example.com')
-- on conflict (user_id) do update set email = excluded.email;
