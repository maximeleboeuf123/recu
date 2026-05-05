import { createClient } from '@supabase/supabase-js'
import { getServiceClient } from './lib/auth.js'
import { planAllows } from './lib/plans.js'
import {
  getValidToken, findOrCreateFolder, grantFolderPermission, revokeFolderPermission,
} from './lib/driveClient.js'

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

// Grant guest access to account folders across all three Drive trees.
// Returns { main, review, process } permissionIds (store in account_shares).
async function grantAccountDrive(ownerId, accountName, guestEmail, permission, serviceClient) {
  try {
    const { data: userData } = await serviceClient
      .from('users')
      .select('drive_inbox_id, drive_review_folder_id, drive_to_process_id')
      .eq('id', ownerId).single()

    const accessToken = await getValidToken(ownerId, serviceClient)
    if (!accessToken) return {}

    const role = permission === 'edit' ? 'writer' : 'reader'
    const result = {}

    const roots = [
      { key: 'main',    id: userData?.drive_inbox_id },
      { key: 'review',  id: userData?.drive_review_folder_id },
      { key: 'process', id: userData?.drive_to_process_id },
    ]

    for (const { key, id } of roots) {
      if (!id) continue
      try {
        const folder = await findOrCreateFolder(accessToken, accountName, id)
        result[key] = await grantFolderPermission(accessToken, folder.id, guestEmail, role)
      } catch (e) {
        console.error(`Drive permission grant (${key}, non-critical):`, e?.message)
      }
    }
    return result
  } catch (e) {
    console.error('Drive permission grant (non-critical):', e?.message)
    return {}
  }
}

// Revoke guest access from all three folder trees.
async function revokeAccountDrive(ownerId, accountName, permissionIds, serviceClient) {
  if (!permissionIds || Object.keys(permissionIds).length === 0) return
  try {
    const { data: userData } = await serviceClient
      .from('users')
      .select('drive_inbox_id, drive_review_folder_id, drive_to_process_id')
      .eq('id', ownerId).single()

    const accessToken = await getValidToken(ownerId, serviceClient)
    if (!accessToken) return

    const roots = [
      { key: 'main',    id: userData?.drive_inbox_id,          permId: permissionIds.main },
      { key: 'review',  id: userData?.drive_review_folder_id,  permId: permissionIds.review },
      { key: 'process', id: userData?.drive_to_process_id,     permId: permissionIds.process },
    ]

    for (const { key, id, permId } of roots) {
      if (!id || !permId) continue
      try {
        const folder = await findOrCreateFolder(accessToken, accountName, id)
        await revokeFolderPermission(accessToken, folder.id, permId)
      } catch (e) {
        console.error(`Drive permission revoke (${key}, non-critical):`, e?.message)
      }
    }
  } catch (e) {
    console.error('Drive permission revoke (non-critical):', e?.message)
  }
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

  // GET — return owned + received; auto-accept pending shares and grant Drive access
  if (req.method === 'GET') {
    if (userEmail) {
      const { data: pending } = await serviceClient
        .from('account_shares')
        .select('id, owner_id, account_name, permission, shared_with_email')
        .eq('shared_with_email', userEmail.toLowerCase())
        .is('shared_with_id', null)

      for (const share of pending || []) {
        const perms = await grantAccountDrive(
          share.owner_id, share.account_name, share.shared_with_email, share.permission, serviceClient
        )
        await serviceClient
          .from('account_shares')
          .update({
            shared_with_id: userId,
            status: 'accepted',
            ...(perms.main    ? { drive_permission_id: perms.main }           : {}),
            ...(perms.review  ? { drive_review_permission_id: perms.review }  : {}),
            ...(perms.process ? { drive_process_permission_id: perms.process } : {}),
          })
          .eq('id', share.id)
      }
    }

    const [{ data: owned }, { data: received }] = await Promise.all([
      anonClient.from('account_shares').select('*').eq('owner_id', userId).order('account_name'),
      anonClient.from('account_shares').select('*').eq('shared_with_id', userId).eq('status', 'accepted').order('account_name'),
    ])

    return res.status(200).json({ owned: owned || [], received: received || [] })
  }

  // POST — create a share and grant Drive access if recipient already has an account
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

    const { data: userData } = await serviceClient.from('users').select('plan').eq('id', userId).single()
    if (!planAllows(userData?.plan, 'account_sharing')) {
      return res.status(403).json({ error: 'upgrade_required' })
    }

    const { data: recipientId } = await serviceClient
      .rpc('get_user_id_by_email', { lookup_email: shared_with_email.toLowerCase() })

    const isAccepted = !!recipientId
    const shareRow = {
      owner_id: userId,
      owner_email: userEmail,
      shared_with_email: shared_with_email.toLowerCase(),
      shared_with_id: recipientId || null,
      account_name: account_name.trim(),
      permission,
      status: isAccepted ? 'accepted' : 'pending',
    }

    const { data: share, error } = await anonClient
      .from('account_shares')
      .insert(shareRow)
      .select()
      .single()

    if (error?.code === '23505') return res.status(409).json({ error: 'already_shared' })
    if (error) { console.error('shares insert:', error); return res.status(500).json({ error: 'db_error' }) }

    // Grant Drive folder access immediately if share is accepted
    if (isAccepted) {
      const perms = await grantAccountDrive(
        userId, account_name.trim(), shared_with_email.toLowerCase(), permission, serviceClient
      )
      if (Object.keys(perms).length) {
        const updates = {
          ...(perms.main    ? { drive_permission_id: perms.main }           : {}),
          ...(perms.review  ? { drive_review_permission_id: perms.review }  : {}),
          ...(perms.process ? { drive_process_permission_id: perms.process } : {}),
        }
        await serviceClient.from('account_shares').update(updates).eq('id', share.id)
        Object.assign(share, updates)
      }
    }

    return res.status(200).json({ share })
  }

  // DELETE — revoke Drive access then remove the share row
  if (req.method === 'DELETE') {
    const id = req.query?.id
    if (!id) return res.status(400).json({ error: 'missing_id' })

    // Fetch the share to get Drive details before deleting
    const { data: existing } = await serviceClient
      .from('account_shares')
      .select('owner_id, account_name, drive_permission_id, drive_review_permission_id, drive_process_permission_id')
      .eq('id', id)
      .eq('owner_id', userId)
      .single()

    if (existing) {
      await revokeAccountDrive(existing.owner_id, existing.account_name, {
        main:    existing.drive_permission_id,
        review:  existing.drive_review_permission_id,
        process: existing.drive_process_permission_id,
      }, serviceClient)
    }

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
