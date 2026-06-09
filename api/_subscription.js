import { createClient } from '@supabase/supabase-js'

let adminClient = null
function getAdmin() {
  if (!adminClient) {
    adminClient = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )
  }
  return adminClient
}

async function getUserIdFromRequest(req) {
  const authHeader = req.headers?.authorization || ''
  const token = authHeader.replace(/^Bearer\s+/i, '')
  if (!token) return null
  const { data } = await getAdmin().auth.getUser(token)
  return data?.user?.id ?? null
}

export async function getEffectiveSubscription(userId) {
  const { data, error } = await getAdmin()
    .from('effective_subscription')
    .select('*')
    .eq('user_id', userId)
    .single()
  if (error || !data) return null
  return data
}

export async function requireTier(req, allowed) {
  const userId = await getUserIdFromRequest(req)
  if (!userId) throw { status: 401, body: { error: 'Not signed in' } }
  const sub = await getEffectiveSubscription(userId)
  if (!sub || !allowed.includes(sub.effective_tier)) {
    throw { status: 403, body: { error: 'Subscription required', required: allowed } }
  }
  return { userId, ...sub }
}

export function withTierGate(allowed, handler) {
  return async (req, res) => {
    try {
      const sub = await requireTier(req, allowed)
      req.subscription = sub
      return handler(req, res)
    } catch (err) {
      if (err && err.status) return res.status(err.status).json(err.body)
      throw err
    }
  }
}
