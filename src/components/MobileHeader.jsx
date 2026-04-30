import { useTranslation } from 'react-i18next'
import LanguageToggle from './LanguageToggle'
import { useAuth } from '../hooks/useAuth'

export default function MobileHeader() {
  const { t } = useTranslation()
  const { session } = useAuth()

  return (
    <header
      className="fixed top-0 left-0 right-0 bg-surface border-b border-border z-50 flex items-center justify-between px-4"
      style={{ height: 'calc(52px + env(safe-area-inset-top, 0px))', paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      <span className="text-primary font-bold text-lg font-serif tracking-tight">
        {t('app.name')}
      </span>
      <LanguageToggle session={session} />
    </header>
  )
}
