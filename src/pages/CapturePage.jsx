import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Upload, Plus, Copy, Repeat, ChevronRight, ArrowLeft, Sparkles } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useReceipts } from '../hooks/useReceipts'
import { useDrive } from '../hooks/useDrive'
import { useDriveActions } from '../hooks/useDriveActions'
import { supabase } from '../lib/supabase'
import UploadCapture from '../components/UploadCapture'
import ManualReceiptForm from '../components/ManualReceiptForm'
import ChatOverlay from '../components/ChatOverlay'

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

export default function CapturePage() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language?.startsWith('fr') ? 'fr' : 'en'
  const navigate = useNavigate()
  const { session } = useAuth()
  const { refresh } = useReceipts()
  const { driveState } = useDrive()
  const { organizeFile } = useDriveActions()

  const [captureOpen, setCaptureOpen] = useState(false)
  const [createMode, setCreateMode] = useState(null) // 'blank' | 'pickExisting' | 'recurring'
  const [templateReceipt, setTemplateReceipt] = useState(null)
  const [chatPrompt, setChatPrompt] = useState(null)
  const [errors, setErrors] = useState([])

  // ---- AI extraction ----
  const callExtract = useCallback(async (pages) => {
    const token = session?.access_token
    if (!token) return
    try {
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ pages, userId: session.user.id }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setErrors((prev) => [...prev, t(ERROR_KEYS[body.error] || 'common.error')])
        return null
      }
      return res.json()
    } catch {
      setErrors((prev) => [...prev, t('common.error')])
      return null
    }
  }, [session, t])

  const handleCapture = useCallback(async (pages) => {
    await callExtract(pages)
    refresh()
  }, [callExtract, refresh])

  // ---- Manual save ----
  const handleManualSave = useCallback(async (receiptData, schedule, photoFile) => {
    try {
      let driveFileId = null
      let driveUrl = null

      if (photoFile && driveState) {
        try {
          const base64 = await new Promise((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => {
              const result = reader.result
              const comma = result.indexOf(',')
              resolve(comma >= 0 ? result.slice(comma + 1) : result)
            }
            reader.onerror = reject
            reader.readAsDataURL(photoFile)
          })
          const uploadRes = await fetch('/api/drive/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
            body: JSON.stringify({ fileBase64: base64, mimeType: photoFile.type, filename: photoFile.name }),
          })
          if (uploadRes.ok) {
            const d = await uploadRes.json()
            driveFileId = d.fileId
            driveUrl = d.fileUrl
          }
        } catch (e) {
          console.error('Drive upload (non-critical):', e)
        }
      }

      const isRec = createMode === 'recurring'
      const dates = isRec
        ? generateDates(schedule.start_date, schedule.end_date, schedule.unit, schedule.interval).slice(0, 120)
        : [receiptData.invoice_date || today()]

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
        payment_method: receiptData.payment_method || null,
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
        setErrors((prev) => [...prev, t('common.error')])
        return false
      }

      if (inserted) {
        for (const r of inserted) {
          if (r.drive_file_id) organizeFile(r.id)
        }
      }

      await refresh()
      setCreateMode(null)
      setTemplateReceipt(null)
      navigate('/ledger')
      return true
    } catch {
      setErrors((prev) => [...prev, t('common.error')])
      return false
    }
  }, [createMode, driveState, session, refresh, organizeFile, t, navigate])

  // ---- Overlay modes ----
  if (chatPrompt !== null) {
    return <ChatOverlay initialPrompt={chatPrompt || null} onClose={() => setChatPrompt(null)} />
  }
  if (captureOpen) {
    return (
      <UploadCapture
        onSubmit={handleCapture}
        onClose={() => {
          setCaptureOpen(false)
          refresh()
          navigate('/review')
        }}
      />
    )
  }
  if (createMode === 'pickExisting') {
    return (
      <ExistingReceiptPicker
        lang={lang}
        onSelect={(receipt) => { setTemplateReceipt(receipt); setCreateMode('blank') }}
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
    <div className="max-w-lg mx-auto px-4 py-6 pb-28 space-y-6">
      {/* Errors */}
      {errors.map((err, i) => (
        <div key={i} className="flex items-center justify-between bg-error/10 text-error rounded-[8px] px-4 py-3 text-sm">
          <span>{err}</span>
          <button onClick={() => setErrors((prev) => prev.filter((_, j) => j !== i))} className="ml-2 text-error/60 hover:text-error">×</button>
        </div>
      ))}

      {/* Upload */}
      <div>
        <h2 className="text-xs text-muted uppercase tracking-wide font-medium mb-3">
          {lang === 'en' ? 'Capture' : 'Capturer'}
        </h2>
        <button
          onClick={() => setCaptureOpen(true)}
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

      {/* Manual creation */}
      <div>
        <h2 className="text-xs text-muted uppercase tracking-wide font-medium mb-3">
          {lang === 'en' ? 'Create manually' : 'Créer manuellement'}
        </h2>
        <div className="bg-surface border border-border rounded-[8px] divide-y divide-border/60">
          <ActionRow
            icon={<Plus size={20} strokeWidth={1.8} className="text-primary" />}
            label={lang === 'en' ? 'Blank receipt' : 'Reçu vierge'}
            sub={lang === 'en' ? 'Start from scratch' : 'Partir de zéro'}
            onClick={() => setCreateMode('blank')}
          />
          <ActionRow
            icon={<Copy size={20} strokeWidth={1.8} className="text-primary" />}
            label={lang === 'en' ? 'From existing' : 'Depuis un existant'}
            sub={lang === 'en' ? 'Copy a confirmed receipt' : 'Copier un reçu confirmé'}
            onClick={() => setCreateMode('pickExisting')}
          />
          <ActionRow
            icon={<Repeat size={20} strokeWidth={1.8} className="text-primary" />}
            label={lang === 'en' ? 'Recurring entries' : 'Entrées récurrentes'}
            sub={lang === 'en' ? 'Generate multiple receipts' : 'Générer plusieurs reçus'}
            onClick={() => setCreateMode('recurring')}
          />
        </div>
      </div>

      {/* Assistant */}
      <AssistantSection lang={lang} onOpen={setChatPrompt} />
    </div>
  )
}

