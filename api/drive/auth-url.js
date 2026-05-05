import { getUserFromReq } from '../lib/auth.js'

export default function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const user = getUserFromReq(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    return res.status(500).json({ error: 'drive_not_configured' })
  }

  const lang = req.query?.lang === 'en' ? 'en' : 'fr'
  const state = Buffer.from(JSON.stringify({ userId: user.userId, lang })).toString('base64url')
  const redirectUri = `${_appOrigin(req)}/api/drive/callback`

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/drive',
    access_type: 'offline',
    prompt: 'consent',
    state,
  })

  return res.status(200).json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` })
}

function _appOrigin(req) {
  const proto = req.headers['x-forwarded-proto'] || 'https'
  const host = req.headers['host']
  return `${proto}://${host}`
}
