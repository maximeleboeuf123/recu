import { X, UserCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export default function ShareInviteModal({ shares, onDismiss }) {
  const { i18n } = useTranslation()
  const lang = i18n.language?.startsWith('fr') ? 'fr' : 'en'

  if (!shares.length) return null

  return (
    <div className="fixed inset-0 z-[300] flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/40" onClick={onDismiss} />
      <div className="relative w-full max-w-sm mx-4 mb-4 sm:mb-0 bg-surface rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-start justify-between p-5 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
              <UserCheck size={20} className="text-indigo-600" />
            </div>
            <div>
              <p className="font-semibold text-[#1A1A18]">
                {lang === 'fr'
                  ? shares.length === 1 ? 'Compte partagé avec vous' : 'Comptes partagés avec vous'
                  : shares.length === 1 ? 'Account shared with you' : 'Accounts shared with you'}
              </p>
              <p className="text-xs text-muted mt-0.5">
                {lang === 'fr'
                  ? 'Disponible dans vos listes de comptes'
                  : 'Now available in your account lists'}
              </p>
            </div>
          </div>
          <button onClick={onDismiss} className="p-1 text-muted hover:text-[#1A1A18] transition-colors flex-shrink-0">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 pb-2 space-y-2 max-h-60 overflow-y-auto">
          {shares.map(s => (
            <div key={s.id} className="bg-indigo-50 border border-indigo-100 rounded-[8px] px-4 py-3">
              <p className="text-sm font-semibold text-[#1A1A18]">{s.account_name}</p>
              <p className="text-xs text-muted mt-0.5">
                {lang === 'fr' ? 'Partagé par' : 'Shared by'} {s.owner_email}
                {' · '}
                {s.permission === 'edit'
                  ? (lang === 'fr' ? 'Peut modifier' : 'Can edit')
                  : (lang === 'fr' ? 'Lecture seule' : 'View only')}
              </p>
            </div>
          ))}
        </div>

        <div className="p-5 pt-3">
          <button
            onClick={onDismiss}
            className="w-full py-2.5 text-sm bg-primary text-white rounded-[8px] font-medium active:scale-[0.98] transition-transform"
          >
            {lang === 'fr' ? 'Parfait !' : 'Got it!'}
          </button>
        </div>
      </div>
    </div>
  )
}
