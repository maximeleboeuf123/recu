import { useRegisterSW } from 'virtual:pwa-register/react'
import { useTranslation } from 'react-i18next'

export default function UpdatePrompt() {
  const { i18n } = useTranslation()
  const lang = i18n.language?.startsWith('fr') ? 'fr' : 'en'

  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW()

  if (!needRefresh) return null

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[300] flex items-center gap-3 bg-[#1A1A18] text-white pl-4 pr-2 py-2 rounded-full shadow-xl text-sm whitespace-nowrap">
      <span>{lang === 'fr' ? 'Nouvelle version disponible' : 'New version available'}</span>
      <button
        onClick={() => updateServiceWorker(true)}
        className="bg-primary text-white text-xs font-semibold px-3 py-1.5 rounded-full hover:bg-primary/90 active:scale-[0.97] transition-transform"
      >
        {lang === 'fr' ? 'Mettre à jour' : 'Update'}
      </button>
    </div>
  )
}
