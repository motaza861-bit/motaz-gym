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

-- Server-side account deletion: deletes from auth.users, cascade removes profiles + user_data.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
as $$
begin
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_my_account from public;
grant execute on function public.delete_my_account to authenticated;

-- 3. subscriptions ----------------------------------------------------------

alter table public.profiles
  add column if not exists subscription_status text not null default 'trialing'
    check (subscription_status in ('trialing', 'active', 'expired', 'canceled'));

alter table public.profiles
  add column if not exists trial_started_at timestamptz default now();

alter table public.profiles
  add column if not exists trial_ends_at timestamptz default now() + interval '7 days';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.profiles (id, email, tier, subscription_status, trial_started_at, trial_ends_at)
  values (new.id, new.email, 'free', 'trialing', now(), now() + interval '7 days');
  return new;
end;
$$;

create or replace view public.effective_subscription as
select
  p.id as user_id,
  case
    when p.subscription_status = 'active'   then p.tier
    when p.subscription_status = 'trialing' and p.trial_ends_at > now() then 'tier2'
    else 'none'
  end as effective_tier,
  case
    when p.subscription_status = 'trialing' and p.trial_ends_at > now()
      then ceil(extract(epoch from (p.trial_ends_at - now())) / 86400)::int
    else 0
  end as trial_days_left,
  p.subscription_status as status,
  p.tier as stored_tier,
  p.trial_started_at,
  p.trial_ends_at
from public.profiles p;

alter view public.effective_subscription set (security_invoker = true);
