import Anthropic from '@anthropic-ai/sdk'
import { getServiceClient } from '../lib/auth.js'
import {
  getValidToken, listSubfolders, listFolderContents,
  downloadFileContent, findOrCreateFolder, moveFile,
} from '../lib/driveClient.js'
import {
  EXTRACT_PROMPT, validateExtracted, generateFilename,
  findPatternMatch, applyTaxCalculations,
} from '../lib/extractUtils.js'

const ALLOWED_MIME = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf',
])
const MAX_FILE_BYTES = 20 * 1024 * 1024

export default async function handler(req, res) {
  // Respond to Google immediately — must be < 5 seconds
  res.status(200).end()

  const channelId = req.headers['x-goog-channel-id']
  const userId = req.headers['x-goog-channel-token']
  const state = req.headers['x-goog-resource-state']

  if (!channelId || !userId) return
  if (state === 'sync') return

  try {
    await processDropZone(channelId, userId)
  } catch (e) {
    console.error('drive/ingest unhandled:', e?.message)
  }
}

async function processDropZone(channelId, userId) {
  const serviceClient = getServiceClient()

  const { data: userData } = await serviceClient
    .from('users')
    .select('drive_watch_channel_id, drive_folder_id')
    .eq('id', userId)
    .single()

  if (!userData || userData.drive_watch_channel_id !== channelId) return
  if (!userData.drive_folder_id) return

  const accessToken = await getValidToken(userId, serviceClient)
  if (!accessToken) return

  const rootId = userData.drive_folder_id

  // List all account folders under Récu/
  const accountFolders = await listSubfolders(accessToken, rootId)
  if (!accountFolders.length) return

  // Collect files from {Account}/_to_process/ across all accounts
  const allFiles = []
  for (const accFolder of accountFolders) {
    try {
      // Find _to_process/ inside this account folder
      const subfolders = await listSubfolders(accessToken, accFolder.id)
      const toProcessFolder = subfolders.find(f => f.name === '_to_process')
      if (!toProcessFolder) continue

      const contents = await listFolderContents(accessToken, toProcessFolder.id)
      for (const item of contents) {
        if (item.mimeType !== 'application/vnd.google-apps.folder') {
          allFiles.push({ ...item, accountName: accFolder.name, accFolderId: accFolder.id })
        }
      }
    } catch (e) {
      console.error(`drive/ingest: error listing _to_process for "${accFolder.name}":`, e?.message)
    }
  }

  if (!allFiles.length) return

  // Dedup against already-processed files
  const { data: processedRows } = await serviceClient
    .from('drive_processed_files')
    .select('drive_file_id')
    .in('drive_file_id', allFiles.map(f => f.id))

  const processedIds = new Set(processedRows?.map(r => r.drive_file_id) || [])
  const toProcess = allFiles.filter(f => !processedIds.has(f.id))
  if (!toProcess.length) return

  const { data: patterns } = await serviceClient.from('patterns').select('*').eq('user_id', userId)
  const anthropic = new Anthropic()

  for (const file of toProcess) {
    try {
      await processFile({ file, userId, serviceClient, accessToken, anthropic, patterns })
    } catch (e) {
      console.error('drive/ingest: failed to process file:', file.id, e?.message)
      await serviceClient.from('drive_processed_files')
        .insert({ user_id: userId, drive_file_id: file.id })
        .onConflict('drive_file_id').ignore()
    }
  }
}

async function processFile({ file, userId, serviceClient, accessToken, anthropic, patterns }) {
  if (!ALLOWED_MIME.has(file.mimeType)) {
    await serviceClient.from('drive_processed_files')
      .insert({ user_id: userId, drive_file_id: file.id })
      .onConflict('drive_file_id').ignore()
    return
  }

  const { base64, mimeType, size } = await downloadFileContent(accessToken, file.id)
  if (size > MAX_FILE_BYTES) {
    await serviceClient.from('drive_processed_files')
      .insert({ user_id: userId, drive_file_id: file.id })
      .onConflict('drive_file_id').ignore()
    return
  }

  const claudeContent = mimeType === 'application/pdf'
    ? [{ type: 'document', source: { type: 'base64', media_type: mimeType, data: base64 } }, { type: 'text', text: EXTRACT_PROMPT }]
    : [{ type: 'image', source: { type: 'base64', media_type: mimeType, data: base64 } }, { type: 'text', text: EXTRACT_PROMPT }]

  let extracted
  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: 'You are extracting data from a receipt or invoice for a Canadian small business expense tracking app. Return ONLY a valid JSON object — no markdown, no explanation. For missing fields use null. For amounts use numbers only.',
      messages: [{ role: 'user', content: claudeContent }],
    })
    let raw = message.content[0].text.trim()
    if (raw.startsWith('```')) raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
    extracted = validateExtracted(JSON.parse(raw))
  } catch {
    extracted = { vendor: null, invoice_date: null, total: null, confidence: { overall: 'low' } }
  }

  const confidenceScores = applyTaxCalculations(extracted)
  const patternMatch = findPatternMatch(patterns, extracted.vendor)

  // Labels: pattern match takes priority, then the source account folder
  const labels = patternMatch?.labels ?? {}
  if (!labels.property && file.accountName !== '_unassigned') {
    labels.property = file.accountName
  }

  const { data: receipt, error } = await serviceClient.from('receipts').insert({
    user_id: userId,
    status: 'pending',
    vendor: extracted.vendor,
    invoice_date: extracted.invoice_date,
    invoice_number: extracted.invoice_number,
    description: extracted.description,
    subtotal: extracted.subtotal,
    gst: extracted.gst,
    qst: extracted.qst,
    hst: extracted.hst,
    total: extracted.total,
    currency: 'CAD',
    vendor_gst_number: extracted.vendor_gst_number,
    vendor_qst_number: extracted.vendor_qst_number,
    payment_method: extracted.payment_method || null,
    filename: file.name,
    drive_file_id: file.id,
    drive_url: `https://drive.google.com/file/d/${file.id}/view`,
    source: 'drive_drop',
    extracted_raw: extracted,
    confidence_scores: confidenceScores,
    labels,
  }).select('id').single()

  if (error) {
    console.error('drive/ingest: DB insert failed:', error.message)
    return
  }

  // Move file from _to_process/ to _for_review/ within the same account folder
  try {
    const reviewFolder = await findOrCreateFolder(accessToken, '_for_review', file.accFolderId)
    await moveFile(accessToken, file.id, reviewFolder.id)
  } catch (e) {
    console.error('drive/ingest: move to _for_review failed (non-fatal):', e?.message)
  }

  await serviceClient.from('drive_processed_files')
    .insert({ user_id: userId, drive_file_id: file.id, receipt_id: receipt.id })
    .onConflict('drive_file_id').ignore()
}
