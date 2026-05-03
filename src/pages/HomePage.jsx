import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useReceipts } from '../hooks/useReceipts'
import { daysAgo } from '../lib/utils'

export default function HomePage() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language?.startsWith('fr') ? 'fr' : 'en'
  const navigate = useNavigate()
  const { receipts, pendingCount } = useReceipts()

  const [errors] = useState([])

  const recentReceipts = receipts.slice(0, 5)

  return (
    <div className="max-w-lg mx-auto px-4 py-6 pb-28 space-y-6">
      {/* Welcome header */}
      <div className="pt-1">
        <h1 className="text-2xl font-bold text-[#1A1A18] tracking-tight">Récu</h1>
        <p className="text-sm text-muted mt-0.5">
          {lang === 'en'
            ? 'Your receipts, organized and ready for tax time.'
            : 'Vos reçus, organisés et prêts pour vos impôts.'}
        </p>
      </div>

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
        </div>
      ))}

      {/* Recent receipts */}
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
