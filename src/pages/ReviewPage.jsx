import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { ClipboardX, Camera, Upload } from 'lucide-react'
import { useReceipts } from '../hooks/useReceipts'
import { usePatterns } from '../hooks/usePatterns'
import VendorGroup from '../components/VendorGroup'
import { normalizeVendor, fuzzyMatch } from '../lib/utils'

function groupReceipts(receipts) {
  const groups = [] // [{ key, displayName, receipts }]

  for (const receipt of receipts) {
    const vNorm = normalizeVendor(receipt.vendor || '')
    if (!vNorm) {
      // No vendor — goes to Divers
      const divers = groups.find((g) => g.isDivers)
      if (divers) divers.receipts.push(receipt)
      else groups.push({ key: '__divers', displayName: 'Divers', receipts: [receipt], isDivers: true })
      continue
    }

    const match = groups.find((g) => !g.isDivers && fuzzyMatch(g.key, vNorm))
    if (match) {
      match.receipts.push(receipt)
    } else {
      groups.push({ key: vNorm, displayName: receipt.vendor || vNorm, receipts: [receipt], isDivers: false })
    }
  }

  // Sort by count desc, Divers always last
  const regular = groups.filter((g) => !g.isDivers).sort((a, b) => b.receipts.length - a.receipts.length)
  const divers = groups.filter((g) => g.isDivers)
  return [...regular, ...divers]
}

export default function ReviewPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { pendingReceipts, loading, confirmReceipt, createRecurringEntry } = useReceipts()
  const { savePattern, applyPatternToPending } = usePatterns()

  const [skippedIds, setSkippedIds] = useState(new Set())
  const [toast, setToast] = useState(null)

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const groups = useMemo(() => groupReceipts(pendingReceipts), [pendingReceipts])

  const handleConfirmOne = async (id, data, recurring, patternInfo) => {
    const receipt = pendingReceipts.find((r) => r.id === id)
    const merged = { ...(receipt || {}), ...data }

    const ok = await confirmReceipt(id, data)
    if (!ok) return showToast(t('common.error'))

    // Pattern learning
    if (merged.vendor && merged.labels) {
      await savePattern(merged.vendor, merged.labels)
    }

    // Propagate if pattern prompt was accepted (dimension field changed)
    if (patternInfo?.vendor && patternInfo.field?.startsWith('label_')) {
      await applyPatternToPending(patternInfo.vendor, merged.labels || {})
    }

    // Recurring entry
    if (recurring) {
      await createRecurringEntry(id, recurring, merged)
      showToast(t('review.recurring_created'))
    } else {
      showToast(t('review.confirm_success', { count: 1 }))
    }
  }

  const handleConfirmAll = async (ids) => {
    const receipts = pendingReceipts.filter((r) => ids.includes(r.id))
    await Promise.all(receipts.map((r) => confirmReceipt(r.id, {})))

    // Save pattern for first receipt that has labels set
    const withDims = receipts.find((r) => r.labels?.category || r.labels?.property)
    if (withDims?.vendor) {
      await savePattern(withDims.vendor, withDims.labels)
    }

    showToast(t('review.confirm_success', { count: ids.length }))
  }

  const handleSkip = (id) => {
    setSkippedIds((prev) => new Set([...prev, id]))
    // Re-add to bottom after a moment so queue doesn't lose the item
    setTimeout(() => setSkippedIds((prev) => { const next = new Set(prev); next.delete(id); return next }), 5000)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const activeGroups = groups.filter((g) => g.receipts.some((r) => !skippedIds.has(r.id)))

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-4 relative">
      <h1 className="text-xl font-bold text-[#1A1A18]">{t('review.title')}</h1>

      {activeGroups.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
          <ClipboardX size={48} className="text-border" strokeWidth={1.5} />
          <div>
            <p className="font-medium text-[#1A1A18]">{t('review.empty')}</p>
            <p className="text-muted text-sm max-w-xs mt-1">{t('review.empty_sub')}</p>
          </div>
          <div className="flex gap-3 mt-2">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-[8px] text-sm font-medium active:scale-[0.98] transition-transform"
            >
              <Camera size={16} />
              {t('capture.photo')}
            </button>
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 px-5 py-2.5 border border-primary text-primary rounded-[8px] text-sm font-medium active:scale-[0.98] transition-transform"
            >
              <Upload size={16} />
              {t('capture.upload')}
            </button>
          </div>
        </div>
      ) : (
        activeGroups.map((group) => (
          <VendorGroup
            key={group.key}
            displayName={group.displayName}
            receipts={group.receipts}
            isDivers={group.isDivers}
            skippedIds={skippedIds}
            onConfirmAll={handleConfirmAll}
            onConfirmOne={handleConfirmOne}
            onSkipOne={handleSkip}
          />
        ))
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
