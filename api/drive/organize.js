import { getUserFromReq, getServiceClient } from '../lib/auth.js'
import { getValidToken } from '../lib/driveClient.js'
import { ensureReceiptFolder, moveFile, renameFile } from '../lib/driveFolders.js'

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

    const { receiptId } = body || {}
    if (!receiptId) return res.status(400).json({ error: 'receiptId required' })

    const serviceClient = getServiceClient()

    // Fetch receipt
    const { data: receipt } = await serviceClient
      .from('receipts')
      .select('id, drive_file_id, labels, invoice_date, vendor, filename')
      .eq('id', receiptId)
      .eq('user_id', user.userId)
      .maybeSingle()

    if (!receipt) return res.status(404).json({ error: 'Receipt not found' })
    if (!receipt.drive_file_id) return res.status(200).json({ success: true, skipped: 'no drive_file_id' })

    // Get valid Drive token (guest's own token — they have write access to shared folders)
    const accessToken = await getValidToken(user.userId, serviceClient)
    if (!accessToken) return res.status(200).json({ success: true, skipped: 'no drive token' })

    // Resolve which user's dimension data / Drive root to use.
    // For receipts assigned to a shared account, folder IDs live under the owner's rows.
    let driveUserId = user.userId
    const accountName = receipt.labels?.property
    if (accountName) {
      const { data: share } = await serviceClient
        .from('account_shares')
        .select('owner_id')
        .eq('shared_with_id', user.userId)
        .eq('account_name', accountName)
        .eq('status', 'accepted')
        .maybeSingle()
      if (share?.owner_id) driveUserId = share.owner_id
    }

    // Build final filename: {YYYY-MM-DD}_{vendor}_{original_filename}
    // Strip any tmp_*_ prefix from filename
    let originalFilename = receipt.filename || 'receipt'
    originalFilename = originalFilename.replace(/^tmp_[^_]+_/, '')

    const datePart = receipt.invoice_date
      ? receipt.invoice_date.slice(0, 10)
      : new Date().toISOString().slice(0, 10)

    const vendorPart = receipt.vendor
      ? receipt.vendor.replace(/[/\\:*?"<>|]/g, '-').trim()
      : null

    const finalName = vendorPart
      ? `${datePart}_${vendorPart}_${originalFilename}`
      : `${datePart}_${originalFilename}`

    // Rename file in Drive (best-effort)
    try {
      await renameFile(accessToken, receipt.drive_file_id, finalName)
    } catch (e) {
      console.error('organize: renameFile failed:', e.message)
      // continue — still try to move
    }

    // Resolve target folder
    let targetFolderId = null
    try {
      targetFolderId = await ensureReceiptFolder(
        serviceClient,
        driveUserId,
        accessToken,
        receipt.labels,
        receipt.invoice_date
      )
    } catch (e) {
      console.error('organize: ensureReceiptFolder failed:', e.message)
    }

    // Move file to target folder (best-effort)
    if (targetFolderId) {
      try {
        await moveFile(accessToken, receipt.drive_file_id, targetFolderId)
      } catch (e) {
        console.error('organize: moveFile failed:', e.message)
      }
    }

    return res.status(200).json({ success: true })
  } catch (e) {
    console.error('organize handler error:', e.message)
    return res.status(200).json({ success: true, error: e.message })
  }
}
