import { createClient } from '@supabase/supabase-js'
import { getUserFromReq } from './lib/auth.js'

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', c => { data += c })
    req.on('end', () => { try { resolve(JSON.parse(data)) } catch (e) { reject(e) } })
    req.on('error', reject)
  })
}

export default async function handler(req, res) {
  const user = getUserFromReq(req)
  if (!user) return res.status(401).json({ error: 'unauthorized' })

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${user.token}` } } }
  )

  if (req.method === 'GET') {
    const { data } = await supabase
      .from('user_email_aliases')
      .select('email, created_at')
      .order('created_at')
    return res.status(200).json(data || [])
  }

  let body
  try {
    body = req.body != null
      ? (typeof req.body === 'string' ? JSON.parse(req.body) : req.body)
      : await parseBody(req)
  } catch { return res.status(400).json({ error: 'bad_request' }) }

  if (req.method === 'POST') {
    const email = body?.email?.toLowerCase().trim()
    if (!email || !email.includes('@')) return res.status(400).json({ error: 'invalid_email' })

    const { error } = await supabase
      .from('user_email_aliases')
      .insert({ user_id: user.userId, email })

    if (error) {
      return res.status(400).json({
        error: error.code === '23505' ? 'already_exists' : 'db_error',
      })
    }
    return res.status(200).json({ ok: true })
  }

  if (req.method === 'DELETE') {
    const email = body?.email?.toLowerCase().trim()
    if (!email) return res.status(400).json({ error: 'missing_email' })

    await supabase
      .from('user_email_aliases')
      .delete()
      .eq('user_id', user.userId)
      .eq('email', email)

    return res.status(200).json({ ok: true })
  }

  return res.status(405).end()
}
