import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Search, BookOpen } from 'lucide-react'

const FILTER_CHIPS_FR = ['Tous', 'Ce mois', 'Fournisseur', 'Catégorie']
const FILTER_CHIPS_EN = ['All', 'This month', 'Vendor', 'Category']

export default function LedgerPage() {
  const { t, i18n } = useTranslation()
  const chips = i18n.language?.startsWith('fr') ? FILTER_CHIPS_FR : FILTER_CHIPS_EN

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-[#1A1A18]">{t('ledger.title')}</h1>
        <Link
          to="/export"
          className="text-sm text-primary font-medium hover:underline"
        >
          {t('ledger.export')}
        </Link>
      </div>

      {/* Search bar */}
      <div className="relative mb-3">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
        />
        <input
          type="search"
          placeholder={t('ledger.search')}
          className="w-full pl-9 pr-4 py-2.5 bg-surface border border-border rounded-[8px] text-sm focus:outline-none focus:border-primary transition-colors"
        />
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1 -mx-4 px-4">
        {chips.map((chip, i) => (
          <span
            key={chip}
            className={`flex-shrink-0 px-3 py-1 rounded-full text-sm border transition-colors cursor-pointer ${
              i === 0
                ? 'bg-primary text-white border-primary'
                : 'bg-surface border-border text-muted hover:border-primary hover:text-primary'
            }`}
          >
            {chip}
          </span>
        ))}
      </div>

      {/* Empty state */}
      <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
        <BookOpen size={48} className="text-border" strokeWidth={1.5} />
        <p className="text-muted text-sm">{t('ledger.empty')}</p>
      </div>
    </div>
  )
}
