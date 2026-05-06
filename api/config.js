import { getUserFromReq, getServiceClient } from './lib/auth.js'

function generateSlug(email, userId) {
  const local = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12)
  const hash = userId.replace(/-/g, '').slice(0, 4)
  return `${local}-${hash}`
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const domain = process.env.POSTMARK_INBOUND_DOMAIN
  if (!domain) return res.status(200).json({ inboxEmail: null })

  const user = getUserFromReq(req)
  if (!user) return res.status(200).json({ inboxEmail: null })

  try {
    const serviceClient = getServiceClient()
    const { data: userData } = await serviceClient
      .from('users')
      .select('inbox_slug, email')
      .eq('id', user.userId)
      .single()

    let slug = userData?.inbox_slug

    if (!slug && userData?.email) {
      slug = generateSlug(userData.email, user.userId)
      await serviceClient.from('users').update({ inbox_slug: slug }).eq('id', user.userId)
    }

    return res.status(200).json({
      inboxEmail: slug ? `${slug}@${domain}` : null,
    })
  } catch {
    return res.status(200).json({ inboxEmail: null })
  }
}
