import { useParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft } from 'lucide-react'

export default function ReceiptPage() {
  const { id } = useParams()
  const { t } = useTranslation()

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <Link
        to="/ledger"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-primary mb-6 transition-colors"
      >
        <ArrowLeft size={16} />
        {t('nav.ledger')}
      </Link>

      <div className="bg-surface rounded-[8px] border border-border p-8 flex flex-col items-center justify-center min-h-[200px] text-center gap-2">
        <p className="text-muted text-sm">{t('receipt.loading')}</p>
        <p className="text-xs text-border font-mono">{id}</p>
      </div>
    </div>
  )
}
