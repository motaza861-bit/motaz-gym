-- IronMind subscriptions Phase 1
-- Idempotent migration — safe to re-run.

alter table public.profiles
  add column if not exists subscription_status text not null default 'trialing'
    check (subscription_status in ('trialing', 'active', 'expired', 'canceled'));

alter table public.profiles
  add column if not exists trial_started_at timestamptz default now();

alter table public.profiles
  add column if not exists trial_ends_at timestamptz default now() + interval '7 days';

-- Updated trigger: new accounts auto-get a 7-day trialing window.
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

-- View: server- and client-readable. Effective tier is what we gate on.
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
