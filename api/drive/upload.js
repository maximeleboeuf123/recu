import { getUserFromReq, getServiceClient } from '../lib/auth.js'
import { getValidToken, uploadFileToDrive } from '../lib/driveClient.js'

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

export default async function handler(req, res) {
  try {
    return await _handler(req, res)
  } catch (e) {
    console.error('Unhandled drive/upload error:', e?.message ?? e, '\nStack:', e?.stack)
    if (!res.headersSent) res.status(500).json({ error: 'internal' })
  }
}

async function _handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const user = getUserFromReq(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const { userId } = user

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

  const { fileBase64, mimeType, filename } = body ?? {}
  if (!fileBase64 || !mimeType || !filename) {
    return res.status(400).json({ error: 'Missing required fields: fileBase64, mimeType, filename' })
  }

  const serviceClient = getServiceClient()

  const { data: userData, error: userErr } = await serviceClient
    .from('users')
    .select('drive_folder_id')
    .eq('id', userId)
    .single()

  const folderId = userData?.drive_folder_id
  if (userErr || !folderId) {
    return res.status(400).json({ error: 'Drive not connected' })
  }

  const accessToken = await getValidToken(userId, serviceClient)
  if (!accessToken) {
    return res.status(400).json({ error: 'Drive token unavailable — reconnect Drive' })
  }

  const uploaded = await uploadFileToDrive(
    accessToken,
    filename,
    mimeType,
    fileBase64,
    folderId,
  )

  return res.status(200).json({
    fileId: uploaded.id,
    fileUrl: uploaded.webViewLink,
  })
}
