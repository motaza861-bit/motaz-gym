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
  if (error || !data) return
  for (const row of data) {
    if (keys.includes(row.key)) {
      localStorage.setItem(row.key, JSON.stringify(row.value))
    }
  }
}

// Browser hooks — flush on online + focus.
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { flushQueue() })
  window.addEventListener('focus',  () => { flushQueue() })
}
