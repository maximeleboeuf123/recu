import { useState } from 'react'
import { X, UserCheck, Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useShares } from '../hooks/useShares'

export default function ShareInviteModal({ shares, onDone }) {
  const { i18n } = useTranslation()
  const lang = i18n.language?.startsWith('fr') ? 'fr' : 'en'
  const { acceptShare, declineShare } = useShares()
  const [acting, setActing] = useState({}) // { [id]: 'accepting' | 'declining' }
  const [handled, setHandled] = useState(new Set())

  const pending = shares.filter(s => !handled.has(s.id))

  const handle = async (id, action) => {
    setActing(p => ({ ...p, [id]: action }))
    if (action === 'accept') await acceptShare(id)
    else await declineShare(id)
    setActing(p => { const n = { ...p }; delete n[id]; return n })
    setHandled(p => new Set([...p, id]))
  }

  if (pending.length === 0) {
    onDone()
    return null
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative w-full max-w-sm mx-4 mb-4 sm:mb-0 bg-surface rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-start justify-between p-5 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
              <UserCheck size={20} className="text-indigo-600" />
            </div>
            <div>
              <p className="font-semibold text-[#1A1A18]">
                {lang === 'fr'
                  ? pending.length === 1 ? 'Invitation de partage' : 'Invitations de partage'
                  : pending.length === 1 ? 'Share invitation' : 'Share invitations'}
              </p>
              <p className="text-xs text-muted mt-0.5">
                {lang === 'fr' ? 'Acceptez ou refusez chaque compte' : 'Accept or decline each account'}
              </p>
            </div>
          </div>
          <button onClick={onDone} className="p-1 text-muted hover:text-[#1A1A18] transition-colors flex-shrink-0">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 pb-3 space-y-3 max-h-72 overflow-y-auto">
          {pending.map(s => (
            <div key={s.id} className="bg-indigo-50 border border-indigo-100 rounded-[10px] p-4">
              <p className="text-sm font-semibold text-[#1A1A18]">{s.account_name}</p>
              <p className="text-xs text-muted mt-0.5 mb-3">
                {lang === 'fr' ? 'Partagé par' : 'Shared by'} {s.owner_email}
                {' · '}
                {s.permission === 'edit'
                  ? (lang === 'fr' ? 'Peut modifier' : 'Can edit')
                  : (lang === 'fr' ? 'Lecture seule' : 'View only')}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => handle(s.id, 'decline')}
                  disabled={!!acting[s.id]}
                  className="flex-1 py-2 text-xs font-medium border border-border rounded-[6px] text-muted hover:border-error hover:text-error transition-colors disabled:opacity-40"
                >
                  {acting[s.id] === 'declining'
                    ? '…'
                    : lang === 'fr' ? 'Refuser' : 'Decline'}
                </button>
                <button
                  onClick={() => handle(s.id, 'accept')}
                  disabled={!!acting[s.id]}
                  className="flex-1 py-2 text-xs font-medium bg-primary text-white rounded-[6px] flex items-center justify-center gap-1.5 disabled:opacity-40 transition-opacity"
                >
                  {acting[s.id] === 'accepting' ? '…' : <><Check size={12} />{lang === 'fr' ? 'Accepter' : 'Accept'}</>}
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="px-5 pb-5">
          <button
            onClick={onDone}
            className="w-full py-2 text-xs text-muted hover:text-[#1A1A18] transition-colors"
          >
            {lang === 'fr' ? 'Décider plus tard' : 'Decide later'}
          </button>
        </div>
      </div>
    </div>
  )
}
