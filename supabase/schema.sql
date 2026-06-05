-- supabase/schema.sql
-- Run this once in the Supabase SQL editor for a fresh project.

-- 1. profiles ---------------------------------------------------------------
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text not null,
  display_name text,
  tier         text not null default 'free',
  created_at   timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "users read own profile"
  on public.profiles for select using (auth.uid() = id);

create policy "users update own profile"
  on public.profiles for update using (auth.uid() = id);

-- Auto-create a profile row on auth user insert
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2. user_data --------------------------------------------------------------
create table public.user_data (
  user_id    uuid not null references auth.users(id) on delete cascade,
  key        text not null,
  value      jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

alter table public.user_data enable row level security;

create policy "users read own data"
  on public.user_data for select using (auth.uid() = user_id);

create policy "users insert own data"
  on public.user_data for insert with check (auth.uid() = user_id);

create policy "users update own data"
  on public.user_data for update using (auth.uid() = user_id);

create policy "users delete own data"
  on public.user_data for delete using (auth.uid() = user_id);
