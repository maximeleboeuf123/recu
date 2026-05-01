import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft } from 'lucide-react'
import { useReceipts } from '../hooks/useReceipts'
import { usePatterns } from '../hooks/usePatterns'
import ReviewCard from '../components/ReviewCard'

export default function ReceiptPage() {
  const { id } = useParams()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { receipts, loading, updateReceipt, deleteReceipt } = useReceipts()
  const { savePattern, applyPatternToPending } = usePatterns()
  const [toast, setToast] = useState(null)

  const receipt = receipts.find((r) => r.id === id)

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const handleSave = async (receiptId, data, _recurring, _patternInfo) => {
    const original = receipts.find((r) => r.id === receiptId)
    const ok = await updateReceipt(receiptId, data, original)
    if (!ok) return showToast(t('common.error'))

    if (data.vendor && data.labels) {
      const dimChanged =
        original?.labels?.category !== data.labels.category ||
        original?.labels?.property !== data.labels.property
      if (dimChanged) {
        await savePattern(data.vendor, data.labels)
        await applyPatternToPending(data.vendor, data.labels)
      }
    }
    showToast(t('common.save'))
  }

  const handleDelete = async (receiptId) => {
    const ok = await deleteReceipt(receiptId)
    if (!ok) return showToast(t('common.error'))
    navigate(-1)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!receipt) {
    return (
      <div className="max-w-lg mx-auto px-4 py-6">
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-sm text-muted hover:text-primary mb-6 transition-colors"
        >
          <ArrowLeft size={16} />
          {t('nav.home')}
        </Link>
        <p className="text-muted text-sm text-center py-16">{t('receipt.loading')}</p>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6 pb-24">
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-primary mb-6 transition-colors"
      >
        <ArrowLeft size={16} />
        {t('common.cancel')}
      </button>

      <ReviewCard
        receipt={receipt}
        mode="ledger"
        onConfirm={handleSave}
        onClose={() => navigate(-1)}
        onDelete={handleDelete}
      />

      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-[#1A1A18] text-white px-5 py-2.5 rounded-full text-sm z-50 shadow-lg pointer-events-none">
          {toast}
        </div>
      )}
    </div>
  )
}
