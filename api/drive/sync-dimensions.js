import { getUserFromReq, getServiceClient } from '../lib/auth.js'
import { getValidToken, findOrCreateFolder } from '../lib/driveClient.js'

const ACCOUNT_SUBFOLDERS = ['_receipts', '_for_review', '_to_process', '_export']

/**
 * POST /api/drive/sync-dimensions
 *
 * Ensures the Drive folder tree matches the current dimensions.
 * New structure: Récu/{Account}/_receipts/{Year}/{Category}
 *                Récu/{Account}/_for_review
 *                Récu/{Account}/_to_process
 *                Récu/{Account}/_export
 * The _unassigned account is always included.
 * Never deletes or moves files.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  try {
    const user = getUserFromReq(req)
    if (!user) return res.status(401).json({ error: 'Unauthorized' })

    const serviceClient = getServiceClient()

    const { data: userData } = await serviceClient
      .from('users')
      .select('drive_folder_id')
      .eq('id', user.userId)
      .single()

    const rootId = userData?.drive_folder_id
    if (!rootId) return res.status(200).json({ skipped: 'drive not connected' })

    const accessToken = await getValidToken(user.userId, serviceClient)
    if (!accessToken) return res.status(200).json({ skipped: 'no drive token' })

    const { data: dimensions } = await serviceClient
      .from('dimensions')
      .select('id, type, name, parent_id, drive_folder_id')
      .eq('user_id', user.userId)

    const accounts = (dimensions || []).filter(d => d.type === 'account')
    const categories = (dimensions || []).filter(d => d.type === 'category')

    // Always include _unassigned
    const hasUnassigned = accounts.some(a => a.name === '_unassigned')
    if (!hasUnassigned) {
      accounts.push({ id: null, name: '_unassigned', drive_folder_id: null })
    }

    const currentYear = new Date().getFullYear()
    let created = 0

    for (const acc of accounts) {
      try {
        // 1. Account root: Récu/{Account}/
        const accFolder = await findOrCreateFolder(accessToken, acc.name, rootId)

        if (acc.id && acc.drive_folder_id !== accFolder.id) {
          await serviceClient
            .from('dimensions')
            .update({ drive_folder_id: accFolder.id })
            .eq('id', acc.id)
          created++
        }

        // 2. Standard subfolders under account
        const subFolders = await Promise.all(
          ACCOUNT_SUBFOLDERS.map(name => findOrCreateFolder(accessToken, name, accFolder.id))
        )
        const receiptsFolder = subFolders[0] // _receipts is first

        // 3. Current year folder under _receipts/
        const yearFolder = await findOrCreateFolder(accessToken, String(currentYear), receiptsFolder.id)

        if (acc.id) {
          await serviceClient.from('drive_year_folders').upsert({
            user_id: user.userId,
            dimension_id: acc.id,
            year: currentYear,
            drive_folder_id: yearFolder.id,
          })
        }

        // 4. Category folders under current year
        if (acc.id) {
          const accCats = categories.filter(c => c.parent_id === acc.id)
          for (const cat of accCats) {
            await findOrCreateFolder(accessToken, cat.name, yearFolder.id)
            created++
          }
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
