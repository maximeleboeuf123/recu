import { findOrCreateFolder } from './driveClient.js'

const DRIVE_API = 'https://www.googleapis.com/drive/v3'

/**
 * Resolve (or lazily create) the Drive folder for a receipt given its labels and invoice_date.
 * Returns the leaf folder ID. Falls back up the hierarchy if data is missing.
 * All DB mutations are best-effort (no throws propagated to caller).
 *
 * Hierarchy: _Receipts/{AccountName}/{Year}/{CategoryName}
 */
export async function ensureReceiptFolder(serviceClient, userId, accessToken, labels, invoiceDate) {
  // 1. Get drive_inbox_id from users
  const { data: userData } = await serviceClient
    .from('users')
    .select('drive_inbox_id')
    .eq('id', userId)
    .maybeSingle()

  const inboxId = userData?.drive_inbox_id
  if (!inboxId) return null

  const accountName = labels?.property
  const categoryName = labels?.category

  // 2. Resolve year from invoice_date
  let year = null
  if (invoiceDate) {
    const parsed = new Date(invoiceDate)
    if (!isNaN(parsed.getTime())) {
      year = parsed.getFullYear()
    }
  }
  if (!year) year = new Date().getFullYear()

  // 3. If no account name, return inbox as fallback
  if (!accountName) return inboxId

  // 4. Resolve account folder (find existing in dimensions, or create)
  let accountFolderId = null
  try {
    const { data: dim } = await serviceClient
      .from('dimensions')
      .select('id, drive_folder_id')
      .eq('user_id', userId)
      .eq('type', 'account')
      .eq('name', accountName)
      .maybeSingle()

    if (dim) {
      if (dim.drive_folder_id) {
        accountFolderId = dim.drive_folder_id
      } else {
        // Create and persist
        const folder = await findOrCreateFolder(accessToken, accountName, inboxId)
        accountFolderId = folder.id
        await serviceClient
          .from('dimensions')
          .update({ drive_folder_id: folder.id })
          .eq('id', dim.id)
      }
    } else {
      // No dimension row — create folder anyway
      const folder = await findOrCreateFolder(accessToken, accountName, inboxId)
      accountFolderId = folder.id
    }
  } catch (e) {
    console.error('ensureReceiptFolder: account folder error:', e.message)
    return inboxId
  }

  // 5. Resolve year folder (drive_year_folders table)
  let yearFolderId = null
  try {
    const { data: dim } = await serviceClient
      .from('dimensions')
      .select('id')
      .eq('user_id', userId)
      .eq('type', 'account')
      .eq('name', accountName)
      .maybeSingle()

    const dimensionId = dim?.id

    if (dimensionId) {
      const { data: yearRow } = await serviceClient
        .from('drive_year_folders')
        .select('drive_folder_id')
        .eq('user_id', userId)
        .eq('dimension_id', dimensionId)
        .eq('year', year)
        .maybeSingle()

      if (yearRow?.drive_folder_id) {
        yearFolderId = yearRow.drive_folder_id
      } else {
        const yearFolder = await findOrCreateFolder(accessToken, String(year), accountFolderId)
        yearFolderId = yearFolder.id
        await serviceClient.from('drive_year_folders').upsert({
          user_id: userId,
          dimension_id: dimensionId,
          year,
          drive_folder_id: yearFolder.id,
        })
      }
    } else {
      // No dimension ID — create year folder without storing
      const yearFolder = await findOrCreateFolder(accessToken, String(year), accountFolderId)
      yearFolderId = yearFolder.id
    }
  } catch (e) {
    console.error('ensureReceiptFolder: year folder error:', e.message)
    return accountFolderId
  }

  // 6. Resolve category folder (lazy, not stored)
  if (!categoryName) return yearFolderId

  try {
    const categoryFolder = await findOrCreateFolder(accessToken, categoryName, yearFolderId)
    return categoryFolder.id
  } catch (e) {
    console.error('ensureReceiptFolder: category folder error:', e.message)
    return yearFolderId
  }
}

/**
 * Move a Drive file from its current parent(s) to newFolderId.
 * Uses PATCH /files/{fileId}?addParents=&removeParents=
 */
export async function moveFile(accessToken, fileId, newFolderId) {
  // First, GET file metadata to find current parents
  const metaRes = await fetch(`${DRIVE_API}/files/${fileId}?fields=parents`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!metaRes.ok) {
    throw new Error(`moveFile: GET metadata failed: ${metaRes.status} ${await metaRes.text()}`)
  }
  const meta = await metaRes.json()
  const currentParents = (meta.parents || []).join(',')

  const patchRes = await fetch(
    `${DRIVE_API}/files/${fileId}?addParents=${encodeURIComponent(newFolderId)}&removeParents=${encodeURIComponent(currentParents)}&fields=id,parents`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    }
  )
  if (!patchRes.ok) {
    throw new Error(`moveFile: PATCH failed: ${patchRes.status} ${await patchRes.text()}`)
  }
  return patchRes.json()
}

/**
 * Rename a Drive file or folder.
 * Uses PATCH /files/{id} with { name }
 */
export async function renameFile(accessToken, fileId, newName) {
  const res = await fetch(`${DRIVE_API}/files/${fileId}?fields=id,name`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: newName }),
  })
  if (!res.ok) {
    throw new Error(`renameFile: PATCH failed: ${res.status} ${await res.text()}`)
  }
  return res.json()
}
