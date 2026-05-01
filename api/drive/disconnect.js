import { getUserFromReq, getServiceClient } from '../lib/auth.js'
import { getValidToken, revokeAccessToken } from '../lib/driveClient.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const user = getUserFromReq(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const serviceClient = getServiceClient()

  // Revoke token if we have one
  try {
    const accessToken = await getValidToken(user.userId, serviceClient)
    if (accessToken) await revokeAccessToken(accessToken)
  } catch (e) {
    console.error('Token revoke error (non-critical):', e.message)
  }

  // Delete token record
  await serviceClient.from('drive_tokens').delete().eq('user_id', user.userId)

  // Clear folder IDs from users table (files in Drive are NOT deleted)
  await serviceClient
    .from('users')
    .update({ drive_folder_id: null, drive_inbox_id: null })
    .eq('id', user.userId)

  return res.status(200).json({ success: true })
}
