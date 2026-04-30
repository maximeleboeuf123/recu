import { useTranslation } from 'react-i18next'
import { Camera, Upload } from 'lucide-react'

const PENDING_COUNT = 0

export default function HomePage() {
  const { t } = useTranslation()

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
      {/* Pending badge */}
      {PENDING_COUNT > 0 && (
        <div className="bg-accent/10 text-accent rounded-lg p-3 text-center text-sm font-semibold">
          {t('home.pending_other', { count: PENDING_COUNT })}
        </div>
      )}

      {/* Capture CTAs */}
      <div className="grid grid-cols-2 gap-3">
        <button className="flex flex-col items-center justify-center gap-3 bg-primary text-white rounded-[8px] p-6 active:scale-[0.97] transition-transform shadow-sm">
          <Camera size={32} strokeWidth={1.8} />
          <span className="text-sm font-medium text-center leading-tight">
            {t('home.capture_photo')}
          </span>
        </button>

        <button className="flex flex-col items-center justify-center gap-3 bg-surface text-primary border-2 border-primary rounded-[8px] p-6 active:scale-[0.97] transition-transform">
          <Upload size={32} strokeWidth={1.8} />
          <span className="text-sm font-medium text-center leading-tight">
            {t('home.upload_file')}
          </span>
        </button>
      </div>

      {/* Recent receipts strip */}
      <div>
        <h2 className="text-[#1A1A18] font-semibold mb-3 text-sm uppercase tracking-wide text-muted">
          {t('home.recent')}
        </h2>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-muted text-sm">{t('home.no_recent')}</p>
        </div>
      </div>
    </div>
  )
}
