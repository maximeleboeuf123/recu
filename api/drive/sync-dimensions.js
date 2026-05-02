import { getUserFromReq, getServiceClient } from '../lib/auth.js'
import { getValidToken, findOrCreateFolder } from '../lib/driveClient.js'

/**
 * POST /api/drive/sync-dimensions
 *
 * Compares the dimensions table against the Drive folder tree and creates any
 * missing folders. Never deletes or moves any files or folders.
 *
 * Folder structure: _Receipts/{Account}/{Year}/{Category}
 * - Account folders: stored in dimensions.drive_folder_id
 * - Year folders: stored in drive_year_folders
 * - Category folders: created on demand, not stored (multiple years possible)
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  try {
    const user = getUserFromReq(req)
    if (!user) return res.status(401).json({ error: 'Unauthorized' })

    const serviceClient = getServiceClient()

    const { data: userData } = await serviceClient
      .from('users')
      .select('drive_inbox_id, drive_folder_id')
      .eq('id', user.userId)
      .single()

    const inboxId = userData?.drive_inbox_id || userData?.drive_folder_id
    if (!inboxId) return res.status(200).json({ skipped: 'drive not connected' })

    const accessToken = await getValidToken(user.userId, serviceClient)
    if (!accessToken) return res.status(200).json({ skipped: 'no drive token' })

    const { data: dimensions } = await serviceClient
      .from('dimensions')
      .select('id, type, name, parent_id, drive_folder_id')
      .eq('user_id', user.userId)

    if (!dimensions?.length) return res.status(200).json({ created: 0 })

    const accounts = dimensions.filter((d) => d.type === 'account')
    const categories = dimensions.filter((d) => d.type === 'category')

    const currentYear = new Date().getFullYear()
    let created = 0

    for (const acc of accounts) {
      try {
        // 1. Account folder
        const accFolder = await findOrCreateFolder(accessToken, acc.name, inboxId)
        if (acc.drive_folder_id !== accFolder.id) {
          await serviceClient
            .from('dimensions')
            .update({ drive_folder_id: accFolder.id })
            .eq('id', acc.id)
          created++
        }

        // 2. Current year folder
        const yearFolder = await findOrCreateFolder(accessToken, String(currentYear), accFolder.id)
        await serviceClient.from('drive_year_folders').upsert({
          user_id: user.userId,
          dimension_id: acc.id,
          year: currentYear,
          drive_folder_id: yearFolder.id,
        })

        // 3. Category folders under current year
        const accCats = categories.filter((c) => c.parent_id === acc.id)
        for (const cat of accCats) {
          await findOrCreateFolder(accessToken, cat.name, yearFolder.id)
          created++
        }
      } catch (e) {
        console.error(`sync-dimensions: failed for "${acc.name}":`, e.message)
      }
    }

    return res.status(200).json({ created })
  } catch (e) {
    console.error('sync-dimensions error:', e.message)
    return res.status(500).json({ error: e.message })
  }
}
