import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { getServiceClient } from './lib/auth.js'
import { getValidToken, uploadFileToDrive, findOrCreateFolder } from './lib/driveClient.js'
import {
  EXTRACT_PROMPT,
  validateExtracted,
  generateFilename,
  findPatternMatch,
  applyTaxCalculations,
  normalizeVendor,
  fuzzyMatch,
} from './lib/extractUtils.js'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/heif',
  'image/webp',
  'application/pdf',
])
const MAX_PAGE_BYTES = 10 * 1024 * 1024
const MAX_TOTAL_BYTES = 20 * 1024 * 1024
const RATE_LIMIT_PER_HOUR = 20


function parseBody(req) {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (chunk) => { data += chunk })
    req.on('end', () => {
      try { resolve(JSON.parse(data)) } catch (e) { reject(e) }
    })
    req.on('error', reject)
  })
}

function decodeJwtPayload(token) {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(Buffer.from(base64, 'base64').toString('utf8'))
  } catch {
    return null
  }
}

export default async function handler(req, res) {
  try {
    return await _handler(req, res)
  } catch (e) {
    console.error('Unhandled extract error:', e?.message ?? e, '\nStack:', e?.stack)
    if (!res.headersSent) res.status(500).json({ error: 'internal' })
  }
}

async function _handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  const token = authHeader.slice(7)

  // Decode JWT payload — signature is verified by Supabase RLS on every DB call
  const payload = decodeJwtPayload(token)
  if (!payload?.sub || !payload?.exp || payload.exp < Date.now() / 1000) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  const userId = payload.sub

  // Authenticated client — Supabase verifies JWT signature via RLS on every query
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  )

  // Rate limit: count receipts created in the last hour
  const oneHourAgo = new Date(Date.now() - 3_600_000).toISOString()
  const { count } = await supabase
    .from('receipts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', oneHourAgo)
  if ((count ?? 0) >= RATE_LIMIT_PER_HOUR) {
    return res.status(429).json({ error: 'error_rate' })
  }

  let body
  try {
    if (req.body != null) {
      body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    } else {
      body = await parseBody(req)
    }
  } catch (e) {
    console.error('Body parse failed:', e?.message)
    return res.status(400).json({ error: 'Bad request' })
  }

  const { pages, userId: bodyUserId } = body ?? {}
  if (!Array.isArray(pages) || pages.length === 0 || bodyUserId !== userId) {
    console.error('Validation failed:', { hasPages: Array.isArray(pages), count: pages?.length, userMatch: bodyUserId === userId })
    return res.status(400).json({ error: 'Bad request' })
  }

  // Validate files
  let totalBytes = 0
  for (const page of pages) {
    if (!ALLOWED_TYPES.has(page.mimeType) || !page.fileBase64) {
      return res.status(400).json({ error: 'error_type' })
    }
    const bytes = Math.ceil((page.fileBase64.length * 3) / 4)
    if (bytes > MAX_PAGE_BYTES) return res.status(400).json({ error: 'error_size' })
    totalBytes += bytes
  }
  if (totalBytes > MAX_TOTAL_BYTES) return res.status(400).json({ error: 'error_size' })

  // Build Claude content blocks — one per page + text prompt
  const claudeContent = pages.map(({ fileBase64, mimeType }) => {
    if (mimeType === 'application/pdf') {
      return {
        type: 'document',
        source: { type: 'base64', media_type: mimeType, data: fileBase64 },
      }
    }
    return {
      type: 'image',
      source: { type: 'base64', media_type: mimeType, data: fileBase64 },
    }
  })

  claudeContent.push({ type: 'text', text: EXTRACT_PROMPT })

  let extracted
  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system:
        'You are extracting data from a receipt or invoice for a Canadian small business expense tracking app. The document may have multiple pages — treat all pages as one single invoice. Extract all fields from across all pages and return ONLY a valid JSON object — no markdown, no explanation. For missing fields use null. For amounts use numbers only. Detect the document language automatically.',
      messages: [{ role: 'user', content: claudeContent }],
    })
    let raw = message.content[0].text.trim()
    if (raw.startsWith('```')) {
      raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
    }
    extracted = validateExtracted(JSON.parse(raw))
  } catch (e) {
    console.error('Claude extraction error:', e)
    return res.status(500).json({ error: 'extraction_failed' })
  }

  const confidenceScores = applyTaxCalculations(extracted)
  const filename = generateFilename(extracted)

  const { data: patterns } = await supabase
    .from('patterns')
    .select('*')
    .eq('user_id', userId)

  const patternMatch = findPatternMatch(patterns, extracted.vendor)

  // Insert receipt row
  const receiptRow = {
    user_id: userId,
    status: 'pending',
    vendor: extracted.vendor,
    invoice_date: extracted.invoice_date,
    invoice_number: extracted.invoice_number,
    description: extracted.description,
    keyword: extracted.keyword,
    subtotal: extracted.subtotal,
    gst: extracted.gst,
    qst: extracted.qst,
    hst: extracted.hst,
    total: extracted.total,
    currency: 'CAD',
    vendor_gst_number: extracted.vendor_gst_number,
    vendor_qst_number: extracted.vendor_qst_number,
    vendor_neq: extracted.vendor_neq,
    vendor_bn: extracted.vendor_bn,
    payment_method: extracted.payment_method || null,
    filename,
    source: body.source || 'upload',
    extracted_raw: extracted,
    confidence_scores: confidenceScores,
    labels: patternMatch?.labels ?? {},
  }

  const { data: receipt, error: dbError } = await supabase
    .from('receipts')
    .insert(receiptRow)
    .select()
    .single()

  if (dbError) {
    console.error('DB insert error:', dbError)
    return res.status(500).json({ error: 'db_error' })
  }

  // Upload to Drive if user has connected it (best-effort — never blocks the response)
  let driveUrl = null
  let driveFileId = null
  try {
    const serviceClient = getServiceClient()
    const { data: userData } = await serviceClient
      .from('users')
      .select('drive_folder_id')
      .eq('id', userId)
      .single()

    if (userData?.drive_folder_id) {
      const accessToken = await getValidToken(userId, serviceClient)
      if (accessToken) {
        // Route to {account}/_for_review/ (or _unassigned/_for_review/ if no pattern match).
        // For shared accounts, use the owner's Drive root so the file lands in the right place.
        const accountName = patternMatch?.labels?.property || '_unassigned'
        let driveRootId = userData.drive_folder_id
        if (accountName !== '_unassigned') {
          const { data: share } = await serviceClient
            .from('account_shares')
            .select('owner_id')
            .eq('shared_with_id', userId)
            .eq('account_name', accountName)
            .eq('status', 'accepted')
            .maybeSingle()
          if (share?.owner_id) {
            const { data: ownerData } = await serviceClient
              .from('users').select('drive_folder_id').eq('id', share.owner_id).single()
            if (ownerData?.drive_folder_id) driveRootId = ownerData.drive_folder_id
          }
        }
        const accFolder = await findOrCreateFolder(accessToken, accountName, driveRootId)
        const reviewFolder = await findOrCreateFolder(accessToken, '_for_review', accFolder.id)

        const firstPage = pages[0]
        const ext = firstPage.mimeType === 'application/pdf' ? '.pdf' : '.jpg'
        const uploaded = await uploadFileToDrive(
          accessToken, `${filename}${ext}`, firstPage.mimeType, firstPage.fileBase64, reviewFolder.id
        )
        driveUrl = uploaded.webViewLink
        driveFileId = uploaded.id

        // Upload additional pages (multi-page receipts)
        for (let i = 1; i < pages.length; i++) {
          const p = pages[i]
          const pageExt = p.mimeType === 'application/pdf' ? '.pdf' : '.jpg'
          await uploadFileToDrive(
            accessToken, `${filename} - p${i + 1}${pageExt}`, p.mimeType, p.fileBase64, reviewFolder.id
          )
        }

        await supabase.from('receipts').update({ drive_url: driveUrl, drive_file_id: driveFileId }).eq('id', receipt.id)
      }
    }
  } catch (driveErr) {
    console.error('Drive upload (non-critical):', driveErr?.message)
  }

  // Duplicate detection: same vendor + same total + invoice_date within 3 days
  let possibleDuplicate = null
  if (extracted.vendor && extracted.total != null && extracted.invoice_date) {
    const d = new Date(extracted.invoice_date)
    const { data: similar } = await supabase
      .from('receipts')
      .select('id, vendor, total, invoice_date, created_at')
      .eq('user_id', userId)
      .eq('status', 'confirmed')
      .neq('id', receipt.id)
      .gte('invoice_date', new Date(d.getTime() - 3 * 86_400_000).toISOString().slice(0, 10))
      .lte('invoice_date', new Date(d.getTime() + 3 * 86_400_000).toISOString().slice(0, 10))

    if (similar?.length) {
      const vn = normalizeVendor(extracted.vendor)
      possibleDuplicate =
        similar.find(
          (s) =>
            fuzzyMatch(normalizeVendor(s.vendor || ''), vn) &&
            Math.abs((s.total || 0) - extracted.total) < 0.01,
        ) ?? null
    }
  }

  return res.status(200).json({
    id: receipt.id,
    extracted,
    filename,
    confidenceScores,
    patternApplied: !!patternMatch,
    possibleDuplicate,
    driveUrl,
  })
}
