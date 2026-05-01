import { getUserFromReq, getServiceClient } from '../lib/auth.js'
import { getValidToken, listSubfolders } from '../lib/driveClient.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const user = getUserFromReq(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const serviceClient = getServiceClient()

  const { data: userData } = await serviceClient
    .from('users')
    .select('drive_folder_id')
    .eq('id', user.userId)
    .single()

  if (!userData?.drive_folder_id) {
    return res.status(400).json({ error: 'drive_not_connected' })
  }

  const accessToken = await getValidToken(user.userId, serviceClient)
  if (!accessToken) return res.status(401).json({ error: 'token_expired' })

  try {
    const folders = await listSubfolders(accessToken, userData.drive_folder_id)
    return res.status(200).json({ folders })
  } catch (e) {
    console.error('List folders error:', e.message)
    return res.status(500).json({ error: 'drive_error' })
  }
}
