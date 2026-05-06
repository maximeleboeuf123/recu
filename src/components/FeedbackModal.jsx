import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Send } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

const TYPES = [
  { key: 'suggestion', en: 'Suggestion', fr: 'Suggestion' },
  { key: 'bug', en: 'Bug report', fr: 'Bogue' },
  { key: 'other', en: 'Other', fr: 'Autre' },
]

export default function FeedbackModal({ onClose }) {
  const { i18n } = useTranslation()
  const lang = i18n.language?.startsWith('fr') ? 'fr' : 'en'
  const { session } = useAuth()
  const [type, setType] = useState('suggestion')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState(null)

  const submit = async () => {
    if (!message.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ type, message }),
      })
      if (!res.ok) throw new Error()
      setDone(true)
      setTimeout(onClose, 1800)
    } catch {
      setError(lang === 'fr' ? 'Erreur — réessayez' : 'Something went wrong — try again')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-surface rounded-t-[20px] shadow-xl p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] animate-slide-up">
        <div className="w-10 h-1 bg-border rounded-full mx-auto mb-5" />

        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-[#1A1A18]">
            {lang === 'fr' ? 'Envoyer un commentaire' : 'Send feedback'}
          </h2>
          <button onClick={onClose} className="p-1 text-muted hover:text-[#1A1A18] transition-colors">
            <X size={18} />
          </button>
        </div>

        {done ? (
          <div className="text-center py-8">
            <p className="text-2xl mb-2">🎉</p>
            <p className="text-sm font-medium text-[#1A1A18]">
              {lang === 'fr' ? 'Merci pour votre commentaire !' : 'Thanks for your feedback!'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex gap-2">
              {TYPES.map(t => (
                <button
                  key={t.key}
                  onClick={() => setType(t.key)}
                  className={`flex-1 py-1.5 text-xs rounded-[6px] border font-medium transition-colors ${
                    type === t.key
                      ? 'bg-primary text-white border-primary'
                      : 'border-border text-muted hover:border-primary hover:text-primary'
                  }`}
                >
                  {t[lang]}
                </button>
              ))}
            </div>

            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder={lang === 'fr' ? 'Décrivez votre idée ou le problème…' : 'Describe your idea or the issue…'}
              rows={5}
              className="w-full text-sm bg-background border border-border rounded-[8px] px-3 py-2.5 focus:outline-none focus:border-primary transition-colors resize-none text-[#1A1A18] placeholder:text-muted"
            />

            {error && <p className="text-xs text-error">{error}</p>}

            <button
              onClick={submit}
              disabled={loading || !message.trim()}
              className="w-full py-3 bg-primary text-white rounded-[10px] font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98] transition-transform"
            >
              <Send size={14} />
              {loading
                ? (lang === 'fr' ? 'Envoi…' : 'Sending…')
                : (lang === 'fr' ? 'Envoyer' : 'Send')}
            </button>
          </div>
        )}
      </div>
    </>
  )
}
