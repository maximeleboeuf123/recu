import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/webp',
  'application/pdf',
])
const MAX_PAGE_BYTES = 10 * 1024 * 1024
const MAX_TOTAL_BYTES = 20 * 1024 * 1024
const RATE_LIMIT_PER_HOUR = 20

function normalizeVendor(name) {
  return (name || '')
    .toLowerCase()
    .replace(/[.,'\-&]/g, '')
    .replace(/\b(inc|ltd|ltée|ltee|corp|llc|co)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function fuzzyMatch(a, b) {
  if (!a || !b) return false
  if (a === b) return true
  if (a.length < 5 || b.length < 5) return false
  return a.includes(b) || b.includes(a)
}

function generateFilename(extracted) {
  const dateStr = extracted.invoice_date || new Date().toISOString().slice(0, 10)
  const vendorSafe = (extracted.vendor || 'Unknown')
    .replace(/[^a-zA-Z0-9\s\-éàèùâêîôûçÉÀÈÙÂÊÎÔÛÇ]/g, '')
    .slice(0, 40)
    .trim()
  const keyword = extracted.keyword || 'recu'
  const invPart = extracted.invoice_number ? ` - ${extracted.invoice_number}` : ''
  return `${dateStr} - ${vendorSafe} - ${keyword}${invPart}`
}

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

  const { pages, userId: bodyUserId } = await parseBody(req)
  if (!Array.isArray(pages) || pages.length === 0 || bodyUserId !== userId) {
    return res.status(400).json({ error: 'Bad request' })
  }

  // Validate files
  let totalBytes = 0
  for (const page of pages) {
    if (!ALLOWED_TYPES.has(page.mimeType)) {
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

  claudeContent.push({
    type: 'text',
    text: `Extract all data from this receipt or invoice:
{
  "vendor": "company or person name",
  "invoice_date": "YYYY-MM-DD or null",
  "invoice_number": "reference number or null",
  "description": "one sentence describing the expense",
  "keyword": "single most meaningful word from description",
  "subtotal": number or null,
  "gst": number or null,
  "qst": number or null,
  "hst": number or null,
  "total": number or null,
  "currency": "CAD or USD or EUR or detected currency code",
  "vendor_gst_number": "RT-XXXXXXXXX format or null",
  "vendor_qst_number": "XXXXXXXXXX TQ XXXX format or null",
  "vendor_neq": "10 digit number or null",
  "vendor_bn": "9 digit number or null",
  "confidence": {
    "vendor": "high/medium/low",
    "invoice_date": "high/medium/low",
    "total": "high/medium/low",
    "overall": "high/medium/low"
  }
}`,
  })

  let extracted
  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system:
        'You are extracting data from a receipt or invoice for a Canadian small business expense tracking app. The document may have multiple pages — treat all pages as one single invoice. Extract all fields from across all pages and return ONLY a valid JSON object — no markdown, no explanation. For missing fields use null. For amounts use numbers only. Detect the document language automatically.',
      messages: [{ role: 'user', content: claudeContent }],
    })
    extracted = JSON.parse(message.content[0].text)
  } catch (e) {
    console.error('Claude extraction error:', e)
    return res.status(500).json({ error: 'extraction_failed' })
  }

  // Auto-calculate taxes if not found
  const confidenceScores = { ...(extracted.confidence || {}) }
  const sub = extracted.subtotal

  if (sub != null && extracted.gst == null) {
    extracted.gst = Math.round(sub * 0.05 * 100) / 100
    confidenceScores.gst_source = 'calculated'
  } else {
    confidenceScores.gst_source = 'extracted'
  }
  if (sub != null && extracted.qst == null) {
    extracted.qst = Math.round(sub * 0.09975 * 100) / 100
    confidenceScores.qst_source = 'calculated'
  } else {
    confidenceScores.qst_source = 'extracted'
  }
  if (extracted.total == null && sub != null) {
    extracted.total =
      Math.round(
        (sub + (extracted.gst || 0) + (extracted.qst || 0) + (extracted.hst || 0)) * 100,
      ) / 100
  }

  const filename = generateFilename(extracted)

  // Check patterns table for vendor match
  const normalizedVendor = normalizeVendor(extracted.vendor)
  const { data: patterns } = await supabase
    .from('patterns')
    .select('*')
    .eq('user_id', userId)

  let patternMatch = null
  if (patterns?.length) {
    for (const p of patterns) {
      if (fuzzyMatch(normalizeVendor(p.vendor_pattern), normalizedVendor)) {
        patternMatch = p
        break
      }
    }
  }

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
    currency: extracted.currency || 'CAD',
    vendor_gst_number: extracted.vendor_gst_number,
    vendor_qst_number: extracted.vendor_qst_number,
    vendor_neq: extracted.vendor_neq,
    vendor_bn: extracted.vendor_bn,
    filename,
    source: 'manual',
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
  })
}
