import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Camera, Sparkles, CheckSquare, LayoutGrid, FileSpreadsheet, Receipt, Lightbulb, Send, Upload, Settings, Mail } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

const STEPS = {
  en: [
    { icon: Camera,          color: 'bg-blue-50 text-blue-600',    title: 'Capture a receipt',         body: 'Tap the Capture tab. Upload a photo, PDF, or image — or use your camera. Multi-page receipts are supported.' },
    { icon: Sparkles,        color: 'bg-violet-50 text-violet-600', title: 'AI extracts the data',      body: 'Claude AI reads vendor, date, amounts, and taxes automatically in ~60 seconds. Low-confidence fields are flagged.' },
    { icon: CheckSquare,     color: 'bg-green-50 text-green-600',   title: 'Review & confirm',          body: 'Open the Review tab. Edit any field inline, then confirm. Swipe right to confirm fast, left to skip for later.' },
    { icon: LayoutGrid,      color: 'bg-amber-50 text-amber-600',   title: 'Set up accounts',           body: 'Go to Settings → Accounts & Categories. Add accounts (e.g. "Personal", "Rental") and categories under each one.' },
    { icon: Receipt,         color: 'bg-orange-50 text-orange-600', title: 'Assign & organise',         body: 'On each receipt card, pick an account and category. Récu learns your vendors and pre-fills them next time.' },
    { icon: FileSpreadsheet, color: 'bg-emerald-50 text-emerald-600', title: 'Export for your accountant', body: 'Go to Export. Download an XLSX with all transactions + a summary tab grouped by account and category.' },
  ],
  fr: [
    { icon: Camera,          color: 'bg-blue-50 text-blue-600',    title: 'Capturer un reçu',             body: 'Appuyez sur Capturer. Téléversez une photo, un PDF ou une image — ou utilisez l\'appareil photo. Les reçus multi-pages sont supportés.' },
    { icon: Sparkles,        color: 'bg-violet-50 text-violet-600', title: 'L\'IA extrait les données',    body: 'Claude IA lit le fournisseur, la date, les montants et les taxes automatiquement en ~60 secondes. Les champs incertains sont signalés.' },
    { icon: CheckSquare,     color: 'bg-green-50 text-green-600',   title: 'Réviser et confirmer',         body: 'Ouvrez l\'onglet Révision. Modifiez n\'importe quel champ, puis confirmez. Glissez à droite pour confirmer vite, à gauche pour plus tard.' },
    { icon: LayoutGrid,      color: 'bg-amber-50 text-amber-600',   title: 'Configurer les comptes',       body: 'Allez dans Paramètres → Comptes et catégories. Ajoutez des comptes (ex. « Personnel », « Locatif ») et des catégories.' },
    { icon: Receipt,         color: 'bg-orange-50 text-orange-600', title: 'Assigner et organiser',        body: 'Sur chaque fiche, choisissez un compte et une catégorie. Récu apprend vos fournisseurs et les pré-remplit.' },
    { icon: FileSpreadsheet, color: 'bg-emerald-50 text-emerald-600', title: 'Exporter pour votre comptable', body: 'Allez dans Exporter. Téléchargez un XLSX avec toutes les transactions + un onglet résumé par compte et catégorie.' },
  ],
}

const TIPS = {
  en: [
    { icon: '🇨🇦', text: 'GST = 5% federal tax · QST = 9.975% Quebec tax · HST = combined 13–15% in Ontario and other provinces.' },
    { icon: '🔢', text: 'For tax credits (ITCs/ITRs), you need the vendor\'s GST/QST number. Récu extracts these automatically.' },
    { icon: '📧', text: 'Forward invoices by email to your Récu inbox address — find it in Settings.' },
    { icon: '🔁', text: 'Use Capture → Recurring entries for monthly rent, subscriptions, or any fixed repeating expense.' },
    { icon: '☁️', text: 'Connect Google Drive in Settings. Files are saved in Récu/_Receipts/{Account}/{Year}/{Category}/.' },
  ],
  fr: [
    { icon: '🇨🇦', text: 'TPS = 5% taxe fédérale · TVQ = 9,975% taxe québécoise · HST = taxe combinée 13–15% en Ontario et autres provinces.' },
    { icon: '🔢', text: 'Pour les crédits de taxe (CTI/RTI), vous avez besoin du numéro TPS/TVQ du fournisseur. Récu les extrait automatiquement.' },
    { icon: '📧', text: 'Transférez des factures par courriel à votre adresse Récu — trouvez-la dans Paramètres.' },
    { icon: '🔁', text: 'Utilisez Capturer → Entrées récurrentes pour les loyers, abonnements ou toute dépense fixe répétée.' },
    { icon: '☁️', text: 'Connectez Google Drive dans Paramètres. Les fichiers sont sauvegardés dans Récu/_Receipts/{Compte}/{Année}/{Catégorie}/.' },
  ],
}

