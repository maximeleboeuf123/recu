import { getUserFromReq, getServiceClient } from '../lib/auth.js'
import { getValidToken, findOrCreateFolder } from '../lib/driveClient.js'
import { renameFile } from '../lib/driveFolders.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  try {
    const user = getUserFromReq(req)
    if (!user) return res.status(401).json({ error: 'Unauthorized' })

    // Parse body defensively
    let body = req.body
    if (body == null) {
      try {
        const chunks = []
        for await (const chunk of req) chunks.push(chunk)
        body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
      } catch {
        return res.status(400).json({ error: 'Bad request body' })
      }
    }

    const { dimensionId, newName } = body || {}
    if (!dimensionId) return res.status(400).json({ error: 'dimensionId required' })

    const serviceClient = getServiceClient()

    // Fetch the dimension
    const { data: dimension } = await serviceClient
      .from('dimensions')
      .select('id, type, name, parent_id, drive_folder_id')
      .eq('id', dimensionId)
      .eq('user_id', user.userId)
      .maybeSingle()

    if (!dimension) return res.status(404).json({ error: 'Dimension not found' })

    // Only handle account-type dimensions; categories are handled lazily
    if (dimension.type !== 'account') {
      return res.status(200).json({ success: true, skipped: 'not an account dimension' })
    }

    // Get user's drive_inbox_id
    const { data: userData } = await serviceClient
      .from('users')
      .select('drive_inbox_id')
      .eq('id', user.userId)
      .maybeSingle()

    const inboxId = userData?.drive_inbox_id
    if (!inboxId) return res.status(200).json({ success: true, skipped: 'drive not connected' })

    // Get valid Drive token
    const accessToken = await getValidToken(user.userId, serviceClient)
    if (!accessToken) return res.status(200).json({ success: true, skipped: 'no drive token' })

    let folderId = dimension.drive_folder_id

    if (folderId && newName) {
      // Rename existing Drive folder
      try {
        await renameFile(accessToken, folderId, newName)
      } catch (e) {
        console.error('sync-folder: renameFile failed:', e.message)
        return res.status(200).json({ success: false, error: e.message })
      }
    } else if (!folderId) {
      // Create (or find) folder, then persist ID in dimensions
      try {
        const folder = await findOrCreateFolder(accessToken, dimension.name, inboxId)
        folderId = folder.id
        await serviceClient
          .from('dimensions')
          .update({ drive_folder_id: folderId })
          .eq('id', dimensionId)
      } catch (e) {
        console.error('sync-folder: findOrCreateFolder failed:', e.message)
        return res.status(200).json({ success: false, error: e.message })
      }
    }

    return res.status(200).json({ folderId })
  } catch (e) {
    console.error('sync-folder handler error:', e.message)
    return res.status(200).json({ success: true, error: e.message })
  }
}
