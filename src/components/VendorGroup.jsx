import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react'
import SwipeableCard from './SwipeableCard'
import ReviewCard from './ReviewCard'
import { formatAmount, daysAgo } from '../lib/utils'

function groupCanBulkConfirmed(receipts) {
  return receipts.every((r) => {
    const conf = r.extracted_raw?.confidence || {}
    const allHigh = conf.overall === 'high' && conf.vendor === 'high' && conf.total === 'high'
    const dimsOk = r.labels?.category && r.labels?.property
    const amountsOk = r.total != null && r.total > 0
    return allHigh && dimsOk && amountsOk
  })
}

function groupHasWarnings(receipts) {
  return receipts.some((r) => {
    const conf = r.extracted_raw?.confidence || {}
    return conf.overall === 'medium' || !r.labels?.category || !r.labels?.property
  })
}

export default function VendorGroup({
  displayName,
  receipts,
  isDivers,
  onConfirmAll,
  onConfirmOne,
  onSkipOne,
  skippedIds,
}) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)
  const [expandedId, setExpandedId] = useState(null)
  const [swipeHintSeen] = useState(() => !!localStorage.getItem('recu_swipe_hint_seen'))

  const visible = receipts.filter((r) => !skippedIds.has(r.id))
  if (!visible.length) return null

  const canBulk = groupCanBulkConfirmed(visible)
  const hasWarnings = groupHasWarnings(visible)

  const amounts = visible.map((r) => r.total).filter((v) => v != null)
  const minAmt = amounts.length ? Math.min(...amounts) : null
  const maxAmt = amounts.length ? Math.max(...amounts) : null

  const dates = visible
    .map((r) => r.invoice_date)
    .filter(Boolean)
    .sort()
  const dateRange = dates.length
    ? dates.length > 1
      ? `${formatDate(dates[0])} – ${formatDate(dates[dates.length - 1])}`
      : formatDate(dates[0])
    : null

  const handleConfirmAll = () => {
    onConfirmAll?.(visible.map((r) => r.id))
    // Mark hint as seen
    localStorage.setItem('recu_swipe_hint_seen', '1')
  }

  return (
    <div className="bg-surface border border-border rounded-[8px] overflow-hidden">
      {/* Group header */}
      <div className="p-4 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div>
            <span className="font-semibold text-[#1A1A18] uppercase tracking-wide text-sm">
              {displayName}
            </span>
            <span className="ml-2 text-sm text-muted">× {visible.length}</span>
          </div>
          <button
            onClick={() => setExpanded((e) => !e)}
            className="text-muted"
          >
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>

        {visible.length > 0 && (
          <div className="text-xs text-muted space-y-0.5">
            {amounts.length > 0 && (
              <p>
                {minAmt === maxAmt
                  ? formatAmount(minAmt)
                  : `${formatAmount(minAmt)} – ${formatAmount(maxAmt)}`}
              </p>
            )}
            {dateRange && <p>{dateRange}</p>}
          </div>
        )}

        {/* Bulk confirm buttons */}
        <div className="flex gap-2 pt-1">
          {visible.length > 1 && (
            <button
              onClick={handleConfirmAll}
              className={`flex-1 py-2 text-sm font-medium rounded-[6px] active:scale-[0.98] transition-transform ${
                hasWarnings
                  ? 'bg-warning/10 text-warning border border-warning/30'
                  : 'bg-success/10 text-success border border-success/30'
              }`}
            >
              {hasWarnings && <AlertTriangle size={12} className="inline mr-1" />}
              {t('review.group_confirm', { count: visible.length })}
            </button>
          )}
          <button
            onClick={() => setExpanded((e) => !e)}
            className="flex-1 py-2 text-sm font-medium text-primary border border-primary/30 rounded-[6px] active:scale-[0.98] transition-transform"
          >
            {t('review.group_review')}
          </button>
        </div>
      </div>

      {/* Individual receipt cards */}
      {expanded && (
        <div className="border-t border-border divide-y divide-border">
          {!swipeHintSeen && visible.length > 0 && (
            <div className="flex items-center justify-between px-4 py-2 bg-primary/5 text-xs text-primary">
              <span>← {t('review.swipe_left')}</span>
              <span>{t('review.swipe_right')} →</span>
            </div>
          )}

          {visible.map((r) => (
            <div key={r.id}>
              {expandedId === r.id ? (
                <div className="p-3">
                  <ReviewCard
                    receipt={r}
                    mode="review"
                    onConfirm={(id, data, recurring, pattern) => {
                      setExpandedId(null)
                      onConfirmOne?.(id, data, recurring, pattern)
                      localStorage.setItem('recu_swipe_hint_seen', '1')
                    }}
                    onSkip={(id) => {
                      setExpandedId(null)
                      onSkipOne?.(id)
                    }}
                  />
                </div>
              ) : (
                <SwipeableCard
                  onSwipeRight={() => {
                    onConfirmOne?.(r.id, {}, null, null)
                    localStorage.setItem('recu_swipe_hint_seen', '1')
                  }}
                  onSwipeLeft={() => onSkipOne?.(r.id)}
                >
                  <ReceiptRow receipt={r} onClick={() => setExpandedId(r.id)} />
                </SwipeableCard>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ReceiptRow({ receipt, onClick }) {
  const days = daysAgo(receipt.created_at)
  const ageColor = days > 30 ? 'text-error' : days > 7 ? 'text-warning' : 'text-muted'

  return (
    <div
      onClick={onClick}
      className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-background/50 transition-colors"
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[#1A1A18] truncate">{receipt.vendor || '—'}</p>
        <p className="text-xs text-muted mt-0.5">
          {receipt.invoice_date || '—'}
          {receipt.invoice_number ? ` · ${receipt.invoice_number}` : ''}
        </p>
        <p className={`text-[10px] mt-0.5 ${ageColor}`}>
          {days === 0 ? "Aujourd'hui" : `Il y a ${days} jour${days > 1 ? 's' : ''}`}
        </p>
      </div>
      <div className="text-right flex-shrink-0 ml-3">
        <p className="text-sm font-semibold text-[#1A1A18]">
          {receipt.total != null
            ? new Intl.NumberFormat('fr-CA', { style: 'currency', currency: receipt.currency || 'CAD' }).format(receipt.total)
            : '—'}
        </p>
        {receipt.page_count > 1 && (
          <p className="text-[10px] text-muted">{receipt.page_count}p</p>
        )}
      </div>
    </div>
  )
}

function formatDate(str) {
  if (!str) return ''
  const d = new Date(str + 'T12:00:00')
  return d.toLocaleDateString('fr-CA', { month: 'short', year: 'numeric' })
}