function ActionRow({ icon, label, sub, onClick }) {
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

function AssistantSection({ lang, onOpen }) {
  const prompts = lang === 'fr'
    ? ['Comment fonctionne Récu ?', 'Comment Récu peut m\'aider à être plus efficace ?', 'Guide-moi pour démarrer étape par étape']
    : ['How does Récu work?', 'How can Récu make me more efficient?', 'Guide me through getting started']

  return (
    <div>
      <h2 className="text-xs text-muted uppercase tracking-wide font-medium mb-3">Assistant</h2>
      <div className="bg-surface border border-border rounded-[8px] overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-primary/8 to-transparent border-b border-border/60">
          <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
            <Sparkles size={16} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[#1A1A18]">Récu Assistant</p>
            <p className="text-xs text-muted">
              {lang === 'fr' ? 'Posez vos questions sur Récu' : 'Ask anything about Récu'}
            </p>
          </div>
        </div>
        <div className="divide-y divide-border/60">
          {prompts.map((p) => (
            <button
              key={p}
              onClick={() => onOpen(p)}
              className="w-full flex items-center px-4 py-3 gap-3 hover:bg-primary/5 transition-colors text-left active:scale-[0.99]"
            >
              <span className="flex-1 text-sm text-[#1A1A18]">{p}</span>
              <ChevronRight size={14} className="text-muted flex-shrink-0" />
            </button>
          ))}
          <button
            onClick={() => onOpen('')}
            className="w-full flex items-center px-4 py-3 gap-3 hover:bg-primary/5 transition-colors text-left active:scale-[0.99]"
          >
            <span className="flex-1 text-xs text-muted italic">
              {lang === 'fr' ? 'Poser une autre question…' : 'Ask your own question…'}
            </span>
            <ChevronRight size={14} className="text-muted flex-shrink-0" />
          </button>
        </div>
      </div>
    </div>
  )
}

function ExistingReceiptPicker({ lang, onSelect, onClose }) {
  const { receipts } = useReceipts()
  const [search, setSearch] = useState('')

  const confirmed = receipts
    .filter((r) => r.status === 'confirmed')
    .filter((r) => !search.trim() || (r.vendor || '').toLowerCase().includes(search.toLowerCase()))
    .slice(0, 40)

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col">
      <header className="sticky top-0 bg-surface border-b border-border z-10 flex items-center gap-3 px-4 h-14 flex-shrink-0">
        <button onClick={onClose} className="text-muted hover:text-[#1A1A18] transition-colors">
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
