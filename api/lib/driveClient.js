const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'
const DRIVE_API = 'https://www.googleapis.com/drive/v3'
const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3'

export async function getValidToken(userId, serviceClient) {
  const { data: row } = await serviceClient
    .from('drive_tokens')
    .select('access_token, refresh_token, expires_at')
    .eq('user_id', userId)
    .single()
  if (!row) return null

  // Refresh if within 5 minutes of expiry
  if (new Date(row.expires_at).getTime() - Date.now() < 5 * 60 * 1000) {
    const res = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_DRIVE_CLIENT_ID,
        client_secret: process.env.GOOGLE_DRIVE_CLIENT_SECRET,
        refresh_token: row.refresh_token,
        grant_type: 'refresh_token',
      }),
    })
    const data = await res.json()
    if (!res.ok || !data.access_token) return null
    const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString()
    await serviceClient
      .from('drive_tokens')
      .update({ access_token: data.access_token, expires_at: expiresAt, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
    return data.access_token
  }

  return row.access_token
}

export async function createDriveFolder(accessToken, name, parentId) {
  const body = { name, mimeType: 'application/vnd.google-apps.folder' }
  if (parentId) body.parents = [parentId]
  const res = await fetch(`${DRIVE_API}/files?fields=id,name,webViewLink`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Create folder failed: ${res.status} ${await res.text()}`)
  return res.json()
}

export async function uploadFileToDrive(accessToken, filename, mimeType, base64Data, folderId) {
  const fileData = Buffer.from(base64Data, 'base64')
  const metadata = JSON.stringify({ name: filename, parents: [folderId] })
  const boundary = `recu_${Date.now()}`
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`),
    Buffer.from(metadata),
    Buffer.from(`\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`),
    fileData,
    Buffer.from(`\r\n--${boundary}--`),
  ])
  const res = await fetch(`${DRIVE_UPLOAD}/files?uploadType=multipart&fields=id,webViewLink`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
      'Content-Length': String(body.length),
    },
    body,
  })
  if (!res.ok) throw new Error(`Upload failed: ${res.status} ${await res.text()}`)
  return res.json() // { id, webViewLink }
}

export async function copyFileToDrive(accessToken, fileId, folderId, newName) {
  const res = await fetch(`${DRIVE_API}/files/${fileId}/copy?fields=id,webViewLink`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: newName, parents: [folderId] }),
  })
  if (!res.ok) throw new Error(`Copy failed: ${res.status} ${await res.text()}`)
  return res.json()
}

export async function listSubfolders(accessToken, parentId) {
  const q = encodeURIComponent(
    `'${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`
  )
  const res = await fetch(`${DRIVE_API}/files?q=${q}&fields=files(id,name)&orderBy=name`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error(`List folders failed: ${res.status}`)
  const data = await res.json()
  return data.files || []
}

export async function revokeAccessToken(accessToken) {
  await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(accessToken)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  })
}
