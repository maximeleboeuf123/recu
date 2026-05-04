import { createClient } from '@supabase/supabase-js'
import { getServiceClient } from './lib/auth.js'
import { planAllows } from './lib/plans.js'

function decodeJwt(token) {
  try {
    const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const p = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'))
    if (!p?.sub || p.exp < Date.now() / 1000) return null
    return { userId: p.sub, email: p.email }
  } catch { return null }
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    if (req.body != null) {
      try { resolve(typeof req.body === 'string' ? JSON.parse(req.body) : req.body) } catch (e) { reject(e) }
      return
    }
    let data = ''
    req.on('data', c => { data += c })
    req.on('end', () => { try { resolve(JSON.parse(data)) } catch (e) { reject(e) } })
    req.on('error', reject)
  })
}

export default async function handler(req, res) {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'unauthorized' })
  const token = authHeader.slice(7)
  const user = decodeJwt(token)
  if (!user) return res.status(401).json({ error: 'unauthorized' })

  const { userId, email: userEmail } = user
  const serviceClient = getServiceClient()
  const anonClient = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )

  // GET — return owned + received shares; auto-accept pending shares for this email
  if (req.method === 'GET') {
    if (userEmail) {
      await serviceClient
        .from('account_shares')
        .update({ shared_with_id: userId, status: 'accepted' })
        .eq('shared_with_email', userEmail.toLowerCase())
        .is('shared_with_id', null)
    }

    const [{ data: owned }, { data: received }] = await Promise.all([
      anonClient.from('account_shares').select('*').eq('owner_id', userId).order('account_name'),
      anonClient.from('account_shares').select('*').eq('shared_with_id', userId).eq('status', 'accepted').order('account_name'),
    ])

    return res.status(200).json({ owned: owned || [], received: received || [] })
  }

  // POST — create a share
  if (req.method === 'POST') {
    let body
    try { body = await parseBody(req) } catch { return res.status(400).json({ error: 'bad_request' }) }

    const { account_name, shared_with_email, permission = 'edit' } = body || {}
    if (!account_name?.trim() || !shared_with_email?.includes('@') || !['view', 'edit'].includes(permission)) {
      return res.status(400).json({ error: 'missing_fields' })
    }
    if (shared_with_email.toLowerCase() === userEmail?.toLowerCase()) {
      return res.status(400).json({ error: 'cannot_share_with_self' })
    }

    // Plan check — planAllows always true for now; plug Stripe in plans.js later
    const { data: userData } = await serviceClient.from('users').select('plan').eq('id', userId).single()
    if (!planAllows(userData?.plan, 'account_sharing')) {
      return res.status(403).json({ error: 'upgrade_required' })
    }

    // Resolve recipient ID if they already have a Récu account
    const { data: recipientId } = await serviceClient
      .rpc('get_user_id_by_email', { lookup_email: shared_with_email.toLowerCase() })

    const shareRow = {
      owner_id: userId,
      owner_email: userEmail,
      shared_with_email: shared_with_email.toLowerCase(),
      shared_with_id: recipientId || null,
      account_name: account_name.trim(),
      permission,
      status: recipientId ? 'accepted' : 'pending',
    }

    const { data: share, error } = await anonClient
      .from('account_shares')
      .insert(shareRow)
      .select()
      .single()

    if (error?.code === '23505') return res.status(409).json({ error: 'already_shared' })
    if (error) { console.error('shares insert:', error); return res.status(500).json({ error: 'db_error' }) }

    return res.status(200).json({ share })
  }

  // DELETE — revoke (owner only; RLS also enforces this)
  if (req.method === 'DELETE') {
    const id = req.query?.id
    if (!id) return res.status(400).json({ error: 'missing_id' })
    const { error } = await anonClient
      .from('account_shares')
      .delete()
      .eq('id', id)
      .eq('owner_id', userId)
    if (error) return res.status(500).json({ error: 'db_error' })
    return res.status(200).end()
  }

  return res.status(405).end()
}
