import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Search, BookOpen } from 'lucide-react'
import { useReceipts } from '../hooks/useReceipts'
import { usePatterns } from '../hooks/usePatterns'
import { useLedgerFilters } from '../context/LedgerFilterContext'
import ReviewCard from '../components/ReviewCard'
import { daysAgo } from '../lib/utils'

const THIS_MONTH = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export default function LedgerPage() {
  const { t } = useTranslation()
  const { receipts, loading, updateReceipt } = useReceipts()
  const { savePattern, applyPatternToPending } = usePatterns()
  const { filters, setSearch, setChip, resetFilters } = useLedgerFilters()

  const [expandedId, setExpandedId] = useState(null)
  const [toast, setToast] = useState(null)

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const CHIPS = [
    { key: 'all', label: t('ledger.all') },
    { key: 'month', label: t('ledger.this_month') },
    { key: 'vendor', label: t('ledger.vendor') },
    { key: 'category', label: t('ledger.category') },
  ]

  const filtered = useMemo(() => {
    let list = receipts.filter((r) => r.status !== 'deleted')

    // Search
    if (filters.search.trim()) {
      const q = filters.search.toLowerCase()
      list = list.filter(
        (r) =>
          (r.vendor || '').toLowerCase().includes(q) ||
          (r.description || '').toLowerCase().includes(q) ||
          (r.invoice_number || '').toLowerCase().includes(q),
      )
    }

    // Chip filters
    if (filters.activeChip === 1) {
      const ym = THIS_MONTH()
      list = list.filter((r) => r.invoice_date?.startsWith(ym) || r.created_at?.startsWith(ym))
    }

    return list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  }, [receipts, filters])

  const handleSave = async (id, data, _recurring, patternInfo) => {
    const original = receipts.find((r) => r.id === id)
    const ok = await updateReceipt(id, data, original)
    if (!ok) return showToast(t('common.error'))

    // Pattern update if dimensions changed
    if (data.vendor && data.labels) {
      const dimChanged =
        original?.labels?.category !== data.labels.category ||
        original?.labels?.property !== data.labels.property

      if (dimChanged) {
        await savePattern(data.vendor, data.labels)
        await applyPatternToPending(data.vendor, data.labels)
      }
    }

    setExpandedId(null)
    showToast(t('common.save'))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6 relative">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-[#1A1A18]">{t('ledger.title')}</h1>
        <Link to="/export" className="text-sm text-primary font-medium hover:underline">
          {t('ledger.export')}
        </Link>
      </div>

      {/* Search */}
      <div className="relative mb-3">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
        <input
          type="search"
          value={filters.search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('ledger.search')}
          className="w-full pl-9 pr-4 py-2.5 bg-surface border border-border rounded-[8px] text-sm focus:outline-none focus:border-primary transition-colors"
        />
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1 -mx-4 px-4">
        {CHIPS.map((chip, i) => (
          <button
            key={chip.key}
            onClick={() => setChip(i)}
            className={`flex-shrink-0 px-3 py-1 rounded-full text-sm border transition-colors ${
              filters.activeChip === i
                ? 'bg-primary text-white border-primary'
                : 'bg-surface border-border text-muted hover:border-primary hover:text-primary'
            }`}
          >
            {chip.label}
          </button>
        ))}
        {filters.activeChip !== 0 && (
          <button
            onClick={resetFilters}
            className="flex-shrink-0 px-3 py-1 rounded-full text-sm border border-error/40 text-error hover:bg-error/10 transition-colors"
          >
            Effacer
          </button>
        )}
      </div>

      {/* Receipts */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
          <BookOpen size={48} className="text-border" strokeWidth={1.5} />
          <p className="text-muted text-sm">{t('ledger.empty')}</p>
        </div>
      ) : (
        <div className="space-y-2 pb-6">
          {filtered.map((r) =>
            expandedId === r.id ? (
              <ReviewCard
                key={r.id}
                receipt={r}
                mode="ledger"
                onConfirm={handleSave}
                onClose={() => setExpandedId(null)}
              />
            ) : (
              <LedgerRow key={r.id} receipt={r} onClick={() => setExpandedId(r.id)} />
            ),
          )}
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-[#1A1A18] text-white px-5 py-2.5 rounded-full text-sm z-50 shadow-lg pointer-events-none">
          {toast}
        </div>
      )}
    </div>
  )
}

function LedgerRow({ receipt, onClick }) {
  const isPending = receipt.status === 'pending'

  return (
    <div
      onClick={onClick}
      className="flex items-center justify-between bg-surface border border-border rounded-[8px] px-4 py-3 cursor-pointer hover:border-primary/40 transition-colors active:scale-[0.99]"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-[#1A1A18] truncate">{receipt.vendor || '—'}</p>
          {isPending && (
            <span className="flex-shrink-0 text-[10px] bg-warning/20 text-warning rounded px-1.5 py-0.5 font-medium">
              En attente
            </span>
          )}
        </div>
        <p className="text-xs text-muted mt-0.5">
          {receipt.invoice_date || '—'}
          {receipt.labels?.category ? ` · ${receipt.labels.category}` : ''}
        </p>
      </div>
      <p className="text-sm font-semibold text-[#1A1A18] flex-shrink-0 ml-3">
        {receipt.total != null
          ? new Intl.NumberFormat('fr-CA', { style: 'currency', currency: receipt.currency || 'CAD' }).format(receipt.total)
          : '—'}
      </p>
    </div>
  )
}
