import { createClient } from '@supabase/supabase-js'

export function decodeJwtPayload(token) {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(Buffer.from(base64, 'base64').toString('utf8'))
  } catch {
    return null
  }
}

export function getServiceClient() {
  return createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

export function getUserFromReq(req) {
  const token = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : null
  if (!token) return null
  const payload = decodeJwtPayload(token)
  if (!payload?.sub || !payload?.exp || payload.exp < Date.now() / 1000) return null
  return { userId: payload.sub, email: payload.email || null, token }
}
