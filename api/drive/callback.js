import crypto from 'crypto'
import { getServiceClient } from '../lib/auth.js'
import { findOrCreateFolder, watchDriveChanges } from '../lib/driveClient.js'

const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'
const DRIVE_API = 'https://www.googleapis.com/drive/v3'

// Sub-folders created inside every account folder (including _unassigned)
const ACCOUNT_SUBFOLDERS = ['_receipts', '_for_review', '_to_process', '_export']

export default async function handler(req, res) {
  const { code, state, error } = req.query || {}
  const appOrigin = _appOrigin(req)

  if (error || !code || !state) {
    return res.redirect(`${appOrigin}/settings?drive=error`)
  }

  let userId
  try {
    const decoded = JSON.parse(Buffer.from(state, 'base64url').toString('utf8'))
    userId = typeof decoded === 'string' ? decoded : decoded.userId
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

  await serviceClient.from('drive_tokens').upsert({
    user_id: userId,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: expiresAt,
    updated_at: new Date().toISOString(),
  })

  const { data: userData } = await serviceClient
    .from('users')
    .select('drive_folder_id, drive_watch_channel_id, drive_watch_resource_id')
    .eq('id', userId)
    .single()

  let rootId = userData?.drive_folder_id

  // Verify root folder is accessible
  let rootAccessible = false
  if (rootId) {
    try {
      const r = await fetch(`${DRIVE_API}/files/${rootId}?fields=id`, {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      })
      rootAccessible = r.ok
    } catch { /* fall through */ }
  }

  // Build new folder structure
  try {
    const root = rootAccessible
      ? { id: rootId }
      : await findOrCreateFolder(tokens.access_token, 'Récu', 'root')

    rootId = root.id

    // Create _unassigned with all subfolders
    const unassigned = await findOrCreateFolder(tokens.access_token, '_unassigned', rootId)
    await Promise.all(
      ACCOUNT_SUBFOLDERS.map(name => findOrCreateFolder(tokens.access_token, name, unassigned.id))
    )

    // Clear legacy folder IDs — new structure uses drive_folder_id (root) only
    await serviceClient.from('users').update({
      drive_folder_id: rootId,
      drive_inbox_id: null,
      drive_exports_id: null,
      drive_to_process_id: null,
      drive_review_folder_id: null,
      drive_token_active: true,
    }).eq('id', userId)

    // Ensure _unassigned dimension row
    const { data: existingUnassigned } = await serviceClient
      .from('dimensions')
      .select('id, drive_folder_id')
      .eq('user_id', userId)
      .eq('type', 'account')
      .eq('name', '_unassigned')
      .maybeSingle()

    if (!existingUnassigned) {
      await serviceClient.from('dimensions').insert({
        user_id: userId,
        type: 'account',
        name: '_unassigned',
        drive_folder_id: unassigned.id,
      })
    } else if (existingUnassigned.drive_folder_id !== unassigned.id) {
      await serviceClient.from('dimensions')
        .update({ drive_folder_id: unassigned.id })
        .eq('id', existingUnassigned.id)
    }

    // Sync account folders: create {Account}/ under Récu/ for each dimension account
    const { data: accounts } = await serviceClient
      .from('dimensions')
      .select('id, name, drive_folder_id')
      .eq('user_id', userId)
      .eq('type', 'account')
      .neq('name', '_unassigned')

    if (accounts?.length) {
      await Promise.all(accounts.map(async (acc) => {
        try {
          const folder = await findOrCreateFolder(tokens.access_token, acc.name, rootId)
          // Create subfolders under account
          await Promise.all(
            ACCOUNT_SUBFOLDERS.map(name => findOrCreateFolder(tokens.access_token, name, folder.id))
          )
          if (acc.drive_folder_id !== folder.id) {
            await serviceClient.from('dimensions')
              .update({ drive_folder_id: folder.id })
              .eq('id', acc.id)
          }
        } catch (e) {
          console.error('sync account folder failed:', acc.name, e.message)
        }
      }))
    }
  } catch (e) {
    console.error('Folder setup failed:', e.message)
    return res.redirect(`${appOrigin}/settings?drive=error`)
  }

  // Re-register Drive changes watch
  try {
    if (userData?.drive_watch_channel_id && userData?.drive_watch_resource_id) {
      try {
        const { stopDriveWatch } = await import('../lib/driveClient.js')
        await stopDriveWatch(tokens.access_token, userData.drive_watch_channel_id, userData.drive_watch_resource_id)
      } catch { /* old channel may be expired */ }
    }

    const channelId = crypto.randomUUID()
    const watchResult = await watchDriveChanges(
      tokens.access_token,
      channelId,
      `${appOrigin}/api/drive/ingest`,
      userId,
    )
    await serviceClient.from('users').update({
      drive_watch_channel_id: channelId,
      drive_watch_resource_id: watchResult.resourceId,
      drive_watch_expires_at: watchResult.expiration
        ? new Date(Number(watchResult.expiration)).toISOString()
        : null,
    }).eq('id', userId)
  } catch (e) {
    console.error('Drive watch registration failed (non-fatal):', e.message)
  }

  return res.redirect(`${appOrigin}/settings?drive=connected`)
}

function _appOrigin(req) {
  const proto = req.headers['x-forwarded-proto'] || 'https'
  const host = req.headers['host']
  return `${proto}://${host}`
}
