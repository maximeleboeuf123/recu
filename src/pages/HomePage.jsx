import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Upload, Plus, Copy, Repeat, ChevronRight, ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useReceipts } from '../hooks/useReceipts'
import { useDrive } from '../hooks/useDrive'
import { useDriveActions } from '../hooks/useDriveActions'
import { supabase } from '../lib/supabase'
import UploadCapture from '../components/UploadCapture'
import ManualReceiptForm from '../components/ManualReceiptForm'
import { daysAgo, formatAmount } from '../lib/utils'

const ERROR_KEYS = {
  error_size: 'capture.error_size',
  error_type: 'capture.error_type',
  error_rate: 'capture.error_rate',
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

function generateDates(startDate, endDate, unit, interval) {
  if (!startDate) return []
  const dates = []
  const start = new Date(startDate + 'T12:00:00')
  const end = endDate ? new Date(endDate + 'T12:00:00') : null
  let current = new Date(start)
  while (dates.length < 120) {
    dates.push(current.toISOString().slice(0, 10))
    const next = new Date(current)
    if (unit === 'weekly') next.setDate(next.getDate() + 7 * interval)
    else if (unit === 'monthly') next.setMonth(next.getMonth() + interval)
    else next.setFullYear(next.getFullYear() + interval)
    current = next
    if (end && current > end) break
  }
  return dates
}

export default function HomePage() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language?.startsWith('fr') ? 'fr' : 'en'
  const navigate = useNavigate()
  const { session } = useAuth()
  const { receipts, pendingCount, refresh } = useReceipts()
  const { driveState } = useDrive()
  const { organizeFile } = useDriveActions()

  const [captureMode, setCaptureMode] = useState(null) // 'upload'
  const [createMode, setCreateMode] = useState(null)   // 'blank' | 'pickExisting' | 'recurring'
  const [templateReceipt, setTemplateReceipt] = useState(null)

  const [dragOver, setDragOver] = useState(false)
  const [dragFiles, setDragFiles] = useState(null)
  const [errors, setErrors] = useState([])

  // ---- Capture (AI extraction) ----
  const callExtract = useCallback(
    async (pages) => {
      const token = session?.access_token
      if (!token) return

      try {
        const res = await fetch('/api/extract', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ pages, userId: session.user.id }),
        })

        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          const key = ERROR_KEYS[body.error] || 'common.error'
          setErrors((prev) => [...prev, t(key)])
          return null
        }

        return res.json()
      } catch (e) {
        console.error('callExtract:', e)
        setErrors((prev) => [...prev, t('common.error')])
        return null
      }
    },
    [session, t],
  )

  const handleSingleCapture = useCallback(
    async (pages) => {
      const result = await callExtract(pages)
      setCaptureMode(null)
      if (result) {
        await refresh()
        navigate('/review')
      }
    },
    [callExtract, navigate, refresh],
  )

  const handleBulkCapture = useCallback(
    async (pages) => {
      await callExtract(pages)
      refresh()
    },
    [callExtract, refresh],
  )

  // ---- Manual save ----
  const handleManualSave = useCallback(
    async (receiptData, schedule, photoFile) => {
      try {
        let driveFileId = null
        let driveUrl = null

        // Upload photo to Drive if provided and drive is connected
        if (photoFile && driveState) {
          try {
            const base64 = await new Promise((resolve, reject) => {
              const reader = new FileReader()
              reader.onload = () => {
                // strip data url prefix
                const result = reader.result
                const comma = result.indexOf(',')
                resolve(comma >= 0 ? result.slice(comma + 1) : result)
              }
              reader.onerror = reject
              reader.readAsDataURL(photoFile)
            })

            const uploadRes = await fetch('/api/drive/upload', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({
                fileBase64: base64,
                mimeType: photoFile.type,
                filename: photoFile.name,
              }),
            })

            if (uploadRes.ok) {
              const uploadData = await uploadRes.json()
              driveFileId = uploadData.fileId
              driveUrl = uploadData.fileUrl
            }
          } catch (driveErr) {
            console.error('Drive upload failed (non-critical):', driveErr)
          }
        }

        // Generate dates
        const isRec = createMode === 'recurring'
        const dates = isRec
          ? generateDates(schedule.start_date, schedule.end_date, schedule.unit, schedule.interval).slice(0, 120)
          : [receiptData.invoice_date || today()]

        // Build rows (only first entry gets the Drive file for recurring)
        const rows = dates.map((date, i) => ({
          user_id: session.user.id,
          status: 'confirmed',
          vendor: receiptData.vendor || null,
          invoice_date: date,
          invoice_number: receiptData.invoice_number
            ? (isRec && i > 0 ? `${receiptData.invoice_number}-${i + 1}` : receiptData.invoice_number)
            : null,
          description: receiptData.description || null,
          subtotal: receiptData.subtotal || null,
          gst: receiptData.gst || null,
          qst: receiptData.qst || null,
          hst: receiptData.hst || null,
          total: receiptData.total || null,
          currency: receiptData.currency || 'CAD',
          vendor_gst_number: receiptData.vendor_gst_number || null,
          vendor_qst_number: receiptData.vendor_qst_number || null,
          drive_file_id: i === 0 ? (driveFileId || null) : null,
          drive_url: i === 0 ? (driveUrl || null) : null,
          filename: i === 0 ? (photoFile?.name || null) : null,
          labels: receiptData.labels || {},
          source: 'manual',
          confidence_scores: {},
          extracted_raw: {},
          edit_history: [],
        }))

        const { data: inserted, error } = await supabase.from('receipts').insert(rows).select('id, drive_file_id')
        if (error) {
          console.error('Manual insert error:', error)
          setErrors((prev) => [...prev, t('common.error')])
          return false
        }

        // Move file to correct folder after insert (now we have the receipt ID)
        if (inserted) {
          for (const r of inserted) {
            if (r.drive_file_id) organizeFile(r.id)
          }
        }

        await refresh()
        setCreateMode(null)
        setTemplateReceipt(null)
        navigate('/ledger')

        // Simple toast via errors array (positive message)
        const count = rows.length
        const msg = lang === 'en'
          ? `${count} receipt${count === 1 ? '' : 's'} created`
          : `${count} reçu${count === 1 ? '' : 's'} créé${count === 1 ? '' : 's'}`
        // Use a brief success indicator — add to errors with a marker, or just no-op
        // For now just a console log; a proper toast system can be added later
        console.info(msg)

        return true
      } catch (e) {
        console.error('handleManualSave:', e)
        setErrors((prev) => [...prev, t('common.error')])
        return false
      }
    },
    [createMode, driveState, session, refresh, organizeFile, t, lang],
  )

  // ---- Drag & drop ----
  const onDragOver = (e) => {
    e.preventDefault()
    setDragOver(true)
  }
  const onDragLeave = () => setDragOver(false)
  const onDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    const files = e.dataTransfer.files
    if (!files.length) return
    setDragFiles(files)
    setCaptureMode('upload')
  }

  const recentReceipts = receipts.slice(0, 5)

  // ---- Overlay modes ----
  if (captureMode === 'upload') {
    return (
      <UploadCapture
        onSubmit={handleBulkCapture}
        onClose={() => { setCaptureMode(null); setDragFiles(null) }}
        initialFiles={dragFiles}
      />
    )
  }
  if (createMode === 'pickExisting') {
    return (
      <ExistingReceiptPicker
        receipts={receipts}
        lang={lang}
        onSelect={(receipt) => {
          setTemplateReceipt(receipt)
          setCreateMode('blank')
        }}
        onClose={() => setCreateMode(null)}
      />
    )
  }
  if (createMode === 'blank' || createMode === 'recurring') {
    return (
      <ManualReceiptForm
        lang={lang}
        initialValues={templateReceipt || {}}
        isRecurring={createMode === 'recurring'}
        driveConnected={!!driveState}
        onSave={handleManualSave}
        onClose={() => { setCreateMode(null); setTemplateReceipt(null) }}
      />
    )
  }

  // ---- Main view ----
  return (
    <div
      className={`max-w-lg mx-auto px-4 py-6 space-y-6 relative ${dragOver ? 'bg-primary/5' : ''}`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {/* Drag overlay */}
      {dragOver && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-primary/10 pointer-events-none">
          <div className="bg-surface border-2 border-dashed border-primary rounded-[12px] px-10 py-8 text-center">
            <Upload size={40} className="text-primary mx-auto mb-2" />
            <p className="text-primary font-medium">{t('capture.drag_drop')}</p>
          </div>
        </div>
      )}

      {/* Pending badge */}
      {pendingCount > 0 && (
        <button
          onClick={() => navigate('/review')}
          className="w-full bg-accent/10 text-accent rounded-[8px] p-3 text-center text-sm font-semibold hover:bg-accent/20 transition-colors active:scale-[0.98]"
        >
          {t('home.pending_other', { count: pendingCount })}
        </button>
      )}

      {/* Errors */}
      {errors.map((err, i) => (
        <div key={i} className="flex items-center justify-between bg-error/10 text-error rounded-[8px] px-4 py-3 text-sm">
          <span>{err}</span>
          <button onClick={() => setErrors((prev) => prev.filter((_, j) => j !== i))} className="ml-2 text-error/60 hover:text-error">×</button>
        </div>
      ))}

      {/* Section: Capture */}
      <div>
        <h2 className="text-xs text-muted uppercase tracking-wide font-medium mb-3">
          {lang === 'en' ? 'Capture' : 'Capturer'}
        </h2>
        <button
          onClick={() => setCaptureMode('upload')}
          className="w-full flex items-center justify-center gap-3 bg-primary text-white rounded-[8px] py-5 active:scale-[0.97] transition-transform shadow-sm"
        >
          <Upload size={22} strokeWidth={1.8} />
          <div className="text-left">
            <p className="text-sm font-semibold leading-tight">
              {lang === 'en' ? 'Upload a receipt' : 'Ajouter un reçu'}
            </p>
            <p className="text-[11px] opacity-75 mt-0.5 leading-tight">
              {lang === 'en' ? 'Photo, PDF or file · AI extraction' : 'Photo, PDF ou fichier · Extraction IA'}
            </p>
          </div>
        </button>
      </div>

      {/* Section: Create manually */}
      <div>
        <h2 className="text-xs text-muted uppercase tracking-wide font-medium mb-3">
          {lang === 'en' ? 'Create manually' : 'Créer manuellement'}
        </h2>
        <div className="bg-surface border border-border rounded-[8px] divide-y divide-border/60">
          <CreateRow
            icon={<Plus size={20} strokeWidth={1.8} className="text-primary" />}
            label={lang === 'en' ? 'Blank receipt' : 'Reçu vierge'}
            sub={lang === 'en' ? 'Start from scratch' : 'Partir de zéro'}
            onClick={() => setCreateMode('blank')}
          />
          <CreateRow
            icon={<Copy size={20} strokeWidth={1.8} className="text-primary" />}
            label={lang === 'en' ? 'From existing' : 'Depuis un existant'}
            sub={lang === 'en' ? 'Copy a confirmed receipt' : 'Copier un reçu confirmé'}
            onClick={() => setCreateMode('pickExisting')}
          />
          <CreateRow
            icon={<Repeat size={20} strokeWidth={1.8} className="text-primary" />}
            label={lang === 'en' ? 'Recurring entries' : 'Entrées récurrentes'}
            sub={lang === 'en' ? 'Generate multiple receipts' : 'Générer plusieurs reçus'}
            onClick={() => setCreateMode('recurring')}
          />
        </div>
      </div>

      {/* Recent receipts strip */}
      <div>
        <h2 className="text-muted font-semibold mb-3 text-xs uppercase tracking-wide">
          {t('home.recent')}
        </h2>
        {recentReceipts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-muted text-sm">{t('home.no_recent')}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {recentReceipts.map((r) => (
              <RecentRow key={r.id} receipt={r} onClick={() => navigate(`/receipt/${r.id}`)} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function CreateRow({ icon, label, sub, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-primary/5 transition-colors active:scale-[0.99] text-left"
    >
      <div className="flex-shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[#1A1A18]">{label}</p>
        <p className="text-xs text-muted">{sub}</p>
      </div>
      <ChevronRight size={16} className="text-muted flex-shrink-0" />
    </button>
  )
}

function RecentRow({ receipt, onClick }) {
  const days = daysAgo(receipt.created_at)

  return (
    <div
      onClick={onClick}
      className="flex items-center justify-between bg-surface border border-border rounded-[8px] px-4 py-3 cursor-pointer hover:border-primary/40 transition-colors active:scale-[0.99]"
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[#1A1A18] truncate">{receipt.vendor || '—'}</p>
        <p className="text-xs text-muted">{receipt.invoice_date || (days === 0 ? "Aujourd'hui" : `Il y a ${days}j`)}</p>
      </div>
      <div className="text-right flex-shrink-0 ml-3">
        <p className="text-sm font-semibold text-[#1A1A18]">
          {receipt.total != null
            ? new Intl.NumberFormat('fr-CA', { style: 'currency', currency: receipt.currency || 'CAD' }).format(receipt.total)
            : '—'}
        </p>
        {receipt.status === 'pending' && (
          <span className="text-[10px] bg-warning/20 text-warning rounded px-1.5 py-0.5">
            En attente
          </span>
        )}
      </div>
    </div>
  )
}

function ExistingReceiptPicker({ receipts, lang, onSelect, onClose }) {
  const [search, setSearch] = useState('')

  const confirmed = receipts
    .filter((r) => r.status === 'confirmed')
    .filter((r) => !search.trim() || (r.vendor || '').toLowerCase().includes(search.toLowerCase()))
    .slice(0, 40)

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col">
      <header className="sticky top-0 bg-surface border-b border-border z-10 flex items-center gap-3 px-4 h-14 flex-shrink-0">
        <button
          onClick={onClose}
          className="text-muted hover:text-[#1A1A18] transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-sm font-semibold text-[#1A1A18] flex-1">
          {lang === 'en' ? 'Select a receipt' : 'Choisir un reçu'}
        </h1>
      </header>

      <div className="px-4 pt-3 pb-2 border-b border-border flex-shrink-0">
        <input
          type="search"
          autoFocus
          className="w-full bg-surface border border-border rounded-[8px] px-3 py-2 text-sm focus:outline-none focus:border-primary/60"
          placeholder={lang === 'en' ? 'Search vendor…' : 'Rechercher un fournisseur…'}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {confirmed.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <p className="text-muted text-sm">
              {lang === 'en' ? 'No confirmed receipts found' : 'Aucun reçu confirmé trouvé'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {confirmed.map((r) => (
              <button
                key={r.id}
                onClick={() => onSelect(r)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-primary/5 transition-colors text-left"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#1A1A18] truncate">{r.vendor || '—'}</p>
                  <p className="text-xs text-muted">{r.invoice_date || '—'}</p>
                </div>
                <p className="text-sm font-semibold text-[#1A1A18] flex-shrink-0 ml-3">
                  {r.total != null
                    ? new Intl.NumberFormat('fr-CA', { style: 'currency', currency: r.currency || 'CAD' }).format(r.total)
                    : '—'}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
