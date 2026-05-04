import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, Plus, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useShares } from '../hooks/useShares'
import { useDimensions } from '../context/DimensionsContext'

export default function SharingPage() {
  const { i18n } = useTranslation()
  const lang = i18n.language?.startsWith('fr') ? 'fr' : 'en'
  const { owned, loading, createShare, revokeShare } = useShares()
  const { accountsWithCategories } = useDimensions()

  const [form, setForm] = useState({ account_name: '', email: '', permission: 'edit' })
  const [shareError, setShareError] = useState(null)
  const [shareLoading, setShareLoading] = useState(false)

  const sharesByAccount = useMemo(() => {
    const map = {}
    for (const s of owned) {
      if (!map[s.account_name]) map[s.account_name] = []
      map[s.account_name].push(s)
    }
    return map
  }, [owned])

  const setField = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const handleShare = async () => {
    if (!form.account_name || !form.email.includes('@')) return
    setShareLoading(true)
    setShareError(null)
    const { error } = await createShare(form.account_name, form.email.trim(), form.permission)
    if (error === 'already_shared') {
      setShareError(lang === 'fr' ? 'Déjà partagé avec cet utilisateur' : 'Already shared with this user')
    } else if (error === 'cannot_share_with_self') {
      setShareError(lang === 'fr' ? 'Vous ne pouvez pas vous partager un compte' : 'Cannot share with yourself')
    } else if (error) {
      setShareError(lang === 'fr' ? 'Erreur' : 'Error')
    } else {
      setField('email', '')
    }
    setShareLoading(false)
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6 pb-28 space-y-5">
      <div className="flex items-center gap-2">
        <Link to="/settings" className="p-1 -ml-1 text-muted hover:text-primary transition-colors">
          <ChevronLeft size={20} />
        </Link>
        <h1 className="text-xl font-bold text-[#1A1A18]">
          {lang === 'fr' ? 'Partage de comptes' : 'Account sharing'}
        </h1>
      </div>

      <p className="text-sm text-muted leading-relaxed">
        {lang === 'fr'
          ? 'Donnez accès à un compte à un autre utilisateur Récu. Il verra les reçus de ce compte dans son application.'
          : 'Give another Récu user access to one of your accounts. They will see its receipts in their own app.'}
      </p>

      {/* Share form */}
      <div className="bg-surface border border-border rounded-[8px] p-4 space-y-4">
        <p className="text-sm font-semibold text-[#1A1A18]">
          {lang === 'fr' ? 'Nouveau partage' : 'New share'}
        </p>

        <div>
          <p className="text-xs text-muted font-medium mb-1.5">
            {lang === 'fr' ? 'Compte' : 'Account'}
          </p>
          <select
            value={form.account_name}
            onChange={e => setField('account_name', e.target.value)}
            className="w-full text-sm bg-background border border-border rounded-[6px] px-3 py-2 focus:outline-none focus:border-primary transition-colors text-[#1A1A18]"
          >
            <option value="">{lang === 'fr' ? '— Sélectionner —' : '— Select —'}</option>
            {accountsWithCategories.map(a => (
              <option key={a.id} value={a.name}>{a.name}</option>
            ))}
          </select>
        </div>

        <div>
          <p className="text-xs text-muted font-medium mb-1.5">
            {lang === 'fr' ? 'Email Récu du destinataire' : "Recipient's Récu email"}
          </p>
          <input
            type="email"
            value={form.email}
            onChange={e => { setField('email', e.target.value); setShareError(null) }}
            onKeyDown={e => e.key === 'Enter' && handleShare()}
            placeholder="email@example.com"
            className="w-full text-sm bg-background border border-border rounded-[6px] px-3 py-2 focus:outline-none focus:border-primary transition-colors text-[#1A1A18] placeholder:text-muted"
          />
          <p className="text-xs text-muted mt-1">
            {lang === 'fr'
              ? 'Doit être l\'adresse Google utilisée pour se connecter à Récu.'
              : 'Must be the Google address used to sign in to Récu.'}
          </p>
        </div>

        <div>
          <p className="text-xs text-muted font-medium mb-1.5">
            {lang === 'fr' ? 'Permission' : 'Permission'}
          </p>
          <div className="flex gap-2">
            {['view', 'edit'].map(p => (
              <button
                key={p}
                onClick={() => setField('permission', p)}
                className={`flex-1 py-1.5 text-xs rounded-[6px] border font-medium transition-colors ${
                  form.permission === p
                    ? 'bg-primary text-white border-primary'
                    : 'border-border text-muted hover:border-primary hover:text-primary'
                }`}
              >
                {p === 'view'
                  ? (lang === 'fr' ? 'Lecture seule' : 'View only')
                  : (lang === 'fr' ? 'Peut modifier' : 'Can edit')}
              </button>
            ))}
          </div>
        </div>

        {shareError && <p className="text-xs text-error">{shareError}</p>}

        <button
          onClick={handleShare}
          disabled={shareLoading || !form.account_name || !form.email.includes('@')}
          className="w-full py-2.5 text-sm bg-primary text-white rounded-[8px] font-medium disabled:opacity-50 active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
        >
          <Plus size={15} />
          {shareLoading
            ? (lang === 'fr' ? 'Partage en cours…' : 'Sharing…')
            : (lang === 'fr' ? 'Partager' : 'Share')}
        </button>
      </div>

      {/* Active shares grouped by account */}
      {!loading && Object.keys(sharesByAccount).length > 0 && (
        <div className="space-y-3">
          <p className="text-xs text-muted uppercase tracking-wide font-medium">
            {lang === 'fr' ? 'Accès actifs' : 'Active access'}
          </p>
          {Object.entries(sharesByAccount).sort(([a], [b]) => a.localeCompare(b)).map(([accountName, shares]) => (
            <div key={accountName} className="bg-surface border border-border rounded-[8px] p-4 space-y-2.5">
              <p className="text-sm font-semibold text-[#1A1A18]">{accountName}</p>
              {shares.map(s => (
                <div key={s.id} className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[#1A1A18] truncate">{s.shared_with_email}</p>
                    <p className="text-xs text-muted">
                      {s.status === 'pending'
                        ? (lang === 'fr' ? 'En attente d\'inscription' : 'Pending — user not signed up yet')
                        : s.permission === 'edit'
                          ? (lang === 'fr' ? 'Peut modifier' : 'Can edit')
                          : (lang === 'fr' ? 'Lecture seule' : 'View only')}
                    </p>
                  </div>
                  <button
                    onClick={() => revokeShare(s.id)}
                    className="flex-shrink-0 p-1 text-muted hover:text-error transition-colors"
                    title={lang === 'fr' ? 'Révoquer' : 'Revoke'}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {!loading && owned.length === 0 && (
        <p className="text-sm text-muted text-center py-4">
          {lang === 'fr' ? 'Aucun compte partagé pour l\'instant.' : 'No accounts shared yet.'}
        </p>
      )}
    </div>
  )
}
