import { useStorage } from './useStorage'

const DEFAULT_SUB = {
  effective_tier: 'none',
  status: 'expired',
  trial_days_left: 0,
  stored_tier: 'free',
  trial_started_at: null,
  trial_ends_at: null,
}

export function useSubscription() {
  const [sub] = useStorage('subscription', DEFAULT_SUB)
  const effectiveTier = sub?.effective_tier ?? 'none'
  return {
    effectiveTier,
    status: sub?.status ?? 'expired',
    daysLeft: sub?.trial_days_left ?? 0,
    storedTier: sub?.stored_tier ?? 'free',
    trialEndsAt: sub?.trial_ends_at ?? null,
    isExpired: effectiveTier === 'none',
  }
}
