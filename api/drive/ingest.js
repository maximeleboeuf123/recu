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
  if (state === 'sync') return // Initial handshake — no work to do

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
    .select('drive_watch_channel_id, drive_to_process_id, drive_review_folder_id')
    .eq('id', userId)
    .single()

  if (!userData || userData.drive_watch_channel_id !== channelId) return
  if (!userData.drive_to_process_id) return

  const accessToken = await getValidToken(userId, serviceClient)
  if (!accessToken) return

  const toProcessId = userData.drive_to_process_id
  const reviewRootId = userData.drive_review_folder_id

  // Collect all files in _to_process/ (root + account sub-folders)
  const allFiles = []
  const [rootContents, subfolders] = await Promise.all([
    listFolderContents(accessToken, toProcessId),
    listSubfolders(accessToken, toProcessId),
  ])

  for (const item of rootContents) {
    if (item.mimeType !== 'application/vnd.google-apps.folder') {
      allFiles.push({ ...item, accountName: null })
    }
  }

  for (const subfolder of subfolders) {
    const contents = await listFolderContents(accessToken, subfolder.id)
    for (const item of contents) {
      if (item.mimeType !== 'application/vnd.google-apps.folder') {
        allFiles.push({ ...item, accountName: subfolder.name })
      }
    }
  }

  if (!allFiles.length) return

  // Find which files are already processed
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
      await processFile({ file, userId, serviceClient, accessToken, anthropic, patterns, reviewRootId })
    } catch (e) {
      console.error('drive/ingest: failed to process file:', file.id, e?.message)
      // Mark as processed anyway to avoid infinite retry loops
      await serviceClient.from('drive_processed_files')
        .insert({ user_id: userId, drive_file_id: file.id })
        .onConflict('drive_file_id').ignore()
    }
  }
}

async function processFile({ file, userId, serviceClient, accessToken, anthropic, patterns, reviewRootId }) {
  // Skip unsupported file types — mark processed so we don't retry
  if (!ALLOWED_MIME.has(file.mimeType)) {
    await serviceClient.from('drive_processed_files')
      .insert({ user_id: userId, drive_file_id: file.id })
      .onConflict('drive_file_id').ignore()
    return
  }

  // Download file
  const { base64, mimeType, size } = await downloadFileContent(accessToken, file.id)
  if (size > MAX_FILE_BYTES) {
    await serviceClient.from('drive_processed_files')
      .insert({ user_id: userId, drive_file_id: file.id })
      .onConflict('drive_file_id').ignore()
    return
  }

  // Extract with Claude
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

  // Labels: prefer pattern match, fall back to account subfolder name
  const labels = patternMatch?.labels ?? {}
  if (file.accountName && !labels.property) labels.property = file.accountName

  // Create pending receipt
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

  // Move file from _to_process/ to _for_review/{accountName}/
  if (reviewRootId) {
    try {
      let targetFolderId = reviewRootId
      if (labels.property) {
        const accountFolder = await findOrCreateFolder(accessToken, labels.property, reviewRootId)
        targetFolderId = accountFolder.id
      }
      await moveFile(accessToken, file.id, targetFolderId)
    } catch (e) {
      console.error('drive/ingest: move to _for_review failed (non-fatal):', e?.message)
    }
  }

  // Mark as processed
  await serviceClient.from('drive_processed_files')
    .insert({ user_id: userId, drive_file_id: file.id, receipt_id: receipt.id })
    .onConflict('drive_file_id').ignore()
}
