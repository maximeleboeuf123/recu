import { getServiceClient } from '../lib/auth.js'
import { findOrCreateFolder } from '../lib/driveClient.js'

const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'
const DRIVE_API = 'https://www.googleapis.com/drive/v3'

export default async function handler(req, res) {
  const { code, state, error } = req.query || {}
  const appOrigin = _appOrigin(req)

  if (error || !code || !state) {
    return res.redirect(`${appOrigin}/settings?drive=error`)
  }

  let userId, lang
  try {
    const decoded = JSON.parse(Buffer.from(state, 'base64url').toString('utf8'))
    if (typeof decoded === 'string') {
      userId = decoded
      lang = 'fr'
    } else {
      userId = decoded.userId
      lang = decoded.lang || 'fr'
    }
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

  // Store tokens
  await serviceClient.from('drive_tokens').upsert({
    user_id: userId,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: expiresAt,
    updated_at: new Date().toISOString(),
  })

  // Fetch existing folder IDs
  const { data: userData } = await serviceClient
    .from('users')
    .select('drive_folder_id, drive_inbox_id, drive_exports_id, drive_to_process_id')
    .eq('id', userId)
    .single()

  let rootId = userData?.drive_folder_id
  let inboxId = userData?.drive_inbox_id

  // If we have a stored root folder, verify it is still accessible with the new token.
  // If it is not accessible (e.g. user connected a different Google account), we fall
  // through to findOrCreateFolder which is safe and idempotent.
  let rootAccessible = false
  if (rootId) {
    try {
      const r = await fetch(`${DRIVE_API}/files/${rootId}?fields=id`, {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      })
      rootAccessible = r.ok
    } catch { /* fall through */ }
  }

  if (!rootAccessible) {
    // findOrCreateFolder is idempotent — it searches before creating.
    // Using 'root' as the parent searches in the user's My Drive root.
    try {
      const root = await findOrCreateFolder(tokens.access_token, 'Récu', 'root')
      const inboxName = lang === 'en' ? '_Receipts' : '_Factures'
      const inbox = await findOrCreateFolder(tokens.access_token, inboxName, root.id)
      const exportsFolder = await findOrCreateFolder(tokens.access_token, '_Exports', root.id)
      const toProcess = await findOrCreateFolder(tokens.access_token, '_to_process', root.id)

      rootId = root.id
      inboxId = inbox.id

      await serviceClient.from('users').update({
        drive_folder_id: root.id,
        drive_inbox_id: inbox.id,
        drive_exports_id: exportsFolder.id,
        drive_to_process_id: toProcess.id,
      }).eq('id', userId)
    } catch (e) {
      console.error('Folder setup failed:', e.message)
      return res.redirect(`${appOrigin}/settings?drive=error`)
    }
  }

  // Always sync account-level folders with dimensions (idempotent, fast).
  // Full category/year sync is available via the sync-dimensions endpoint.
  if (inboxId) {
    try {
      const { data: accounts } = await serviceClient
        .from('dimensions')
        .select('id, name, drive_folder_id')
        .eq('user_id', userId)
        .eq('type', 'account')

      if (accounts?.length) {
        await Promise.all(accounts.map(async (acc) => {
          try {
            const f = await findOrCreateFolder(tokens.access_token, acc.name, inboxId)
            if (acc.drive_folder_id !== f.id) {
              await serviceClient
                .from('dimensions')
                .update({ drive_folder_id: f.id })
                .eq('id', acc.id)
            }
          } catch (e) {
            console.error('sync account folder failed:', acc.name, e.message)
          }
        }))
      }
    } catch (e) {
      console.error('Dimensions sync on connect failed:', e.message)
      // Non-fatal — user is still connected
    }
  }

  return res.redirect(`${appOrigin}/settings?drive=connected`)
}

function _appOrigin(req) {
  const proto = req.headers['x-forwarded-proto'] || 'https'
  const host = req.headers['host']
  return `${proto}://${host}`
}
