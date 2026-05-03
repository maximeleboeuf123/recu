import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Upload, ClipboardList, BookOpen, FileSpreadsheet } from 'lucide-react'
import { useReceipts } from '../hooks/useReceipts'
import { daysAgo } from '../lib/utils'

export default function HomePage() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language?.startsWith('fr') ? 'fr' : 'en'
  const navigate = useNavigate()
  const { receipts, pendingCount } = useReceipts()

  const now = new Date()
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const monthReceipts = receipts.filter(
    (r) => r.status === 'confirmed' && (r.invoice_date || '').startsWith(monthKey)
  )
  const monthTotal = monthReceipts.reduce((sum, r) => sum + (r.total || 0), 0)
  const monthCount = monthReceipts.length
  const monthLabel = now.toLocaleDateString(lang === 'fr' ? 'fr-CA' : 'en-CA', {
    month: 'long',
    year: 'numeric',
  })

  const recentReceipts = receipts.slice(0, 5)

  const quickActions = [
    { Icon: Upload,          label: lang === 'fr' ? 'Capturer'   : 'Capture', path: '/capture' },
    { Icon: ClipboardList,   label: lang === 'fr' ? 'Réviser'    : 'Review',  path: '/review',  badge: pendingCount },
    { Icon: BookOpen,        label: lang === 'fr' ? 'Grand livre': 'Ledger',  path: '/ledger' },
    { Icon: FileSpreadsheet, label: lang === 'fr' ? 'Exporter'   : 'Export',  path: '/export' },
  ]

  return (
    <div className="max-w-lg mx-auto px-4 py-6 pb-28 space-y-6">
      {/* Header */}
      <div className="pt-1">
        <h1 className="text-2xl font-bold text-[#1A1A18] tracking-tight">Récu</h1>
        <p className="text-sm text-muted mt-0.5 capitalize">{monthLabel}</p>
      </div>

      {/* Monthly summary card */}
      <div className="bg-primary rounded-[12px] px-5 py-5 text-white shadow-sm">
        <p className="text-[11px] font-medium uppercase tracking-wide opacity-70">
          {lang === 'fr' ? 'Ce mois-ci' : 'This month'}
        </p>
        <p className="text-3xl font-bold mt-1.5 tracking-tight">
          {new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' }).format(monthTotal)}
        </p>
        <p className="text-[12px] opacity-70 mt-1">
          {lang === 'fr'
            ? `${monthCount} reçu${monthCount !== 1 ? 's' : ''} confirmé${monthCount !== 1 ? 's' : ''}`
            : `${monthCount} confirmed receipt${monthCount !== 1 ? 's' : ''}`}
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

      {/* Quick access */}
      <div>
        <h2 className="text-xs text-muted uppercase tracking-wide font-medium mb-3">
          {lang === 'fr' ? 'Accès rapide' : 'Quick access'}
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {quickActions.map(({ Icon, label, path, badge }) => (
            <button
              key={path}
              onClick={() => navigate(path)}
              className="relative flex items-center gap-3 bg-surface border border-border rounded-[10px] px-4 py-3.5 hover:border-primary/40 hover:bg-primary/5 transition-colors active:scale-[0.97] text-left"
            >
              {badge > 0 && (
                <span className="absolute top-2 right-2 bg-accent text-white text-[9px] font-bold rounded-full min-w-[14px] h-3.5 flex items-center justify-center px-0.5">
                  {badge > 99 ? '99+' : badge}
                </span>
              )}
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Icon size={16} strokeWidth={1.8} className="text-primary" />
              </div>
              <span className="text-sm font-medium text-[#1A1A18]">{label}</span>
            </button>
          ))}
        </div>
      </div>

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
        <p className="text-xs text-muted">
          {receipt.invoice_date || (days === 0 ? "Aujourd'hui" : `Il y a ${days}j`)}
        </p>
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
