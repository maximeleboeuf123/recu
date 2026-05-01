import { useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { Pencil, AlertTriangle, Info, Plus, ChevronDown, FileText, X } from 'lucide-react'
import RecurringFields from './RecurringFields'

const CURRENCIES = ['CAD', 'USD', 'EUR', 'GBP', 'CHF', 'MXN']

// mode: 'review' (confirm/skip) | 'ledger' (save/cancel)
export default function ReviewCard({ receipt, mode = 'review', onConfirm, onSkip, onDelete, onClose }) {
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
    label_category: receipt.labels?.category || '',
    label_property: receipt.labels?.property || '',
  })

  const [recurring, setRecurring] = useState(null)
  const [patternPrompt, setPatternPrompt] = useState(null)
  const [dirty, setDirty] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [viewingDoc, setViewingDoc] = useState(false)

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

  const buildData = () => {
    const { label_category, label_property, ...rest } = fields
    const data = { ...rest }
    for (const k of ['subtotal', 'gst', 'qst', 'hst', 'total']) {
      data[k] = data[k] !== '' ? parseFloat(data[k]) : null
    }
    data.labels = { category: label_category || null, property: label_property || null }
    return data
  }

  const handleConfirm = () => {
    onConfirm?.(receipt.id, buildData(), recurring, patternPrompt)
  }

  const handleSave = () => {
    if (!dirty) return onClose?.()
    onConfirm?.(receipt.id, buildData(), null, patternPrompt)
  }

  const gstCalculated = scores.gst_source === 'calculated'
  const qstCalculated = scores.qst_source === 'calculated'

  return (
    <div className="bg-surface border border-border rounded-[8px] overflow-hidden">
      {/* Document viewer — rendered via portal so it escapes any overflow-hidden parent */}
      {viewingDoc && receipt.drive_file_id && createPortal(
        <div className="fixed inset-0 bg-black z-[400] flex flex-col" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
          <div className="flex items-center justify-between px-4 py-3 bg-surface border-b border-border flex-shrink-0">
            <span className="text-sm font-medium text-[#1A1A18] truncate pr-4">
              {receipt.filename || fields.vendor || '—'}
            </span>
            <button
              onClick={() => setViewingDoc(false)}
              className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full hover:bg-background transition-colors"
            >
              <X size={20} className="text-muted" />
            </button>
          </div>
          <iframe
            src={`https://drive.google.com/file/d/${receipt.drive_file_id}/preview`}
            className="flex-1 w-full border-0"
            allow="autoplay"
            title="Receipt document"
          />
        </div>,
        document.body
      )}
      {/* Header */}
      <div className="flex items-start gap-3 p-4 border-b border-border bg-background/40">
        <button
          onClick={() => receipt.drive_file_id && setViewingDoc(true)}
          className={`w-12 h-16 flex-shrink-0 rounded-[4px] flex flex-col items-center justify-center gap-1 text-xs transition-colors ${
            receipt.drive_file_id
              ? 'bg-primary/10 text-primary hover:bg-primary/20 cursor-pointer'
              : 'bg-border/40 text-muted cursor-default'
          }`}
        >
          <FileText size={18} strokeWidth={1.5} />
          <span>{receipt.page_count || 1}p</span>
        </button>
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
          <span className="text-sm text-muted w-28 flex-shrink-0">Catégorie</span>
          <input
            value={fields.label_category}
            onChange={(e) => handleDimensionChange('label_category', e.target.value)}
            placeholder="—"
            className="flex-1 text-sm text-[#1A1A18] bg-transparent border-none focus:outline-none min-w-0"
          />
          <button
            className="w-6 h-6 flex items-center justify-center border border-border rounded-full text-muted hover:text-primary flex-shrink-0"
          >
            <Plus size={12} />
          </button>
        </div>
        <div className="px-4 py-2.5 flex items-center gap-2">
          <span className="text-sm text-muted w-28 flex-shrink-0">Propriété</span>
          <input
            value={fields.label_property}
            onChange={(e) => handleDimensionChange('label_property', e.target.value)}
            placeholder="—"
            className="flex-1 text-sm text-[#1A1A18] bg-transparent border-none focus:outline-none min-w-0"
          />
          <button
            className="w-6 h-6 flex items-center justify-center border border-border rounded-full text-muted hover:text-primary flex-shrink-0"
          >
            <Plus size={12} />
          </button>
        </div>
      </div>

      {/* Warnings */}
      <div className="px-4 py-2 space-y-1.5">
        {(!fields.total && !fields.vendor) && (
          <Warning text={t('review.extraction_warning')} />
        )}
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
      <div className="px-4 py-3 border-t border-border space-y-2">
        {mode === 'review' ? (
          <>
            <button
              onClick={handleConfirm}
              className="w-full py-2.5 text-sm bg-primary text-white rounded-[8px] font-medium active:scale-[0.98] transition-transform"
            >
              {t('review.confirm')}
            </button>
            {confirmingDelete ? (
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmingDelete(false)}
                  className="flex-1 py-2.5 text-sm text-muted border border-border rounded-[8px] font-medium active:scale-[0.98] transition-transform"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={() => onDelete?.(receipt.id)}
                  className="flex-1 py-2.5 text-sm text-error border border-error/40 bg-error/5 rounded-[8px] font-medium active:scale-[0.98] transition-transform"
                >
                  {t('review.delete_confirm')}
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => onSkip?.(receipt.id)}
                  className="flex-1 py-2.5 text-sm text-muted border border-border rounded-[8px] font-medium active:scale-[0.98] transition-transform"
                >
                  {t('review.later')}
                </button>
                <button
                  onClick={() => setConfirmingDelete(true)}
                  className="flex-1 py-2.5 text-sm text-error border border-error/30 rounded-[8px] font-medium active:scale-[0.98] transition-transform"
                >
                  {t('review.delete')}
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            {confirmingDelete ? (
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmingDelete(false)}
                  className="flex-1 py-2.5 text-sm text-muted border border-border rounded-[8px] font-medium active:scale-[0.98] transition-transform"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={() => onDelete?.(receipt.id)}
                  className="flex-1 py-2.5 text-sm text-error border border-error/40 bg-error/5 rounded-[8px] font-medium active:scale-[0.98] transition-transform"
                >
                  {t('review.delete_confirm')}
                </button>
              </div>
            ) : (
              <>
                <div className="flex gap-2">
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
                </div>
                <button
                  onClick={() => setConfirmingDelete(true)}
                  className="w-full py-2 text-sm text-error font-medium active:scale-[0.98] transition-transform"
                >
                  {t('review.delete')}
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
    </>
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
