import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, Link } from 'react-router-dom'
import { ChevronLeft, MessageSquare, RefreshCw } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

const ADMIN_EMAIL = 'admin@monrecu.app'

const STATUS_COLORS = {
  new: 'bg-accent/10 text-accent',
  read: 'bg-border text-muted',
  archived: 'bg-border/50 text-muted/60',
}

const TYPE_LABELS = { suggestion: '💡', bug: '🐛', other: '💬' }

export default function AdminPage() {
  const { session } = useAuth()
  const { i18n } = useTranslation()
  const lang = i18n.language?.startsWith('fr') ? 'fr' : 'en'

  const [tab, setTab] = useState('feedback')
  const [feedback, setFeedback] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  if (session?.user?.email !== ADMIN_EMAIL) return <Navigate to="/" replace />

  const fetchFeedback = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/feedback', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (res.ok) setFeedback(await res.json())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchFeedback() }, [])

  const updateStatus = async (id, status) => {
    setFeedback(prev => prev.map(f => f.id === id ? { ...f, status } : f))
    await fetch('/api/feedback', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ id, status }),
    })
  }

  const shown = feedback.filter(f => filter === 'all' || f.status === filter)
  const newCount = feedback.filter(f => f.status === 'new').length

  const TABS = [
    { key: 'feedback', label: 'Feedback', icon: MessageSquare, badge: newCount },
    // more tabs here as the admin section grows
  ]

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-28 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Link to="/settings" className="p-1 -ml-1 text-muted hover:text-primary transition-colors">
          <ChevronLeft size={20} />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-[#1A1A18]">Admin</h1>
          <p className="text-xs text-muted">{ADMIN_EMAIL}</p>
        </div>
        <button onClick={fetchFeedback} className="p-2 text-muted hover:text-primary transition-colors" title="Refresh">
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-background rounded-[8px] p-1 border border-border">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium rounded-[6px] transition-colors ${
              tab === t.key ? 'bg-surface text-[#1A1A18] shadow-sm' : 'text-muted hover:text-[#1A1A18]'
            }`}
          >
            <t.icon size={14} />
            {t.label}
            {t.badge > 0 && (
              <span className="bg-accent text-white text-[10px] font-bold rounded-full min-w-[16px] h-[16px] flex items-center justify-center px-1">
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Feedback tab */}
      {tab === 'feedback' && (
        <div className="space-y-4">
          {/* Filter strip */}
          <div className="flex gap-2 overflow-x-auto pb-0.5">
            {['all', 'new', 'read', 'archived'].map(s => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`flex-shrink-0 px-3 py-1 text-xs rounded-full border font-medium transition-colors ${
                  filter === s ? 'bg-primary text-white border-primary' : 'border-border text-muted hover:border-primary hover:text-primary'
                }`}
              >
                {s === 'all' ? `All (${feedback.length})` : `${s.charAt(0).toUpperCase() + s.slice(1)} (${feedback.filter(f => f.status === s).length})`}
              </button>
            ))}
          </div>

          {loading ? (
            <p className="text-sm text-muted text-center py-8">Loading…</p>
          ) : shown.length === 0 ? (
            <p className="text-sm text-muted text-center py-8">No feedback yet 🎉</p>
          ) : (
            <div className="space-y-3">
              {shown.map(f => (
                <div key={f.id} className={`bg-surface border rounded-[10px] p-4 space-y-2 ${f.status === 'new' ? 'border-accent/30' : 'border-border'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-base">{TYPE_LABELS[f.type] || '💬'}</span>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-[#1A1A18] truncate">{f.user_email || 'Anonymous'}</p>
                        <p className="text-[10px] text-muted">{new Date(f.created_at).toLocaleDateString(lang === 'fr' ? 'fr-CA' : 'en-CA', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                    </div>
                    <span className={`flex-shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[f.status]}`}>
                      {f.status}
                    </span>
                  </div>

                  <p className="text-sm text-[#1A1A18] leading-relaxed whitespace-pre-wrap">{f.message}</p>

                  <div className="flex gap-2 pt-1">
                    {f.status !== 'read' && (
                      <button onClick={() => updateStatus(f.id, 'read')} className="text-[11px] text-muted hover:text-primary transition-colors">
                        Mark read
                      </button>
                    )}
                    {f.status !== 'archived' && (
                      <button onClick={() => updateStatus(f.id, 'archived')} className="text-[11px] text-muted hover:text-error transition-colors">
                        Archive
                      </button>
                    )}
                    {f.status === 'archived' && (
                      <button onClick={() => updateStatus(f.id, 'read')} className="text-[11px] text-muted hover:text-primary transition-colors">
                        Unarchive
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
