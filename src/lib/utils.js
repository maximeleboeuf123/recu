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

export function daysAgo(dateStr) {
  const ms = Date.now() - new Date(dateStr).getTime()
  return Math.floor(ms / 86_400_000)
}

export function formatAmount(val, currency = 'CAD') {
  if (val == null || val === '') return '—'
  return new Intl.NumberFormat('fr-CA', { style: 'currency', currency }).format(val)
}

export function sanitizeFilename(name) {
  return (name || '')
    .replace(/[^a-zA-Z0-9\s\-éàèùâêîôûçÉÀÈÙÂÊÎÔÛÇ]/g, '')
    .slice(0, 40)
    .trim()
}
