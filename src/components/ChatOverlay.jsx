import { useState, useRef, useEffect } from 'react'
import { X, Send, Mail, Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../hooks/useAuth'

const PROMPTS = {
  en: [
    { id: 'explain',   text: 'How does Récu work?' },
    { id: 'efficient', text: 'How can Récu make me more efficient?' },
    { id: 'start',     text: 'Guide me through getting started' },
  ],
  fr: [
    { id: 'explain',   text: 'Comment fonctionne Récu ?' },
    { id: 'efficient', text: 'Comment Récu peut m\'aider à être plus efficace ?' },
    { id: 'start',     text: 'Guide-moi pour démarrer étape par étape' },
  ],
}

function TypingIndicator() {
  return (
    <div className="flex justify-start items-end gap-2">
      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
        <Sparkles size={12} className="text-primary" />
      </div>
      <div className="px-4 py-3 bg-surface border border-border rounded-[16px] rounded-bl-[4px]">
        <div className="flex gap-1.5 items-center h-3">
          <span className="w-1.5 h-1.5 bg-muted rounded-full animate-bounce [animation-delay:0ms]" />
          <span className="w-1.5 h-1.5 bg-muted rounded-full animate-bounce [animation-delay:150ms]" />
          <span className="w-1.5 h-1.5 bg-muted rounded-full animate-bounce [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  )
}

export default function ChatOverlay({ onClose, initialPrompt }) {
  const { i18n } = useTranslation()
  const { session } = useAuth()
  const lang = i18n.language?.startsWith('fr') ? 'fr' : 'en'

  const [messages, setMessages] = useState([])
  const [suggestions, setSuggestions] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const endRef = useRef(null)
  const inputRef = useRef(null)
  const didInit = useRef(false)

  const prompts = PROMPTS[lang]

  // Wait for session to load before auto-sending the initial prompt
  useEffect(() => {
    if (initialPrompt && session && !didInit.current) {
      didInit.current = true
      sendMessage(initialPrompt)
    }
  }, [session]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const sendMessage = async (text) => {
    const content = (typeof text === 'string' ? text : input).trim()
    if (!content || loading || !session?.access_token) return

    setInput('')
    setSuggestions([])
    setError(null)

    const next = [...messages, { role: 'user', content }]
    setMessages(next)
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          messages: next.map((m) => ({ role: m.role, content: m.content })),
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.reply) throw new Error(data.error || 'chat_failed')
      setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }])
      if (data.suggestions?.length) setSuggestions(data.suggestions)
    } catch {
      setError(lang === 'fr' ? 'Une erreur est survenue. Réessayez.' : 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }

  const handleEmailContact = () => {
    const subject = encodeURIComponent('Support — Récu')
    const body = encodeURIComponent('Bonjour / Hi,\n\nJ\'ai besoin d\'aide avec Récu.\n[Décrivez votre question / describe your question here]\n\n---\nSent from the Récu app')
    window.open(`mailto:hello@recu.app?subject=${subject}&body=${body}`)
  }

  const isEmpty = messages.length === 0 && !loading

  return (
    <div
      className="fixed inset-x-0 top-0 bg-background z-[200] flex flex-col"
      style={{ height: '100dvh', paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-surface flex-shrink-0">
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Sparkles size={15} className="text-primary" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-[#1A1A18]">Récu Assistant</p>
          <p className="text-[11px] text-muted leading-tight">
            {lang === 'fr' ? 'Posez vos questions sur Récu' : 'Ask anything about Récu'}
          </p>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-background transition-colors flex-shrink-0"
        >
          <X size={20} className="text-muted" />
        </button>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">
        {isEmpty && (
          <div className="flex flex-col items-center justify-center min-h-full gap-5 text-center py-4">
            {/* Brand mark */}
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shadow-sm ring-1 ring-primary/10">
              <Sparkles size={32} className="text-primary" />
            </div>

            {/* Welcome copy */}
            <div className="space-y-2 px-2">
              <h2 className="text-xl font-bold text-[#1A1A18]">
                {lang === 'fr' ? 'Bonjour ! Je suis votre assistant Récu.' : 'Hi there! I\'m your Récu assistant.'}
              </h2>
              <p className="text-sm text-muted leading-relaxed">
                {lang === 'fr'
                  ? 'Je peux vous expliquer comment Récu fonctionne, vous aider à démarrer et répondre à toutes vos questions sur la gestion de vos reçus.'
                  : 'I can explain how Récu works, walk you through setup, and answer any questions about managing your receipts for taxes or accounting.'}
              </p>
            </div>

            {/* Quick prompts */}
            <div className="w-full space-y-2 text-left">
              {prompts.map((p) => (
                <button
                  key={p.id}
                  onClick={() => sendMessage(p.text)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 bg-surface border border-border rounded-[10px] hover:border-primary/40 hover:bg-primary/5 transition-colors active:scale-[0.99] group"
                >
                  <span className="flex-1 text-sm font-medium text-[#1A1A18] text-left">{p.text}</span>
                  <Send size={14} className="text-muted group-hover:text-primary transition-colors flex-shrink-0" />
                </button>
              ))}
            </div>

            <p className="text-xs text-muted">
              {lang === 'fr' ? 'Ou posez votre propre question ci-dessous' : 'Or type your own question below'}
            </p>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex items-end gap-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {m.role === 'assistant' && (
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mb-0.5">
                <Sparkles size={11} className="text-primary" />
              </div>
            )}
            <div
              className={`max-w-[82%] px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                m.role === 'user'
                  ? 'bg-primary text-white rounded-[16px] rounded-br-[4px]'
                  : 'bg-surface border border-border text-[#1A1A18] rounded-[16px] rounded-bl-[4px]'
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}

        {loading && <TypingIndicator />}

        {/* Suggestion chips after last assistant message */}
        {!loading && suggestions.length > 0 && (
          <div className="flex flex-wrap gap-2 pl-8">
            {suggestions.map((s, i) => (
              <button
                key={i}
                onClick={() => sendMessage(s)}
                className="px-3 py-1.5 bg-primary/10 text-primary border border-primary/20 rounded-full text-xs font-medium hover:bg-primary/20 transition-colors active:scale-[0.97]"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {error && (
          <p className="text-xs text-error text-center py-1">{error}</p>
        )}

        <div ref={endRef} />
      </div>

      {/* Input bar */}
      <div
        className="border-t border-border bg-surface px-4 pt-3 flex-shrink-0 space-y-2"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 16px)' }}
      >
        {messages.length > 0 && (
          <button
            onClick={handleEmailContact}
            className="w-full flex items-center justify-center gap-1.5 text-xs text-muted hover:text-primary transition-colors py-1"
          >
            <Mail size={12} />
            {lang === 'fr' ? 'Parler à un humain → hello@recu.app' : 'Talk to a human → hello@recu.app'}
          </button>
        )}
        <div className="flex gap-2">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
            }}
            placeholder={lang === 'fr' ? 'Posez votre question…' : 'Ask a question…'}
            disabled={loading}
            className="flex-1 bg-background border border-border rounded-[8px] px-4 py-2.5 text-sm focus:outline-none focus:border-primary transition-colors text-[#1A1A18] placeholder:text-muted disabled:opacity-60"
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || loading}
            className="w-10 h-10 flex items-center justify-center bg-primary text-white rounded-[8px] disabled:opacity-40 active:scale-[0.95] transition-transform flex-shrink-0"
          >
            <Send size={15} />
          </button>
        </div>
      </div>
    </div>
  )
}
