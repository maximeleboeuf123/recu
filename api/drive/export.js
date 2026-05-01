import { getUserFromReq, getServiceClient } from '../lib/auth.js'
import { getValidToken, uploadFileToDrive, findOrCreateFolder, findFilesByName, deleteFile } from '../lib/driveClient.js'
import * as XLSX from 'xlsx'

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

const COLUMNS = [
  { header: 'Vendor',        get: (r) => r.vendor || '',                    width: 22, type: 'text' },
  { header: 'Invoice Date',  get: (r) => r.invoice_date || '',              width: 14, type: 'text' },
  { header: 'Invoice #',     get: (r) => r.invoice_number || '',            width: 16, type: 'text' },
  { header: 'Description',   get: (r) => r.description || '',               width: 28, type: 'text' },
  { header: 'Status',        get: (r) => r.status || '',                    width: 12, type: 'text' },
  { header: 'Account',       get: (r) => r.labels?.property || '',          width: 20, type: 'text' },
  { header: 'Category',      get: (r) => r.labels?.category || '',          width: 20, type: 'text' },
  { header: 'Total',         get: (r) => r.total ?? '',                     width: 12, type: 'number' },
  { header: 'Subtotal',      get: (r) => r.subtotal ?? '',                  width: 12, type: 'number' },
  { header: 'TPS/GST',       get: (r) => r.gst ?? '',                       width: 12, type: 'number' },
  { header: 'TVQ/QST',       get: (r) => r.qst ?? '',                       width: 12, type: 'number' },
  { header: 'HST',           get: (r) => r.hst ?? '',                       width: 12, type: 'number' },
  { header: 'Currency',      get: (r) => r.currency || 'CAD',               width: 10, type: 'text' },
  { header: 'No. TPS/GST',   get: (r) => r.vendor_gst_number || '',         width: 16, type: 'text' },
  { header: 'No. TVQ/QST',   get: (r) => r.vendor_qst_number || '',         width: 16, type: 'text' },
  { header: 'Source',        get: (r) => r.source || '',                    width: 12, type: 'text' },
  { header: 'Filename',      get: (r) => r.filename || '',                  width: 28, type: 'text' },
  { header: 'Captured At',   get: (r) => r.created_at ? r.created_at.slice(0, 10) : '', width: 14, type: 'text' },
]

function generateCSV(receipts) {
  const escape = (v) => {
    const s = String(v ?? '')
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s
  }
  const header = COLUMNS.map((c) => escape(c.header)).join(',')
  const rows = receipts.map((r) => COLUMNS.map((c) => escape(c.get(r))).join(','))
  return [header, ...rows].join('\r\n')
}

function generateXLSX(receipts) {
  const rowData = receipts.map((r) =>
    Object.fromEntries(COLUMNS.map((c) => [c.header, c.get(r)]))
  )
  const ws = XLSX.utils.json_to_sheet(rowData, { header: COLUMNS.map((c) => c.header) })

  // Column widths + freeze header row
  ws['!cols'] = COLUMNS.map((c) => ({ wch: c.width }))
  ws['!freeze'] = { xSplit: 0, ySplit: 1 }

  // Number format on amount cells
  const numColIndices = COLUMNS.map((c, i) => (c.type === 'number' ? i : -1)).filter((i) => i >= 0)
  if (ws['!ref']) {
    const range = XLSX.utils.decode_range(ws['!ref'])
    for (let row = range.s.r + 1; row <= range.e.r; row++) {
      for (const col of numColIndices) {
        const ref = XLSX.utils.encode_cell({ r: row, c: col })
        if (ws[ref]) ws[ref].z = '#,##0.00'
      }
    }
  }

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Receipts')
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const user = getUserFromReq(req)
  if (!user) return res.status(401).json({ error: 'unauthorized' })

  let body
  try { body = await parseBody(req) } catch { return res.status(400).json({ error: 'bad_request' }) }

  const { filename, format, receipts } = body || {}
  if (!filename?.trim() || !['csv', 'xlsx'].includes(format) || !Array.isArray(receipts)) {
    return res.status(400).json({ error: 'missing_fields' })
  }

  try {
    const serviceClient = getServiceClient()
    const accessToken = await getValidToken(user.userId, serviceClient)
    if (!accessToken) return res.status(400).json({ error: 'drive_not_connected' })

    const { data: userData } = await serviceClient
      .from('users')
      .select('drive_folder_id')
      .eq('id', user.userId)
      .single()
    if (!userData?.drive_folder_id) return res.status(400).json({ error: 'drive_not_connected' })

    // Find or create _Exports folder
    const exportFolder = await findOrCreateFolder(accessToken, '_Exports', userData.drive_folder_id)

    // Build final filename with extension
    const base = filename.trim().replace(/\.(csv|xlsx)$/i, '')
    const ext = format === 'xlsx' ? '.xlsx' : '.csv'
    const driveFilename = `${base}${ext}`

    // Overwrite: delete any existing files with the same name
    const existing = await findFilesByName(accessToken, driveFilename, exportFolder.id)
    await Promise.all(existing.map((f) => deleteFile(accessToken, f.id).catch(() => {})))

    // Generate file buffer
    let fileBuffer, mimeType
    if (format === 'xlsx') {
      fileBuffer = generateXLSX(receipts)
      mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    } else {
      const csv = generateCSV(receipts)
      // UTF-8 BOM so Excel opens it correctly
      fileBuffer = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(csv, 'utf-8')])
      mimeType = 'text/csv'
    }

    const uploaded = await uploadFileToDrive(
      accessToken,
      driveFilename,
      mimeType,
      fileBuffer.toString('base64'),
      exportFolder.id,
    )

    return res.status(200).json({ fileUrl: uploaded.webViewLink, filename: driveFilename })
  } catch (e) {
    console.error('Export error:', e?.message)
    return res.status(500).json({ error: 'export_failed' })
  }
}
