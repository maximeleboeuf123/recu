import Anthropic from '@anthropic-ai/sdk'
import { getServiceClient } from './lib/auth.js'
import { getValidToken, uploadFileToDrive } from './lib/driveClient.js'
import {
  EXTRACT_PROMPT,
  validateExtracted,
  generateFilename,
  findPatternMatch,
  applyTaxCalculations,
} from './lib/extractUtils.js'

const RATE_LIMIT_EMAIL_PER_HOUR = 20
const ALLOWED_MIME = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf',
])
const MIN_IMAGE_BYTES = 4096 // skip tiny images (logos/signatures)


function parseBody(req) {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', c => { data += c })
    req.on('end', () => { try { resolve(JSON.parse(data)) } catch (e) { reject(e) } })
    req.on('error', reject)
  })
}

function extractEmail(from) {
  if (!from) return null
  const match = from.match(/<([^>]+)>/) || from.match(/([^\s<>]+@[^\s<>]+)/)
  return match?.[1]?.toLowerCase() ?? null
}


function stripHtml(html) {
  return (html || '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function pickBestAttachment(attachments) {
  // Prefer PDFs; among images, prefer the largest (thumbnails/logos tend to be tiny)
  const pdfs = attachments.filter(a => a.ContentType === 'application/pdf')
  if (pdfs.length) return pdfs.sort((a, b) => (b.ContentLength || 0) - (a.ContentLength || 0))[0]
  const images = attachments.filter(a => {
    const bytes = a.ContentLength || Math.ceil((a.Content?.length || 0) * 3 / 4)
    return bytes >= MIN_IMAGE_BYTES
  })
  const pool = images.length ? images : attachments
  return pool.sort((a, b) => (b.ContentLength || 0) - (a.ContentLength || 0))[0]
}

function buildEml({ from, subject, messageId, textBody, htmlBody }) {
  const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).slice(2)}`
  const lines = [
    `From: ${from || ''}`,
    `Subject: ${subject || '(no subject)'}`,
    `Date: ${new Date().toUTCString()}`,
    messageId ? `Message-ID: ${messageId}` : null,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
  ].filter(l => l !== null)

  if (textBody) {
    lines.push(`--${boundary}`, 'Content-Type: text/plain; charset=utf-8', '', textBody, '')
  }
  if (htmlBody) {
    lines.push(`--${boundary}`, 'Content-Type: text/html; charset=utf-8', '', htmlBody, '')
  }
  lines.push(`--${boundary}--`)
  return lines.join('\r\n')
}

async function sendReply(to, subject, receipt) {
  const lines = [
    'Your receipt has been captured and is pending review in Récu.',
    '',
    receipt.vendor ? `Vendor: ${receipt.vendor}` : null,
    receipt.invoice_date ? `Date: ${receipt.invoice_date}` : null,
    receipt.total != null ? `Total: $${receipt.total} CAD` : null,
    '',
    'Open Récu to review and confirm: https://monrecu.app/review',
  ].filter(l => l !== null)

  await fetch('https://api.postmarkapp.com/email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Postmark-Server-Token': process.env.POSTMARK_API_KEY,
    },
    body: JSON.stringify({
      From: 'Récu <noreply@monrecu.app>',
      To: to,
      Subject: subject ? `Re: ${subject}` : 'Receipt captured — pending review',
      TextBody: lines.join('\n'),
    }),
  })
}

export default async function handler(req, res) {
  try { return await _handler(req, res) } catch (e) {
    console.error('inbound-email unhandled:', e?.message, e?.stack)
    if (!res.headersSent) res.status(200).end() // always ack to Postmark
  }
}

async function _handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  // Verify webhook token
  const token = req.query?.token
  if (!token || token !== process.env.POSTMARK_WEBHOOK_TOKEN) return res.status(401).end()

  // Parse body
  let body
  try {
    if (req.body != null) {
      body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    } else {
      body = await parseBody(req)
    }
  } catch { return res.status(200).end() }

  const { From, To, OriginalRecipient, MessageID, Subject, TextBody, HtmlBody, Attachments = [] } = body || {}

  const serviceClient = getServiceClient()

  // Route by recipient slug (personal inbox address) — primary method
  let userId = null
  const toRaw = OriginalRecipient || To || ''
  const toEmail = extractEmail(toRaw)
  const toSlug = toEmail?.split('@')[0]?.toLowerCase()
  if (toSlug) {
    const { data: bySlug } = await serviceClient
      .from('users')
      .select('id')
      .eq('inbox_slug', toSlug)
      .maybeSingle()
    userId = bySlug?.id || null
  }

  // Fallback: route by sender email for users who haven't been assigned a slug yet
  const senderEmail = extractEmail(From)
  if (!userId && senderEmail) {
    const { data } = await serviceClient
      .rpc('get_user_id_by_email', { lookup_email: senderEmail })
    userId = data || null
  }

  if (!userId) return res.status(200).end()

  // MessageID dedup
  if (MessageID) {
    const { count } = await serviceClient
      .from('receipts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .contains('extracted_raw', { messageId: MessageID })
    if ((count ?? 0) > 0) return res.status(200).end()
  }

  // Rate limit
  const oneHourAgo = new Date(Date.now() - 3_600_000).toISOString()
  const { count: recentCount } = await serviceClient
    .from('receipts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('source', 'email')
    .gte('created_at', oneHourAgo)
  if ((recentCount ?? 0) >= RATE_LIMIT_EMAIL_PER_HOUR) return res.status(200).end()

  // Select content for extraction
  const validAttachments = Attachments.filter(a => ALLOWED_MIME.has(a.ContentType) && a.Content)
  let fileBase64, mimeType, isTextFallback = false

  if (validAttachments.length === 0) {
    const text = TextBody || stripHtml(HtmlBody) || ''
    if (!text.trim()) return res.status(200).end()
    fileBase64 = Buffer.from(text.slice(0, 8000)).toString('base64')
    mimeType = 'text/plain'
    isTextFallback = true
  } else {
    const best = validAttachments.length === 1 ? validAttachments[0] : pickBestAttachment(validAttachments)
    fileBase64 = best.Content
    mimeType = best.ContentType
  }

  // For text-only emails, upload an EML to Drive instead of plain text
  let driveFileBase64 = fileBase64
  let driveMimeType = mimeType
  if (isTextFallback) {
    const eml = buildEml({ from: From, subject: Subject, messageId: MessageID, textBody: TextBody, htmlBody: HtmlBody })
    driveFileBase64 = Buffer.from(eml).toString('base64')
    driveMimeType = 'message/rfc822'
  }

  // Extract with Claude
  const anthropic = new Anthropic()
  let claudeContent

  if (isTextFallback) {
    const decoded = Buffer.from(fileBase64, 'base64').toString('utf8')
    claudeContent = [{
      type: 'text',
      text: `Email subject: ${Subject || ''}\nFrom: ${senderEmail}\n\nEmail content:\n${decoded}\n\n${EXTRACT_PROMPT}`,
    }]
  } else if (mimeType === 'application/pdf') {
    claudeContent = [
      { type: 'document', source: { type: 'base64', media_type: mimeType, data: fileBase64 } },
      { type: 'text', text: EXTRACT_PROMPT },
    ]
  } else {
    claudeContent = [
      { type: 'image', source: { type: 'base64', media_type: mimeType, data: fileBase64 } },
      { type: 'text', text: EXTRACT_PROMPT },
    ]
  }

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
  } catch (e) {
    console.error('Email extraction error:', e?.message)
    // Graceful fallback — still create a pending receipt so user can fill it in
    extracted = {
      vendor: null, invoice_date: null, total: null,
      description: Subject || 'Email receipt',
      confidence: { overall: 'low', vendor: 'low', invoice_date: 'low', total: 'low' },
    }
  }

  const confidenceScores = applyTaxCalculations(extracted)

  const { data: patterns } = await serviceClient.from('patterns').select('*').eq('user_id', userId)
  const patternMatch = findPatternMatch(patterns, extracted.vendor)

  const filename = generateFilename(extracted, Subject)
  const ext = driveMimeType === 'message/rfc822' ? '.eml'
    : mimeType === 'application/pdf' ? '.pdf'
    : mimeType.startsWith('image/') ? '.jpg'
    : '.txt'

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
    filename: filename + ext,
    source: 'email',
    extracted_raw: { ...extracted, messageId: MessageID, emailSubject: Subject, emailFrom: senderEmail },
    confidence_scores: confidenceScores,
    labels: patternMatch?.labels ?? {},
  }

  const { data: receipt, error: dbError } = await serviceClient
    .from('receipts').insert(receiptRow).select().single()

  if (dbError) {
    console.error('DB insert error:', dbError)
    return res.status(200).end()
  }

  // Drive upload — route to {Account}/_for_review/ (or _unassigned/_for_review/ if no account).
  if (fileBase64) {
    try {
      const { data: userRow } = await serviceClient
        .from('users').select('drive_folder_id, drive_token_active').eq('id', userId).single()

      if (userRow?.drive_token_active !== false && userRow?.drive_folder_id) {
        const driveToken = await getValidToken(userId, serviceClient)
        if (driveToken) {
          const { findOrCreateFolder } = await import('./lib/driveClient.js')
          const accountName = patternMatch?.labels?.property || '_unassigned'
          const accFolder = await findOrCreateFolder(driveToken, accountName, userRow.drive_folder_id)
          const reviewFolder = await findOrCreateFolder(driveToken, '_for_review', accFolder.id)
          const driveResult = await uploadFileToDrive(driveToken, filename + ext, driveMimeType, driveFileBase64, reviewFolder.id)
          if (driveResult?.id) {
            await serviceClient.from('receipts').update({ drive_file_id: driveResult.id }).eq('id', receipt.id)
          }
        }
      }
    } catch (e) {
      console.error('Drive upload error:', e?.message)
    }
  }

  // Confirmation reply — only if POSTMARK_API_KEY is configured
  if (process.env.POSTMARK_API_KEY) {
    try { await sendReply(senderEmail, Subject, receipt) }
    catch (e) { console.error('Reply email error:', e?.message) }
  }

  return res.status(200).end()
}
