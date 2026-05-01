import { getUserFromReq, getServiceClient } from '../lib/auth.js'
import { getValidToken, deleteFile } from '../lib/driveClient.js'

function parseBody(req) {
  return new Promise((resolve, reject) => {
    if (req.body != null) {
      try { resolve(typeof req.body === 'string' ? JSON.parse(req.body) : req.body) } catch (e) { reject(e) }
      return
    }
    let data = ''
    req.on('data', (chunk) => { data += chunk })
    req.on('end', () => { try { resolve(JSON.parse(data)) } catch (e) { reject(e) } })
    req.on('error', reject)
  })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const user = getUserFromReq(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  let body
  try { body = await parseBody(req) } catch { return res.status(400).json({ error: 'bad_request' }) }

  const { fileId } = body || {}
  if (!fileId) return res.status(400).json({ error: 'fileId required' })

  try {
    const serviceClient = getServiceClient()
    const accessToken = await getValidToken(user.userId, serviceClient)
    if (!accessToken) return res.status(200).json({ ok: true })

    await deleteFile(accessToken, fileId)
    return res.status(200).json({ ok: true })
  } catch (e) {
    console.error('Drive delete file:', e?.message)
    return res.status(200).json({ ok: true })
  }
}
