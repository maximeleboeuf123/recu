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

// Grant guest access to the account folder (Récu/{Account}/).
// Returns { main: permissionId }.
async function grantAccountDrive(ownerId, accountName, guestEmail, permission, serviceClient) {
  try {
    const { data: userData } = await serviceClient
      .from('users')
      .select('drive_folder_id')
      .eq('id', ownerId).single()

    const accessToken = await getValidToken(ownerId, serviceClient)
    if (!accessToken || !userData?.drive_folder_id) return {}

    const role = permission === 'edit' ? 'writer' : 'reader'
    const accountFolder = await findOrCreateFolder(accessToken, accountName, userData.drive_folder_id)
    const permId = await grantFolderPermission(accessToken, accountFolder.id, guestEmail, role)
    return { main: permId }
  } catch (e) {
    console.error('Drive permission grant (non-critical):', e?.message)
    return {}
  }
}

// Revoke guest access from the account folder.
async function revokeAccountDrive(ownerId, accountName, permissionIds, serviceClient) {
  if (!permissionIds?.main) return
  try {
    const { data: userData } = await serviceClient
      .from('users')
      .select('drive_folder_id')
      .eq('id', ownerId).single()

    const accessToken = await getValidToken(ownerId, serviceClient)
    if (!accessToken || !userData?.drive_folder_id) return

    const accountFolder = await findOrCreateFolder(accessToken, accountName, userData.drive_folder_id)
    await revokeFolderPermission(accessToken, accountFolder.id, permissionIds.main)
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
            ...(perms.main ? { drive_permission_id: perms.main } : {}),
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
      if (perms.main) {
        await serviceClient.from('account_shares').update({ drive_permission_id: perms.main }).eq('id', share.id)
        Object.assign(share, { drive_permission_id: perms.main })
      }
    }

    // Email invite for non-users
    if (!recipientId && process.env.POSTMARK_API_KEY) {
      try {
        await fetch('https://api.postmarkapp.com/email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Postmark-Server-Token': process.env.POSTMARK_API_KEY,
          },
          body: JSON.stringify({
            From: 'Récu <noreply@monrecu.app>',
            To: shared_with_email,
            Subject: `${userEmail} shared an account with you on Récu`,
            TextBody: [
              `Hi / Bonjour,`,
              '',
              `${userEmail} has shared the account "${account_name.trim()}" with you on Récu.`,
              `${userEmail} vous a partagé le compte « ${account_name.trim()} » sur Récu.`,
              '',
              `Create a free account at monrecu.app using this email address (${shared_with_email}) — the shared account will appear automatically once you sign in.`,
              `Créez un compte gratuit sur monrecu.app avec cette adresse (${shared_with_email}) — le compte partagé apparaîtra automatiquement une fois connecté.`,
              '',
              `https://monrecu.app`,
              '',
              `— The Récu team / L'équipe Récu`,
            ].join('\n'),
          }),
        })
      } catch (e) {
        console.error('Share invite email error:', e?.message)
      }
    }

    return res.status(200).json({ share })
  }

  // DELETE — revoke Drive access then remove the share row
  if (req.method === 'DELETE') {
    const id = req.query?.id
    if (!id) return res.status(400).json({ error: 'missing_id' })

    const { data: existing } = await serviceClient
      .from('account_shares')
      .select('owner_id, account_name, drive_permission_id')
      .eq('id', id)
      .eq('owner_id', userId)
      .single()

    if (existing) {
      await revokeAccountDrive(existing.owner_id, existing.account_name, {
        main: existing.drive_permission_id,
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
