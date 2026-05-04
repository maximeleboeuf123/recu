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
  { header: 'Payment Method', get: (r) => r.payment_method || '',           width: 16, type: 'text' },
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
  { header: 'Receipt Link',  get: (r) => r.drive_url || '',                 width: 40, type: 'link' },
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

function r2(n) {
  return Math.round(n * 100) / 100
}

function applyNumFmt(ws, numColIndices, startRow) {
  if (!ws['!ref']) return
  const range = XLSX.utils.decode_range(ws['!ref'])
  for (let row = startRow; row <= range.e.r; row++) {
    for (const col of numColIndices) {
      const ref = XLSX.utils.encode_cell({ r: row, c: col })
      if (ws[ref] && typeof ws[ref].v === 'number') ws[ref].z = '#,##0.00'
    }
  }
}

function buildTransactionsSheet(receipts) {
  const linkColIdx = COLUMNS.findIndex((c) => c.type === 'link')

  const rowData = receipts.map((r) =>
    Object.fromEntries(
      COLUMNS.map((c) => [c.header, c.type === 'link' ? (c.get(r) ? 'View' : '') : c.get(r)])
    )
  )
  const ws = XLSX.utils.json_to_sheet(rowData, { header: COLUMNS.map((c) => c.header) })
  ws['!cols'] = COLUMNS.map((c) => ({ wch: c.width }))
  ws['!freeze'] = { xSplit: 0, ySplit: 1 }

  const numColIndices = COLUMNS.map((c, i) => (c.type === 'number' ? i : -1)).filter((i) => i >= 0)
  applyNumFmt(ws, numColIndices, 1)

  // Attach hyperlinks to the Receipt Link column
  if (linkColIdx >= 0) {
    const getLinkUrl = COLUMNS[linkColIdx].get
    receipts.forEach((r, rowIdx) => {
      const url = getLinkUrl(r)
      if (!url) return
      const ref = XLSX.utils.encode_cell({ r: rowIdx + 1, c: linkColIdx })
      if (ws[ref]) ws[ref].l = { Target: url, Tooltip: 'View receipt in Google Drive' }
    })
  }

  return ws
}

function buildSummarySheet(receipts, period) {
  // Aggregate: account → category → totals
  const groups = {}
  for (const r of receipts) {
    const acc = r.labels?.property || ''
    const cat = r.labels?.category || ''
    if (!groups[acc]) groups[acc] = {}
    if (!groups[acc][cat]) groups[acc][cat] = { count: 0, subtotal: 0, gst: 0, qst: 0, hst: 0, total: 0 }
    const g = groups[acc][cat]
    g.count++
    g.subtotal = r2(g.subtotal + (r.subtotal ?? 0))
    g.gst     = r2(g.gst     + (r.gst     ?? 0))
    g.qst     = r2(g.qst     + (r.qst     ?? 0))
    g.hst     = r2(g.hst     + (r.hst     ?? 0))
    g.total   = r2(g.total   + (r.total   ?? 0))
  }

  const HDR = ['Account', 'Category', '# Receipts', 'Subtotal', 'TPS/GST', 'TVQ/QST', 'HST', 'Total (CAD)']
  const NUM_COLS = [3, 4, 5, 6, 7]
  const aoa = []

  // Metadata header
  const periodStr = period || (() => {
    const dates = receipts.map((r) => r.invoice_date).filter(Boolean).sort()
    return dates.length ? `${dates[0]} to ${dates[dates.length - 1]}` : ''
  })()
  aoa.push(['Period', periodStr, '', '', '', '', '', ''])
  aoa.push(['Generated', new Date().toISOString().slice(0, 10), '', '', '', '', '', ''])
  aoa.push([]) // blank
  aoa.push(HDR)  // row index 3 → freeze below this

  const grand = { count: 0, subtotal: 0, gst: 0, qst: 0, hst: 0, total: 0 }

  const accNames = Object.keys(groups).sort((a, b) => {
    if (!a && b) return 1
    if (a && !b) return -1
    return a.localeCompare(b)
  })

  for (const acc of accNames) {
    const accLabel = acc || '(No Account)'
    const catMap = groups[acc]
    const catNames = Object.keys(catMap).sort((a, b) => {
      if (!a && b) return 1
      if (a && !b) return -1
      return a.localeCompare(b)
    })

    const accTot = { count: 0, subtotal: 0, gst: 0, qst: 0, hst: 0, total: 0 }

    for (const cat of catNames) {
      const g = catMap[cat]
      aoa.push([accLabel, cat || '(No Category)', g.count, g.subtotal, g.gst, g.qst, g.hst, g.total])
      accTot.count    += g.count
      accTot.subtotal  = r2(accTot.subtotal + g.subtotal)
      accTot.gst       = r2(accTot.gst      + g.gst)
      accTot.qst       = r2(accTot.qst      + g.qst)
      accTot.hst       = r2(accTot.hst      + g.hst)
      accTot.total     = r2(accTot.total    + g.total)
    }

    // Account subtotal — only add if more than one category row
    if (catNames.length > 1) {
      aoa.push([`${accLabel} — TOTAL`, '', accTot.count, accTot.subtotal, accTot.gst, accTot.qst, accTot.hst, accTot.total])
    }
    aoa.push([]) // blank separator between accounts

    grand.count    += accTot.count
    grand.subtotal  = r2(grand.subtotal + accTot.subtotal)
    grand.gst       = r2(grand.gst      + accTot.gst)
    grand.qst       = r2(grand.qst      + accTot.qst)
    grand.hst       = r2(grand.hst      + accTot.hst)
    grand.total     = r2(grand.total    + accTot.total)
  }

  // Grand total row
  aoa.push(['GRAND TOTAL', '', grand.count, grand.subtotal, grand.gst, grand.qst, grand.hst, grand.total])

  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!cols'] = [
    { wch: 26 }, { wch: 22 }, { wch: 12 },
    { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 14 },
  ]
  ws['!freeze'] = { xSplit: 0, ySplit: 4 } // freeze after metadata + blank + header
  applyNumFmt(ws, NUM_COLS, 4) // data starts at row index 4
  return ws
}

