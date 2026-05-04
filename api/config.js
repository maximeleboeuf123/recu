export default function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()
  return res.status(200).json({
    inboxEmail: process.env.POSTMARK_INBOUND_ADDRESS || null,
  })
}
