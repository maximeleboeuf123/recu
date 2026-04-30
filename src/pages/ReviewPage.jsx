import { useTranslation } from 'react-i18next'
import { ClipboardX } from 'lucide-react'

export default function ReviewPage() {
  const { t } = useTranslation()

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <h1 className="text-xl font-bold text-[#1A1A18] mb-4">{t('review.title')}</h1>

      <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
        <ClipboardX size={48} className="text-border" strokeWidth={1.5} />
        <p className="font-medium text-[#1A1A18]">{t('review.empty')}</p>
        <p className="text-muted text-sm max-w-xs">{t('review.empty_sub')}</p>
      </div>
    </div>
  )
}
