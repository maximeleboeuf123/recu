import { getUserFromReq } from '../lib/auth.js'

export default function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const user = getUserFromReq(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET
  console.log('Drive env check — clientId present:', !!clientId, '| clientSecret present:', !!clientSecret)
  if (!clientId || !clientSecret) {
    return res.status(500).json({ error: 'drive_not_configured', clientId: clientId ?? 'MISSING', clientSecret: clientSecret ? 'SET' : 'MISSING' })
  }

  const state = Buffer.from(user.userId).toString('base64url')
  const redirectUri = `${_appOrigin(req)}/api/drive/callback`

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/drive.file',
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
