import { getUserFromReq, getServiceClient } from './lib/auth.js'

const ADMIN_EMAIL = 'admin@monrecu.app'

export default async function handler(req, res) {
  const user = getUserFromReq(req)
  if (!user) return res.status(401).json({ error: 'unauthorized' })

  const serviceClient = getServiceClient()

  if (req.method === 'POST') {
    let body
    try {
      if (req.body != null) {
        body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
      } else {
        const chunks = []
        for await (const chunk of req) chunks.push(chunk)
        body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
      }
    } catch { return res.status(400).json({ error: 'bad_request' }) }

    const { type, message } = body || {}
    if (!message?.trim()) return res.status(400).json({ error: 'message_required' })

    const { error } = await serviceClient.from('feedback').insert({
      user_id: user.userId,
      user_email: user.email,
      type: ['suggestion', 'bug', 'other'].includes(type) ? type : 'suggestion',
      message: message.trim().slice(0, 2000),
      status: 'new',
    })

    if (error) { console.error('feedback insert:', error.message); return res.status(500).json({ error: 'db_error' }) }
    return res.status(200).json({ ok: true })
  }

  if (req.method === 'GET') {
    if (user.email !== ADMIN_EMAIL) return res.status(403).json({ error: 'forbidden' })

    const { data, error } = await serviceClient
      .from('feedback')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) return res.status(500).json({ error: 'db_error' })
    return res.status(200).json(data || [])
  }

  if (req.method === 'PATCH') {
    if (user.email !== ADMIN_EMAIL) return res.status(403).json({ error: 'forbidden' })

    let body
    try {
      body = req.body != null
        ? (typeof req.body === 'string' ? JSON.parse(req.body) : req.body)
        : JSON.parse(Buffer.concat(await (async () => { const c = []; for await (const ch of req) c.push(ch); return c })()).toString())
    } catch { return res.status(400).json({ error: 'bad_request' }) }

    const { id, status } = body || {}
    if (!id || !['new', 'read', 'archived'].includes(status)) return res.status(400).json({ error: 'bad_request' })

    await serviceClient.from('feedback').update({ status }).eq('id', id)
    return res.status(200).json({ ok: true })
  }

  return res.status(405).end()
}
