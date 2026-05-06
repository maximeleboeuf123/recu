import { getUserFromReq, getServiceClient } from './lib/auth.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  try {
    const user = getUserFromReq(req)
    if (!user) return res.status(401).json({ error: 'Unauthorized' })
    const { userId } = user

    const serviceClient = getServiceClient()

    // Delete user data — order matters for FK constraints
    await Promise.all([
      serviceClient.from('receipts').delete().eq('user_id', userId),
      serviceClient.from('patterns').delete().eq('user_id', userId),
      serviceClient.from('recurring_entries').delete().eq('user_id', userId),
      serviceClient.from('drive_processed_files').delete().eq('user_id', userId),
      serviceClient.from('drive_tokens').delete().eq('user_id', userId),
      serviceClient.from('account_shares').delete().eq('owner_id', userId),
      serviceClient.from('account_shares').delete().eq('shared_with_id', userId),
    ])

    // drive_year_folders references dimensions — delete dimensions after
    await serviceClient.from('drive_year_folders').delete().eq('user_id', userId)
    await serviceClient.from('dimensions').delete().eq('user_id', userId)
    await serviceClient.from('users').delete().eq('id', userId)

    // Delete the auth user last
    await serviceClient.auth.admin.deleteUser(userId)

    return res.status(200).json({ ok: true })
  } catch (e) {
    console.error('delete-account error:', e?.message)
    return res.status(500).json({ error: 'internal' })
  }
}
