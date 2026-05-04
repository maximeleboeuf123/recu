import { useState, useEffect } from 'react'
import { useParams, useNavigate, Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useShares } from '../hooks/useShares'

export default function SharedAccountPage() {
  const { shareId } = useParams()
  const { i18n } = useTranslation()
  const lang = i18n.language?.startsWith('fr') ? 'fr' : 'en'
  const navigate = useNavigate()
  const { received, loading: sharesLoading } = useShares()
  const [receipts, setReceipts] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)

  const share = received.find(s => s.id === shareId)

  useEffect(() => {
    if (!share) return
    setLoading(true)
    supabase
      .from('receipts')
      .select('*')
      .eq('user_id', share.owner_id)
      .contains('labels', { property: share.account_name })
      .neq('status', 'deleted')
      .order('invoice_date', { ascending: false, nullsFirst: false })
      .limit(500)
      .then(({ data }) => {
        setReceipts(data || [])
        setLoading(false)
      })
  }, [share?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (sharesLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!share) return <Navigate to="/" replace />

  const fmt = v => new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' }).format(v ?? 0)
  const confirmed = receipts.filter(r => r.status === 'confirmed')
  const pending = receipts.filter(r => r.status === 'pending')
  const total = confirmed.reduce((sum, r) => sum + (r.total ?? 0), 0)

  return (
    <div className="max-w-lg mx-auto px-4 py-6 pb-28 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => navigate('/')}
          className="p-1 -ml-1 text-muted hover:text-primary transition-colors"
        >
          <ChevronLeft size={20} />
        </button>
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-[#1A1A18] truncate">{share.account_name}</h1>
          <p className="text-xs text-muted truncate">
            {lang === 'fr' ? 'Partagé par' : 'Shared by'} {share.owner_email}
            {share.permission === 'view' && (
              <span className="ml-1.5 bg-border text-muted rounded px-1.5 py-0.5 text-[10px]">
                {lang === 'fr' ? 'Lecture seule' : 'View only'}
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Summary card */}
      <div className="bg-primary rounded-[12px] px-5 py-4 text-white shadow-sm">
        <p className="text-[11px] font-medium uppercase tracking-wide opacity-70">Total</p>
        <p className="text-3xl font-bold mt-1 tracking-tight">{fmt(total)}</p>
        <p className="text-xs opacity-70 mt-1">
          {confirmed.length} {lang === 'fr' ? `confirmé${confirmed.length !== 1 ? 's' : ''}` : `confirmed`}
          {pending.length > 0 && ` · ${pending.length} ${lang === 'fr' ? 'en attente' : 'pending'}`}
        </p>
      </div>

      {/* Receipt list */}
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : receipts.length === 0 ? (
        <p className="text-center text-sm text-muted py-8">
          {lang === 'fr' ? 'Aucun reçu pour ce compte.' : 'No receipts for this account.'}
        </p>
      ) : (
        <div className="space-y-2">
          {receipts.map(r => (
            <SharedReceiptRow
              key={r.id}
              receipt={r}
              lang={lang}
              expanded={expanded === r.id}
              onToggle={() => setExpanded(p => p === r.id ? null : r.id)}
              fmt={fmt}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function SharedReceiptRow({ receipt, lang, expanded, onToggle, fmt }) {
  const taxLines = [
    ['Subtotal', receipt.subtotal],
    ['TPS/GST', receipt.gst],
    ['TVQ/QST', receipt.qst],
    ['HST', receipt.hst],
  ].filter(([, v]) => v != null && v !== 0)

  return (
    <div className="bg-surface border border-border rounded-[8px] overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center px-4 py-3 gap-3 text-left hover:bg-background transition-colors active:scale-[0.99]"
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[#1A1A18] truncate">{receipt.vendor || '—'}</p>
          <p className="text-xs text-muted">
            {receipt.invoice_date || '—'}
            {receipt.labels?.category ? ` · ${receipt.labels.category}` : ''}
          </p>
        </div>
        <div className="text-right flex-shrink-0 mr-1">
          <p className="text-sm font-semibold text-[#1A1A18]">
            {receipt.total != null ? fmt(receipt.total) : '—'}
          </p>
          {receipt.status === 'pending' && (
            <span className="text-[10px] bg-warning/20 text-warning rounded px-1.5 py-0.5">
              {lang === 'fr' ? 'En attente' : 'Pending'}
            </span>
          )}
        </div>
        {expanded
          ? <ChevronUp size={14} className="text-muted flex-shrink-0" />
          : <ChevronDown size={14} className="text-muted flex-shrink-0" />}
      </button>

      {expanded && (
        <div className="border-t border-border px-4 py-3 space-y-2 bg-background/50">
          {receipt.description && (
            <p className="text-xs text-muted leading-snug">{receipt.description}</p>
          )}
          {taxLines.length > 0 && (
            <div className="space-y-1">
              {taxLines.map(([label, val]) => (
                <div key={label} className="flex justify-between text-xs">
                  <span className="text-muted">{label}</span>
                  <span className="text-[#1A1A18]">{fmt(val)}</span>
                </div>
              ))}
            </div>
          )}
          {(receipt.vendor_gst_number || receipt.vendor_qst_number) && (
            <div className="space-y-0.5 pt-1 border-t border-border">
              {receipt.vendor_gst_number && (
                <p className="text-xs text-muted">TPS: {receipt.vendor_gst_number}</p>
              )}
              {receipt.vendor_qst_number && (
                <p className="text-xs text-muted">TVQ: {receipt.vendor_qst_number}</p>
              )}
            </div>
          )}
          {receipt.drive_url && (
            <a
              href={receipt.drive_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-primary hover:underline pt-1"
            >
              <ExternalLink size={11} />
              {lang === 'fr' ? 'Voir le reçu original' : 'View original receipt'}
            </a>
          )}
        </div>
      )}
    </div>
  )
}
