import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Camera, Upload } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useReceipts } from '../hooks/useReceipts'
import CameraCapture from '../components/CameraCapture'
import UploadCapture from '../components/UploadCapture'
import { daysAgo, formatAmount } from '../lib/utils'

const ERROR_KEYS = {
  error_size: 'capture.error_size',
  error_type: 'capture.error_type',
  error_rate: 'capture.error_rate',
}

export default function HomePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { session } = useAuth()
  const { receipts, pendingCount } = useReceipts()

  const [captureMode, setCaptureMode] = useState(null) // 'camera' | 'upload'
  const [dragOver, setDragOver] = useState(false)
  const [dragFiles, setDragFiles] = useState(null)
  const [progress, setProgress] = useState(null) // { current, total }
  const [errors, setErrors] = useState([])

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
      setCaptureMode(null)
      setProgress({ current: 0, total: 1 })
      await callExtract(pages)
      setProgress(null)
      navigate('/review')
    },
    [callExtract, navigate],
  )

  const handleBulkCapture = useCallback(
    async (pages) => {
      // Called once per receipt group — runs in parallel across groups
      await callExtract(pages)
    },
    [callExtract],
  )

  // Drag and drop handlers (desktop)
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

      {/* Progress overlay */}
      {progress && (
        <div className="bg-surface border border-border rounded-[8px] p-4 text-center">
          <div className="w-full bg-border rounded-full h-1.5 mb-2">
            <div
              className="bg-primary h-1.5 rounded-full transition-all duration-300"
              style={{ width: progress.total > 0 ? `${(progress.current / progress.total) * 100}%` : '0%' }}
            />
          </div>
          <p className="text-sm text-muted">
            {t('capture.processing', { current: progress.current, total: progress.total })}
          </p>
        </div>
      )}

      {/* Errors */}
      {errors.map((err, i) => (
        <div key={i} className="flex items-center justify-between bg-error/10 text-error rounded-[8px] px-4 py-3 text-sm">
          <span>{err}</span>
          <button onClick={() => setErrors((prev) => prev.filter((_, j) => j !== i))} className="ml-2 text-error/60 hover:text-error">×</button>
        </div>
      ))}

      {/* Capture CTAs */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => setCaptureMode('camera')}
          className="flex flex-col items-center justify-center gap-3 bg-primary text-white rounded-[8px] p-6 active:scale-[0.97] transition-transform shadow-sm"
        >
          <Camera size={32} strokeWidth={1.8} />
          <span className="text-sm font-medium text-center leading-tight">
            {t('home.capture_photo')}
          </span>
        </button>

        <button
          onClick={() => setCaptureMode('upload')}
          className="flex flex-col items-center justify-center gap-3 bg-surface text-primary border-2 border-primary rounded-[8px] p-6 active:scale-[0.97] transition-transform"
        >
          <Upload size={32} strokeWidth={1.8} />
          <span className="text-sm font-medium text-center leading-tight">
            {t('home.upload_file')}
          </span>
        </button>
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

      {/* Capture flows */}
      {captureMode === 'camera' && (
        <CameraCapture
          onSubmit={handleSingleCapture}
          onClose={() => setCaptureMode(null)}
        />
      )}
      {captureMode === 'upload' && (
        <UploadCapture
          onSubmit={handleBulkCapture}
          onClose={() => { setCaptureMode(null); setDragFiles(null) }}
          initialFiles={dragFiles}
        />
      )}
    </div>
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
