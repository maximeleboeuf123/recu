import { getUserFromReq, getServiceClient } from '../lib/auth.js'
import { getValidToken, copyFileToDrive, createDriveFolder } from '../lib/driveClient.js'
import { createClient } from '@supabase/supabase-js'

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (c) => { data += c })
    req.on('end', () => { try { resolve(JSON.parse(data)) } catch (e) { reject(e) } })
    req.on('error', reject)
  })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const user = getUserFromReq(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  let body
  try {
    body = req.body != null ? (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) : await parseBody(req)
  } catch {
    return res.status(400).json({ error: 'Bad request' })
  }

  const { receiptId, folderId, folderName } = body || {}
  if (!receiptId || !folderName) return res.status(400).json({ error: 'Bad request' })

  const serviceClient = getServiceClient()

  // Get user drive state
  const { data: userData } = await serviceClient
    .from('users')
    .select('drive_folder_id')
    .eq('id', user.userId)
    .single()
  if (!userData?.drive_folder_id) return res.status(400).json({ error: 'drive_not_connected' })

  // Get receipt drive_file_id (use user-scoped client for RLS)
  const userClient = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${user.token}` } } }
  )
  const { data: receipt } = await userClient
    .from('receipts')
    .select('drive_file_id, filename')
    .eq('id', receiptId)
    .eq('user_id', user.userId)
    .single()

  if (!receipt?.drive_file_id) return res.status(400).json({ error: 'no_drive_file' })

  const accessToken = await getValidToken(user.userId, serviceClient)
  if (!accessToken) return res.status(401).json({ error: 'token_expired' })

  try {
    let targetFolderId = folderId
    if (!targetFolderId) {
      // Create new folder in Récu root
      const folder = await createDriveFolder(accessToken, folderName, userData.drive_folder_id)
      targetFolderId = folder.id
    }

    const ext = receipt.filename?.includes('.') ? '' : '.jpg'
    await copyFileToDrive(accessToken, receipt.drive_file_id, targetFolderId, `${receipt.filename}${ext}`)

    return res.status(200).json({ success: true, folderName })
  } catch (e) {
    console.error('Copy error:', e.message)
    return res.status(500).json({ error: 'drive_error' })
  }
}
