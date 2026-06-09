import { supabase } from './supabase'

const QUEUE_KEY = '__sync_pending'

function readQueue() {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY)) ?? [] }
  catch { return [] }
}

function writeQueue(q) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q))
}

export function queueSize() {
  return readQueue().length
}

export function isLoggedIn() {
  try {
    const raw = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'))
    return !!raw
  } catch { return false }
}

async function getUserId() {
  const { data } = await supabase.auth.getUser()
  return data?.user?.id ?? null
}

async function upsertOne(userId, key, value) {
  const { error } = await supabase
    .from('user_data')
    .upsert({ user_id: userId, key, value }, { onConflict: 'user_id,key' })
  return error
}

export async function pushKey(key, value) {
  const userId = await getUserId()
  if (!userId) return
  const error = await upsertOne(userId, key, value)
  if (error) {
    const q = readQueue()
    q.push({ key, value })
    writeQueue(q)
  }
}

export async function flushQueue() {
  const userId = await getUserId()
  if (!userId) return
  const q = readQueue()
  const remaining = []
  for (const m of q) {
    const err = await upsertOne(userId, m.key, m.value)
    if (err) remaining.push(m)
  }
  writeQueue(remaining)
}

export async function pullAll(keys) {
  const userId = await getUserId()
  if (!userId) return
  const { data, error } = await supabase
    .from('user_data')
    .select('key, value')
  if (!error && data) {
    for (const row of data) {
      if (keys.includes(row.key)) {
        localStorage.setItem(row.key, JSON.stringify(row.value))
      }
    }
  }
  // Subscription view: pull and cache as a single blob the useSubscription hook reads.
  if (keys.includes('subscription')) {
    const { data: sub } = await supabase
      .from('effective_subscription')
      .select('*')
      .eq('user_id', userId)
      .single()
    if (sub) localStorage.setItem('subscription', JSON.stringify(sub))
  }
}

// --- First-login migration ---

const LEGACY_PREFIX = 'motaz_'

// Only the data keys migrate. Preferences (lang/theme/notifications/classes/onboarded)
// stay device-local — they're not part of the cloud-synced data model.
const MIGRATABLE_KEYS = new Set([
  'workout_logs', 'nutrition_logs', 'body_weight_logs',
  'meals', 'targets', 'profile', 'exercises', 'custom_foods',
  'big_three_logs',
  'chat_history',
])

export function findLocalLegacyKeys() {
  const out = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (!k || !k.startsWith(LEGACY_PREFIX)) continue
    const newKey = k.slice(LEGACY_PREFIX.length)
    if (MIGRATABLE_KEYS.has(newKey)) out.push(k)
  }
  return out
}

export async function migrateLegacyToCloud() {
  const userId = await getUserId()
  if (!userId) return
  const legacy = findLocalLegacyKeys()
  for (const legacyKey of legacy) {
    const newKey = legacyKey.slice(LEGACY_PREFIX.length)
    let value
    try { value = JSON.parse(localStorage.getItem(legacyKey)) } catch { continue }
    const err = await upsertOne(userId, newKey, value)
    if (!err) {
      localStorage.setItem(newKey, JSON.stringify(value))
      localStorage.removeItem(legacyKey)
    }
  }
}

export function discardLegacy() {
  for (const k of findLocalLegacyKeys()) localStorage.removeItem(k)
}

// Browser hooks — flush on online + focus.
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { flushQueue() })
  window.addEventListener('focus',  () => { flushQueue() })
}
