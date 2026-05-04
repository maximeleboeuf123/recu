const VALID_LEVELS = new Set(['high', 'medium', 'low'])
const VALID_PAYMENT_METHODS = new Set(['cash', 'visa', 'mastercard', 'amex', 'debit', 'other'])

export const EXTRACT_PROMPT = `Extract all data from this receipt or invoice:
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
  "currency": "omit this field",
  "vendor_gst_number": "RT-XXXXXXXXX format or null",
  "vendor_qst_number": "XXXXXXXXXX TQ XXXX format or null",
  "vendor_neq": "10 digit number or null",
  "vendor_bn": "9 digit number or null",
  "payment_method": "cash|visa|mastercard|amex|debit|other or null — detect from receipt text (e.g. 'VISA', 'Mastercard', 'Débit', 'Cash', 'Comptant')",
  "confidence": {
    "vendor": "high/medium/low",
    "invoice_date": "high/medium/low",
    "total": "high/medium/low",
    "overall": "high/medium/low"
  }
}`

export function normalizeVendor(name) {
  return (name || '')
    .toLowerCase()
    .replace(/[.,'\-&]/g, '')
    .replace(/\b(inc|ltd|ltée|ltee|corp|llc|co)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function fuzzyMatch(a, b) {
  if (!a || !b) return false
  if (a === b) return true
  if (a.length < 5 || b.length < 5) return false
  return a.includes(b) || b.includes(a)
}

export function generateFilename(extracted, fallback) {
  const dateStr = extracted.invoice_date || new Date().toISOString().slice(0, 10)
  const vendorSafe = (extracted.vendor || fallback || 'Unknown')
    .replace(/[^a-zA-Z0-9\s\-éàèùâêîôûçÉÀÈÙÂÊÎÔÛÇ]/g, '')
    .slice(0, 40)
    .trim()
  const keyword = extracted.keyword || 'recu'
  const invPart = extracted.invoice_number ? ` - ${extracted.invoice_number}` : ''
  return `${dateStr} - ${vendorSafe} - ${keyword}${invPart}`
}

// Validate and sanitize raw Claude output before storing in DB.
// Coerces types, drops malformed values, ensures confidence shape.
export function validateExtracted(raw) {
  if (!raw || typeof raw !== 'object') return {}

  const numOrNull = (v) => {
    if (v == null) return null
    const n = typeof v === 'number' ? v : parseFloat(v)
    return isFinite(n) ? n : null
  }
  const strOrNull = (v) =>
    v != null && typeof v === 'string' && v.trim() ? v.trim().slice(0, 500) : null
  const dateOrNull = (v) =>
    typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null
  const level = (v) => (VALID_LEVELS.has(v) ? v : 'low')

  const conf = raw.confidence && typeof raw.confidence === 'object' ? raw.confidence : {}

  return {
    vendor: strOrNull(raw.vendor),
    invoice_date: dateOrNull(raw.invoice_date),
    invoice_number: strOrNull(raw.invoice_number),
    description: strOrNull(raw.description),
    keyword: strOrNull(raw.keyword),
    subtotal: numOrNull(raw.subtotal),
    gst: numOrNull(raw.gst),
    qst: numOrNull(raw.qst),
    hst: numOrNull(raw.hst),
    total: numOrNull(raw.total),
    vendor_gst_number: strOrNull(raw.vendor_gst_number),
    vendor_qst_number: strOrNull(raw.vendor_qst_number),
    vendor_neq: strOrNull(raw.vendor_neq),
    vendor_bn: strOrNull(raw.vendor_bn),
    payment_method: VALID_PAYMENT_METHODS.has(raw.payment_method) ? raw.payment_method : null,
    confidence: {
      vendor: level(conf.vendor),
      invoice_date: level(conf.invoice_date),
      total: level(conf.total),
      overall: level(conf.overall),
    },
  }
}

// Resolve pattern match for a given vendor against the user's saved patterns.
export function findPatternMatch(patterns, vendorName) {
  if (!patterns?.length) return null
  const nv = normalizeVendor(vendorName)
  for (const p of patterns) {
    if (fuzzyMatch(normalizeVendor(p.vendor_pattern), nv)) return p
  }
  return null
}

// Apply tax auto-calculation and return updated extracted + confidence scores.
export function applyTaxCalculations(extracted) {
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
    extracted.total = Math.round(
      (sub + (extracted.gst || 0) + (extracted.qst || 0) + (extracted.hst || 0)) * 100
    ) / 100
  }
  return confidenceScores
}
