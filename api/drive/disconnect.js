import { getUserFromReq, getServiceClient } from '../lib/auth.js'
import { getValidToken, revokeAccessToken } from '../lib/driveClient.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  try {
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

    // Clear all Drive folder IDs from users table (files in Drive are NOT deleted)
    await serviceClient
      .from('users')
      .update({
        drive_folder_id: null,
        drive_inbox_id: null,
        drive_exports_id: null,
        drive_to_process_id: null,
      })
      .eq('id', user.userId)

    // Clear drive_folder_id from all user's account dimensions
    await serviceClient
      .from('dimensions')
      .update({ drive_folder_id: null })
      .eq('user_id', user.userId)

    // Delete all drive_year_folders rows for this user
    await serviceClient
      .from('drive_year_folders')
      .delete()
      .eq('user_id', user.userId)

    return res.status(200).json({ success: true })
  } catch (e) {
    console.error('disconnect handler error:', e.message)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
