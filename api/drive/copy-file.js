import { getUserFromReq, getServiceClient } from '../lib/auth.js'
import { getValidToken, copyFileToDrive } from '../lib/driveClient.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  try {
    const user = getUserFromReq(req)
    if (!user) return res.status(401).json({ error: 'Unauthorized' })

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

    const { sourceFileId, targetReceiptId } = body || {}
    if (!sourceFileId || !targetReceiptId) {
      return res.status(400).json({ error: 'sourceFileId and targetReceiptId required' })
    }

    const serviceClient = getServiceClient()

    const { data: receipt } = await serviceClient
      .from('receipts')
      .select('filename')
      .eq('id', targetReceiptId)
      .eq('user_id', user.userId)
      .maybeSingle()

    if (!receipt) return res.status(404).json({ error: 'Receipt not found' })

    const accessToken = await getValidToken(user.userId, serviceClient)
    if (!accessToken) return res.status(200).json({ skipped: 'no drive token' })

    const { data: userData } = await serviceClient
      .from('users')
      .select('drive_inbox_id, drive_folder_id')
      .eq('id', user.userId)
      .single()

    const folderId = userData?.drive_inbox_id || userData?.drive_folder_id
    if (!folderId) return res.status(200).json({ skipped: 'no folder' })

    const baseName = (receipt.filename || 'receipt').replace(/^tmp_[^_]+_/, '')
    const tempName = `tmp_${Date.now()}_${baseName}`

    const copied = await copyFileToDrive(accessToken, sourceFileId, folderId, tempName)

    await serviceClient
      .from('receipts')
      .update({ drive_file_id: copied.id, drive_url: copied.webViewLink, filename: tempName })
      .eq('id', targetReceiptId)

    return res.status(200).json({ fileId: copied.id, fileUrl: copied.webViewLink })
  } catch (e) {
    console.error('copy-file error:', e.message)
    return res.status(200).json({ error: e.message })
  }
}
