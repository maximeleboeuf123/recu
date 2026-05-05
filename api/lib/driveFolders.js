import { findOrCreateFolder } from './driveClient.js'

const DRIVE_API = 'https://www.googleapis.com/drive/v3'

/**
 * Resolve (or lazily create) the Drive folder for a confirmed receipt.
 * Hierarchy: Récu/{Account}/_receipts/{Year}/{Category}
 * Falls back up the chain if data is missing.
 * Receipts with no account go to Récu/_unassigned/_receipts/{Year}/.
 */
export async function ensureReceiptFolder(serviceClient, userId, accessToken, labels, invoiceDate) {
  const { data: userData } = await serviceClient
    .from('users')
    .select('drive_folder_id')
    .eq('id', userId)
    .maybeSingle()

  const rootId = userData?.drive_folder_id
  if (!rootId) return null

  const accountName = labels?.property || '_unassigned'
  const categoryName = labels?.category

  let year = new Date().getFullYear()
  if (invoiceDate) {
    const parsed = new Date(invoiceDate)
    if (!isNaN(parsed.getTime())) year = parsed.getFullYear()
  }

  // Récu/{Account}/
  let accountFolderId = null
  let dimensionId = null
  try {
    const { data: dim } = await serviceClient
      .from('dimensions')
      .select('id, drive_folder_id')
      .eq('user_id', userId)
      .eq('type', 'account')
      .eq('name', accountName)
      .maybeSingle()

    dimensionId = dim?.id ?? null

    if (dim?.drive_folder_id) {
      accountFolderId = dim.drive_folder_id
    } else {
      const folder = await findOrCreateFolder(accessToken, accountName, rootId)
      accountFolderId = folder.id
      if (dim) {
        await serviceClient.from('dimensions').update({ drive_folder_id: folder.id }).eq('id', dim.id)
      }
    }
  } catch (e) {
    console.error('ensureReceiptFolder: account folder error:', e.message)
    return rootId
  }

  // Récu/{Account}/_receipts/
  let receiptsFolderId = null
  try {
    const receiptsFolder = await findOrCreateFolder(accessToken, '_receipts', accountFolderId)
    receiptsFolderId = receiptsFolder.id
  } catch (e) {
    console.error('ensureReceiptFolder: _receipts folder error:', e.message)
    return accountFolderId
  }

  // Récu/{Account}/_receipts/{Year}/
  let yearFolderId = null
  try {
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
        const yearFolder = await findOrCreateFolder(accessToken, String(year), receiptsFolderId)
        yearFolderId = yearFolder.id
        await serviceClient.from('drive_year_folders').upsert({
          user_id: userId,
          dimension_id: dimensionId,
          year,
          drive_folder_id: yearFolder.id,
        })
      }
    } else {
      const yearFolder = await findOrCreateFolder(accessToken, String(year), receiptsFolderId)
      yearFolderId = yearFolder.id
    }
  } catch (e) {
    console.error('ensureReceiptFolder: year folder error:', e.message)
    return receiptsFolderId
  }

  if (!categoryName) return yearFolderId

  // Récu/{Account}/_receipts/{Year}/{Category}/
  try {
    const categoryFolder = await findOrCreateFolder(accessToken, categoryName, yearFolderId)
    return categoryFolder.id
  } catch (e) {
    console.error('ensureReceiptFolder: category folder error:', e.message)
    return yearFolderId
  }
}

export async function moveFile(accessToken, fileId, newFolderId) {
  const metaRes = await fetch(`${DRIVE_API}/files/${fileId}?fields=parents`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!metaRes.ok) {
    throw new Error(`moveFile: GET metadata failed: ${metaRes.status} ${await metaRes.text()}`)
  }
  const meta = await metaRes.json()
  const currentParents = (meta.parents || []).join(',')

  const patchRes = await fetch(
    `${DRIVE_API}/files/${fileId}?addParents=${newFolderId}&removeParents=${currentParents}&fields=id,parents`,
    {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }
  )
  if (!patchRes.ok) {
    throw new Error(`moveFile: PATCH failed: ${patchRes.status} ${await patchRes.text()}`)
  }
  return patchRes.json()
}

export async function renameFile(accessToken, fileId, newName) {
  const res = await fetch(`${DRIVE_API}/files/${fileId}?fields=id,name`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: newName }),
  })
  if (!res.ok) {
    throw new Error(`renameFile: PATCH failed: ${res.status} ${await res.text()}`)
  }
  return res.json()
}