const CHAT_PROMPTS = {
  en: [
    'How does Récu work?',
    'How do I set up accounts and categories?',
    'Do I need Google Drive?',
    'How do recurring entries work?',
  ],
  fr: [
    'Comment fonctionne Récu ?',
    'Comment configurer les comptes et catégories ?',
    'Ai-je besoin de Google Drive ?',
    'Comment fonctionnent les entrées récurrentes ?',
  ],
}

export default function GuidePage() {
  const { i18n } = useTranslation()
  const { session } = useAuth()
  const navigate = useNavigate()
  const lang = i18n.language?.startsWith('fr') ? 'fr' : 'en'

  const steps = STEPS[lang]
  const tips = TIPS[lang]

  return (
    <div className="max-w-lg mx-auto px-4 py-6 pb-28 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={() => navigate(-1)}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-border/30 transition-colors flex-shrink-0"
        >
          <ArrowLeft size={18} className="text-muted" />
        </button>
        <h1 className="text-xl font-bold text-[#1A1A18]">
          {lang === 'en' ? 'Guide & Assistant' : 'Guide et assistant'}
        </h1>
      </div>

      {/* Getting started */}
      <section className="space-y-3">
        <p className="text-xs text-muted uppercase tracking-wide font-medium">
          {lang === 'en' ? 'Getting started' : 'Pour commencer'}
        </p>
        {steps.map((step, i) => (
          <StepCard key={i} step={step} index={i + 1} />
        ))}
      </section>

      {/* Inline assistant */}
      <section className="space-y-3">
        <p className="text-xs text-muted uppercase tracking-wide font-medium">
          {lang === 'en' ? 'Ask the assistant' : 'Poser une question'}
        </p>
        <InlineChat lang={lang} session={session} prompts={CHAT_PROMPTS[lang]} />
      </section>

      {/* Tips */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Lightbulb size={13} className="text-amber-500" />
          <p className="text-xs text-muted uppercase tracking-wide font-medium">
            {lang === 'en' ? 'Good to know' : 'Bon à savoir'}
          </p>
        </div>
        <div className="bg-surface border border-border rounded-[8px] divide-y divide-border">
          {tips.map((tip, i) => (
            <div key={i} className="flex items-start gap-3 px-4 py-3">
              <span className="text-base flex-shrink-0 leading-none mt-0.5">{tip.icon}</span>
              <p className="text-sm text-[#1A1A18] leading-snug">{tip.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Quick links */}
      <section className="space-y-2">
        <p className="text-xs text-muted uppercase tracking-wide font-medium mb-3">
          {lang === 'en' ? 'Jump to' : 'Aller à'}
        </p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { Icon: Upload,   label: lang === 'en' ? 'Capture'  : 'Capturer', path: '/capture'  },
            { Icon: Settings, label: lang === 'en' ? 'Settings' : 'Paramètres', path: '/settings' },
          ].map(({ Icon, label, path }) => (
            <button
              key={path}
              onClick={() => navigate(path)}
              className="flex items-center gap-2.5 bg-surface border border-border rounded-[8px] px-4 py-3 hover:border-primary/40 hover:bg-primary/5 transition-colors active:scale-[0.98]"
            >
              <Icon size={16} className="text-primary flex-shrink-0" />
              <span className="text-sm font-medium text-[#1A1A18]">{label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Support */}
      <div className="text-center pb-2">
        <p className="text-xs text-muted mb-1">
          {lang === 'en' ? 'Still have questions?' : 'Encore des questions ?'}
        </p>
        <a
          href="mailto:hello@recu.app"
          className="inline-flex items-center gap-1.5 text-sm text-primary font-medium hover:underline"
        >
          <Mail size={13} />
          hello@recu.app
        </a>
      </div>
    </div>
  )
}

function StepCard({ step, index }) {
  const { icon: Icon, color, title, body } = step
  return (
    <div className="bg-surface border border-border rounded-[8px] p-4 flex gap-3">
      <div className="flex-shrink-0 flex flex-col items-center gap-1.5">
        <div className={`w-9 h-9 rounded-[8px] flex items-center justify-center ${color}`}>
          <Icon size={17} strokeWidth={1.8} />
        </div>
        <span className="text-[10px] font-bold text-muted/50">{index}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[#1A1A18] mb-0.5">{title}</p>
        <p className="text-xs text-muted leading-relaxed">{body}</p>
      </div>
    </div>
  )
}

function InlineChat({ lang, session, prompts }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const endRef = useRef(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const sendMessage = async (text) => {
    const content = (typeof text === 'string' ? text : input).trim()
    if (!content || loading || !session?.access_token) return
    setInput('')
    setError(null)
    const next = [...messages, { role: 'user', content }]
    setMessages(next)
    setLoading(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ messages: next.map((m) => ({ role: m.role, content: m.content })) }),
      })
      const data = await res.json()
      if (!res.ok || !data.reply) throw new Error()
      setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }])
    } catch {
      setError(lang === 'fr' ? 'Une erreur est survenue. Réessayez.' : 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const isEmpty = messages.length === 0 && !loading

  return (
    <div
      className="bg-surface border border-border rounded-[12px] overflow-hidden flex flex-col"
      style={{ height: '400px' }}
    >
      {/* Chat header */}
      <div className="flex items-center gap-2.5 px-4 py-2.5 bg-gradient-to-r from-primary/8 to-transparent border-b border-border/60 flex-shrink-0">
        <div className="w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
          <Sparkles size={12} className="text-primary" />
        </div>
        <p className="text-sm font-semibold text-[#1A1A18]">Récu Assistant</p>
        <p className="text-xs text-muted ml-auto">
          {lang === 'fr' ? 'Répond en FR et EN' : 'Answers in EN & FR'}
        </p>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5">
        {isEmpty && (
          <div className="space-y-2 pt-1">
            <p className="text-xs text-muted">
              {lang === 'fr' ? 'Questions fréquentes :' : 'Common questions:'}
            </p>
            {prompts.map((p) => (
              <button
                key={p}
                onClick={() => sendMessage(p)}
                className="w-full text-left text-sm px-3 py-2.5 bg-background border border-border rounded-[8px] hover:border-primary/40 hover:bg-primary/5 transition-colors text-[#1A1A18] active:scale-[0.99] flex items-center justify-between gap-2"
              >
                <span className="flex-1">{p}</span>
                <Send size={12} className="text-muted flex-shrink-0" />
              </button>
            ))}
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap rounded-[12px] ${
                m.role === 'user'
                  ? 'bg-primary text-white rounded-br-[3px]'
                  : 'bg-background border border-border text-[#1A1A18] rounded-bl-[3px]'
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="px-3 py-2.5 bg-background border border-border rounded-[12px] rounded-bl-[3px]">
              <div className="flex gap-1.5 items-center h-3">
                <span className="w-1.5 h-1.5 bg-muted rounded-full animate-bounce [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 bg-muted rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 bg-muted rounded-full animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}

        {error && <p className="text-xs text-error text-center py-1">{error}</p>}
        <div ref={endRef} />
      </div>

      {/* Input bar */}
      <div className="border-t border-border bg-surface px-3 py-2.5 flex gap-2 flex-shrink-0">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
          }}
          placeholder={lang === 'fr' ? 'Posez une question…' : 'Ask a question…'}
          disabled={loading}
          className="flex-1 bg-background border border-border rounded-[8px] px-3 py-2 text-sm focus:outline-none focus:border-primary transition-colors placeholder:text-muted disabled:opacity-60"
        />
        <button
          onClick={() => sendMessage()}
          disabled={!input.trim() || loading}
          className="w-9 h-9 flex items-center justify-center bg-primary text-white rounded-[8px] disabled:opacity-40 active:scale-[0.95] transition-transform flex-shrink-0"
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  )
}
