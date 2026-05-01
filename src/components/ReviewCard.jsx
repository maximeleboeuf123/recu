import { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Pencil, AlertTriangle, Info, Plus, ChevronDown } from 'lucide-react'
import RecurringFields from './RecurringFields'

const CURRENCIES = ['CAD', 'USD', 'EUR', 'GBP', 'CHF', 'MXN']

// mode: 'review' (confirm/skip) | 'ledger' (save/cancel)
export default function ReviewCard({ receipt, mode = 'review', onConfirm, onSkip, onClose }) {
  const { t } = useTranslation()
  const scores = receipt.confidence_scores || {}
  const conf = receipt.extracted_raw?.confidence || {}

  const [fields, setFields] = useState({
    vendor: receipt.vendor || '',
    invoice_date: receipt.invoice_date || '',
    invoice_number: receipt.invoice_number || '',
    description: receipt.description || '',
    subtotal: receipt.subtotal ?? '',
    gst: receipt.gst ?? '',
    qst: receipt.qst ?? '',
    hst: receipt.hst ?? '',
    total: receipt.total ?? '',
    currency: receipt.currency || 'CAD',
    vendor_gst_number: receipt.vendor_gst_number || '',
    vendor_qst_number: receipt.vendor_qst_number || '',
    dimension_category: receipt.dimension_category || '',
    dimension_property: receipt.dimension_property || '',
  })

  const [recurring, setRecurring] = useState(null)
  const [patternPrompt, setPatternPrompt] = useState(null) // { field, vendor, value }
  const [dirty, setDirty] = useState(false)

  const set = (key, val) => {
    setFields((prev) => ({ ...prev, [key]: val }))
    setDirty(true)
  }

  const handleDimensionChange = (field, val) => {
    set(field, val)
    if (receipt.vendor && val) {
      setPatternPrompt({ field, vendor: fields.vendor || receipt.vendor, value: val })
    }
  }

  const handleConfirm = () => {
    const data = { ...fields }
    // Coerce numeric fields
    for (const k of ['subtotal', 'gst', 'qst', 'hst', 'total']) {
      data[k] = data[k] !== '' ? parseFloat(data[k]) : null
    }
    onConfirm?.(receipt.id, data, recurring, patternPrompt)
  }

  const handleSave = () => {
    if (!dirty) return onClose?.()
    const data = { ...fields }
    for (const k of ['subtotal', 'gst', 'qst', 'hst', 'total']) {
      data[k] = data[k] !== '' ? parseFloat(data[k]) : null
    }
    onConfirm?.(receipt.id, data, null, patternPrompt)
  }

  const gstCalculated = scores.gst_source === 'calculated'
  const qstCalculated = scores.qst_source === 'calculated'

  return (
    <div className="bg-surface border border-border rounded-[8px] overflow-hidden">
      {/* Header */}
      <div className="flex items-start gap-3 p-4 border-b border-border bg-background/40">
        <div className="w-12 h-16 flex-shrink-0 bg-border/40 rounded-[4px] flex items-center justify-center text-xs text-muted">
          {receipt.page_count || 1}p
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-[#1A1A18] truncate">{fields.vendor || '—'}</p>
          <p className="text-sm text-muted mt-0.5">
            {fields.invoice_date || '—'}
            {fields.invoice_number ? ` · ${fields.invoice_number}` : ''}
          </p>
        </div>
        <p className="text-lg font-bold text-[#1A1A18] flex-shrink-0">
          {fields.total != null && fields.total !== ''
            ? new Intl.NumberFormat('fr-CA', { style: 'currency', currency: fields.currency || 'CAD' }).format(fields.total)
            : '—'}
        </p>
      </div>

      {/* Duplicate warning */}
      {receipt.possibleDuplicate && (
        <div className="flex items-start gap-2 px-4 py-2 bg-warning/10 border-b border-warning/30">
          <AlertTriangle size={14} className="text-warning flex-shrink-0 mt-0.5" />
          <p className="text-xs text-warning">
            ⚠ Possible doublon — reçu similaire déjà confirmé le {receipt.possibleDuplicate.invoice_date}
          </p>
        </div>
      )}

      {/* Fields */}
      <div className="divide-y divide-border/60">
        <EditRow label={t('receipt.vendor') || 'Fournisseur'} value={fields.vendor} onSave={(v) => set('vendor', v)} />
        <EditRow label={t('receipt.date') || 'Date facture'} value={fields.invoice_date} onSave={(v) => set('invoice_date', v)} type="date" />
        <EditRow label={t('receipt.invoice_number') || 'No. facture'} value={fields.invoice_number} onSave={(v) => set('invoice_number', v)} />
        <EditRow label={t('receipt.description') || 'Description'} value={fields.description} onSave={(v) => set('description', v)} />
        <EditRow label={t('receipt.subtotal') || 'Sous-total'} value={fields.subtotal} onSave={(v) => set('subtotal', v)} type="number" />
        <EditRow
          label="TPS / GST"
          value={fields.gst}
          onSave={(v) => set('gst', v)}
          type="number"
          badge={gstCalculated ? t('review.calculated') : null}
          lowConfidence={conf.total === 'low'}
        />
        <EditRow
          label="TVQ / QST"
          value={fields.qst}
          onSave={(v) => set('qst', v)}
          type="number"
          badge={qstCalculated ? t('review.calculated') : null}
        />
        {(fields.hst !== '' && fields.hst != null) && (
          <EditRow label="HST" value={fields.hst} onSave={(v) => set('hst', v)} type="number" />
        )}
        <EditRow
          label={t('receipt.total') || 'Total'}
          value={fields.total}
          onSave={(v) => set('total', v)}
          type="number"
          lowConfidence={conf.total === 'low'}
        />

        {/* Currency */}
        <div className="flex items-center justify-between px-4 py-2.5">
          <span className="text-sm text-muted w-28 flex-shrink-0">{t('receipt.currency') || 'Devise'}</span>
          <select
            value={fields.currency}
            onChange={(e) => set('currency', e.target.value)}
            className="text-sm text-[#1A1A18] bg-transparent border-none focus:outline-none cursor-pointer"
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* Vendor numbers */}
        <EditRow label="No. TPS" value={fields.vendor_gst_number} onSave={(v) => set('vendor_gst_number', v)} />
        <EditRow label="No. TVQ" value={fields.vendor_qst_number} onSave={(v) => set('vendor_qst_number', v)} />

        {/* Dimensions */}
        <div className="px-4 py-2.5 flex items-center gap-2">
          <span className="text-sm text-muted w-28 flex-shrink-0">{t('settings.dimensions') || 'Catégorie'}</span>
          <input
            value={fields.dimension_category}
            onChange={(e) => handleDimensionChange('dimension_category', e.target.value)}
            placeholder="—"
            className="flex-1 text-sm text-[#1A1A18] bg-transparent border-none focus:outline-none min-w-0"
          />
          <button
            onClick={() => {/* Session 5: open dimension sheet */}}
            className="w-6 h-6 flex items-center justify-center border border-border rounded-full text-muted hover:text-primary flex-shrink-0"
          >
            <Plus size={12} />
          </button>
        </div>
        <div className="px-4 py-2.5 flex items-center gap-2">
          <span className="text-sm text-muted w-28 flex-shrink-0">{t('settings.dimensions') === 'Mes dimensions' ? 'Propriété' : 'Property'}</span>
          <input
            value={fields.dimension_property}
            onChange={(e) => handleDimensionChange('dimension_property', e.target.value)}
            placeholder="—"
            className="flex-1 text-sm text-[#1A1A18] bg-transparent border-none focus:outline-none min-w-0"
          />
          <button
            onClick={() => {}}
            className="w-6 h-6 flex items-center justify-center border border-border rounded-full text-muted hover:text-primary flex-shrink-0"
          >
            <Plus size={12} />
          </button>
        </div>
      </div>

      {/* Warnings */}
      <div className="px-4 py-2 space-y-1.5">
        {gstCalculated && (
          <Warning text="TPS calculée automatiquement (sous-total × 5%)" />
        )}
        {qstCalculated && (
          <Warning text={`TVQ calculée automatiquement (sous-total × 9.975%)`} />
        )}
        {conf.invoice_date === 'low' && (
          <Warning text={t('review.low_confidence') + ' — date'} />
        )}
        {conf.vendor === 'low' && (
          <Warning text={t('review.low_confidence') + ' — fournisseur'} />
        )}
        {receipt.patternApplied && (
          <InfoBadge text={t('review.pattern_applied')} />
        )}
      </div>

      {/* Pattern prompt */}
      {patternPrompt && (
        <div className="mx-4 mb-3 p-3 bg-primary/5 border border-primary/20 rounded-[6px] flex items-center justify-between gap-3">
          <p className="text-xs text-[#1A1A18]">
            {t('review.always_assign', { vendor: patternPrompt.vendor, value: patternPrompt.value })}
          </p>
          <div className="flex gap-2 flex-shrink-0">
            <button onClick={() => setPatternPrompt(null)} className="text-xs text-muted px-2 py-1">Non</button>
            <button className="text-xs text-primary font-medium px-2 py-1">Oui</button>
          </div>
        </div>
      )}

      {/* Recurring (review mode only) */}
      {mode === 'review' && (
        <div className="px-4 pb-2">
          <RecurringFields value={recurring} onChange={setRecurring} />
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 px-4 py-3 border-t border-border">
        {mode === 'review' ? (
          <>
            <button
              onClick={() => onSkip?.(receipt.id)}
              className="flex-1 py-2.5 text-sm text-muted border border-border rounded-[8px] font-medium active:scale-[0.98] transition-transform"
            >
              {t('review.skip') || 'Ignorer'}
            </button>
            <button
              onClick={handleConfirm}
              className="flex-1 py-2.5 text-sm bg-primary text-white rounded-[8px] font-medium active:scale-[0.98] transition-transform"
            >
              {t('review.confirm') || 'Confirmer'}
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => onClose?.()}
              className="flex-1 py-2.5 text-sm text-muted border border-border rounded-[8px] font-medium active:scale-[0.98] transition-transform"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleSave}
              disabled={!dirty}
              className="flex-1 py-2.5 text-sm bg-primary text-white rounded-[8px] font-medium active:scale-[0.98] transition-transform disabled:opacity-40"
            >
              {t('common.save')}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function EditRow({ label, value, onSave, type = 'text', badge, lowConfidence }) {
  const [editing, setEditing] = useState(false)
  const [local, setLocal] = useState(value ?? '')
  const inputRef = useRef(null)

  const commit = () => {
    setEditing(false)
    if (local !== (value ?? '')) onSave(local)
  }

  // Sync if parent value changes
  if (!editing && local !== (value ?? '')) {
    setLocal(value ?? '')
  }

  return (
    <div
      className={`flex items-center justify-between px-4 py-2.5 gap-3 ${lowConfidence ? 'bg-warning/5' : ''}`}
      onClick={() => { if (!editing) { setEditing(true); setTimeout(() => inputRef.current?.focus(), 0) } }}
    >
      <span className="text-sm text-muted w-28 flex-shrink-0 leading-snug">{label}</span>
      <div className="flex-1 flex items-center gap-1.5 min-w-0">
        {editing ? (
          <input
            ref={inputRef}
            type={type}
            value={local}
            onChange={(e) => setLocal(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => e.key === 'Enter' && commit()}
            className="flex-1 text-sm text-[#1A1A18] bg-background border border-primary rounded-[4px] px-2 py-0.5 focus:outline-none min-w-0"
            autoFocus
          />
        ) : (
          <span className={`text-sm flex-1 truncate ${value != null && value !== '' ? 'text-[#1A1A18]' : 'text-muted'}`}>
            {value != null && value !== '' ? String(value) : '—'}
          </span>
        )}
        {badge && (
          <span className="text-[10px] bg-muted/20 text-muted rounded px-1 flex-shrink-0">{badge}</span>
        )}
        {lowConfidence && !editing && (
          <AlertTriangle size={12} className="text-warning flex-shrink-0" />
        )}
        {!editing && (
          <Pencil size={11} className="text-border flex-shrink-0" />
        )}
      </div>
    </div>
  )
}

function Warning({ text }) {
  return (
    <div className="flex items-start gap-1.5">
      <AlertTriangle size={12} className="text-warning flex-shrink-0 mt-0.5" />
      <p className="text-xs text-warning">{text}</p>
    </div>
  )
}

function InfoBadge({ text }) {
  return (
    <div className="flex items-start gap-1.5">
      <Info size={12} className="text-primary flex-shrink-0 mt-0.5" />
      <p className="text-xs text-primary">{text}</p>
    </div>
  )
}
