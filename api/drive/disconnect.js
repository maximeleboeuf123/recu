import { getUserFromReq, getServiceClient } from '../lib/auth.js'
import { getValidToken, revokeAccessToken } from '../lib/driveClient.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  try {
    const user = getUserFromReq(req)
    if (!user) return res.status(401).json({ error: 'Unauthorized' })

    const serviceClient = getServiceClient()

    // Revoke the OAuth token with Google
    try {
      const accessToken = await getValidToken(user.userId, serviceClient)
      if (accessToken) await revokeAccessToken(accessToken)
    } catch (e) {
      console.error('Token revoke error (non-critical):', e.message)
    }

    // Delete the token record only.
    // Folder IDs (drive_folder_id, drive_inbox_id, dimensions.drive_folder_id,
    // drive_year_folders) are intentionally preserved so that reconnecting the
    // same Google account reuses the existing Drive folder structure instead of
    // creating duplicates and orphaning files.
    await serviceClient.from('drive_tokens').delete().eq('user_id', user.userId)

    return res.status(200).json({ success: true })
  } catch (e) {
    console.error('disconnect handler error:', e.message)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
