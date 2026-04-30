import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ArrowLeft, Download } from 'lucide-react'

export default function ExportPage() {
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

      <div className="bg-surface rounded-[8px] border border-border p-8 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
            <Download size={20} className="text-primary" />
          </div>
          <div>
            <h1 className="font-bold text-[#1A1A18]">{t('export.title')}</h1>
            <p className="text-sm text-muted">{t('export.coming_soon')}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
