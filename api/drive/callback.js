import { createClient } from '@supabase/supabase-js'
import { getServiceClient } from '../lib/auth.js'
import { createDriveFolder } from '../lib/driveClient.js'

const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'

export default async function handler(req, res) {
  const { code, state, error } = req.query || {}

  const appOrigin = _appOrigin(req)

  if (error || !code || !state) {
    return res.redirect(`${appOrigin}/settings?drive=error`)
  }

  let userId
  try {
    userId = Buffer.from(state, 'base64url').toString('utf8')
    if (!userId) throw new Error('empty')
  } catch {
    return res.redirect(`${appOrigin}/settings?drive=error`)
  }

  const redirectUri = `${appOrigin}/api/drive/callback`

  // Exchange code for tokens
  let tokens
  try {
    const tokenRes = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_DRIVE_CLIENT_ID,
        client_secret: process.env.GOOGLE_DRIVE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    })
    tokens = await tokenRes.json()
    if (!tokenRes.ok || !tokens.access_token) throw new Error(JSON.stringify(tokens))
  } catch (e) {
    console.error('Token exchange failed:', e.message)
    return res.redirect(`${appOrigin}/settings?drive=error`)
  }

  const serviceClient = getServiceClient()
  const expiresAt = new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString()

  // Store tokens (upsert)
  await serviceClient.from('drive_tokens').upsert({
    user_id: userId,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: expiresAt,
    updated_at: new Date().toISOString(),
  })

  // Check if folders already created
  const { data: userData } = await serviceClient
    .from('users')
    .select('drive_folder_id')
    .eq('id', userId)
    .single()

  if (!userData?.drive_folder_id) {
    try {
      const root = await createDriveFolder(tokens.access_token, 'Récu', null)
      const inbox = await createDriveFolder(tokens.access_token, '_Inbox', root.id)
      await createDriveFolder(tokens.access_token, '_Exports', root.id)

      await serviceClient.from('users').update({
        drive_folder_id: root.id,
        drive_inbox_id: inbox.id,
      }).eq('id', userId)
    } catch (e) {
      console.error('Folder creation failed:', e.message)
      return res.redirect(`${appOrigin}/settings?drive=error`)
    }
  }

  return res.redirect(`${appOrigin}/settings?drive=connected`)
}

function _appOrigin(req) {
  const proto = req.headers['x-forwarded-proto'] || 'https'
  const host = req.headers['host']
  return `${proto}://${host}`
}