function generateXLSX(receipts, period) {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, buildTransactionsSheet(receipts), 'Transactions')
  XLSX.utils.book_append_sheet(wb, buildSummarySheet(receipts, period), 'Summary')
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const user = getUserFromReq(req)
  if (!user) return res.status(401).json({ error: 'unauthorized' })

  let body
  try { body = await parseBody(req) } catch { return res.status(400).json({ error: 'bad_request' }) }

  const { filename, format, receipts, period } = body || {}
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

    const base = filename.trim().replace(/\.(csv|xlsx)$/i, '')
    const ext = format === 'xlsx' ? '.xlsx' : '.csv'
    const mimeType = format === 'xlsx'
      ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      : 'text/csv'

    // Group receipts by account
    const groups = {}
    for (const r of receipts) {
      const acc = r.labels?.property || ''
      if (!groups[acc]) groups[acc] = []
      groups[acc].push(r)
    }

    const accountNames = Object.keys(groups).sort((a, b) => {
      if (!a) return 1
      if (!b) return -1
      return a.localeCompare(b)
    })
    const multiAccount = accountNames.length > 1

    const files = []

    for (const accName of accountNames) {
      const accReceipts = groups[accName]

      // Resolve _Exports folder: Récu/{AccountName}/_Exports or Récu/_Exports
      let parentId = userData.drive_folder_id
      if (accName) {
        const accFolder = await findOrCreateFolder(accessToken, accName, userData.drive_folder_id)
        parentId = accFolder.id
      }
      const exportFolder = await findOrCreateFolder(accessToken, '_Exports', parentId)

      const safeName = accName.replace(/[^a-zA-Z0-9\s\-éàèùâêîôûçÉÀÈÙÂÊÎÔÛÇ]/g, '').trim()
      const driveFilename = multiAccount && safeName ? `${base} - ${safeName}${ext}` : `${base}${ext}`

      // Overwrite: delete any existing file with the same name
      const existing = await findFilesByName(accessToken, driveFilename, exportFolder.id)
      await Promise.all(existing.map((f) => deleteFile(accessToken, f.id).catch(() => {})))

      let fileBuffer
      if (format === 'xlsx') {
        fileBuffer = generateXLSX(accReceipts, period)
      } else {
        const csv = generateCSV(accReceipts)
        fileBuffer = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(csv, 'utf-8')])
      }

      const uploaded = await uploadFileToDrive(
        accessToken, driveFilename, mimeType, fileBuffer.toString('base64'), exportFolder.id,
      )

      files.push({ account: accName || '', filename: driveFilename, fileUrl: uploaded.webViewLink })
    }

    return res.status(200).json({ files })
  } catch (e) {
    console.error('Export error:', e?.message)
    return res.status(500).json({ error: 'export_failed' })
  }
}
