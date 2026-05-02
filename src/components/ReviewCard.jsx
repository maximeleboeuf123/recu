import { useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Pencil, AlertTriangle, Info, Plus, ChevronDown, FileText, X, Settings, Check } from 'lucide-react'
import RecurringFields from './RecurringFields'
import { useDimensions } from '../context/DimensionsContext'

const CURRENCIES = ['CAD', 'USD', 'EUR', 'GBP', 'CHF', 'MXN']

// mode: 'review' (confirm/skip) | 'ledger' (save/cancel)
export default function ReviewCard({ receipt, mode = 'review', onConfirm, onSkip, onDelete, onClose }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language === 'en' ? 'en' : 'fr'
  const { accountsWithCategories } = useDimensions()
  const scores = receipt.confidence_scores || {}
  const conf = receipt.extracted_raw?.confidence || {}

  // Computed before useState so they can inform initial field values
  const gstCalculated = scores.gst_source === 'calculated'
  const qstCalculated = scores.qst_source === 'calculated'

  // For confirmed receipts the user already approved whatever taxes are stored — keep them.
  // For pending receipts, AI-calculated taxes count as "not found" so the user decides.
  const isPending = receipt.status !== 'confirmed'
  const hasGstQstExtracted = !isPending || (
    (receipt.gst != null && parseFloat(receipt.gst) !== 0 && !gstCalculated) ||
    (receipt.qst != null && parseFloat(receipt.qst) !== 0 && !qstCalculated)
  )
  const hasHstExtracted = !isPending || (receipt.hst != null && parseFloat(receipt.hst) !== 0)
  // Show checkboxes only when no taxes were actually on the receipt
  const showTaxCheckboxes = isPending && !hasGstQstExtracted && !hasHstExtracted

  const [fields, setFields] = useState({
    vendor: receipt.vendor || '',
    invoice_date: receipt.invoice_date || '',
    invoice_number: receipt.invoice_number || '',
    description: receipt.description || '',
    subtotal: receipt.subtotal ?? '',
    // Don't pre-fill AI-calculated taxes for pending receipts — the checkbox decides
    gst: (isPending && gstCalculated) ? '' : (receipt.gst ?? ''),
    qst: (isPending && qstCalculated) ? '' : (receipt.qst ?? ''),
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
  const [editingName, setEditingName] = useState(false)
  const nameInputRef = useRef(null)
  // null = no taxes applied, 'gstqst' = Quebec taxes, 'hst' = Ontario/Atlantic HST
  const [taxMode, setTaxMode] = useState(null)

  const set = (key, val) => {
    setFields((prev) => ({ ...prev, [key]: val }))
    setDirty(true)
  }

  const handleTaxMode = (mode) => {
    const next = taxMode === mode ? null : mode
    setTaxMode(next)
    setDirty(true)
    if (next === 'gstqst') {
      const sub = parseFloat(fields.subtotal)
      let gst = '', qst = ''
      if (!isNaN(sub) && sub > 0) {
        gst = parseFloat((sub * 0.05).toFixed(2))
        qst = parseFloat((sub * 0.09975).toFixed(2))
      } else {
        const tot = parseFloat(fields.total)
        if (!isNaN(tot) && tot > 0) {
          const impliedSub = tot / 1.14975
          gst = parseFloat((impliedSub * 0.05).toFixed(2))
          qst = parseFloat((impliedSub * 0.09975).toFixed(2))
        }
      }
      setFields((prev) => ({ ...prev, gst, qst, hst: '' }))
    } else if (next === 'hst') {
      const sub = parseFloat(fields.subtotal)
      let hst = ''
      if (!isNaN(sub) && sub > 0) {
        hst = parseFloat((sub * 0.13).toFixed(2))
      } else {
        const tot = parseFloat(fields.total)
        if (!isNaN(tot) && tot > 0) {
          hst = parseFloat(((tot / 1.13) * 0.13).toFixed(2))
        }
      }
      setFields((prev) => ({ ...prev, hst, gst: '', qst: '' }))
    } else {
      setFields((prev) => ({ ...prev, gst: '', qst: '', hst: '' }))
    }
  }

  const handleDimensionChange = (field, val) => {
    set(field, val)
    if (field === 'label_property') {
      // Clear category if it doesn't exist under the newly selected account
      const acc = accountsWithCategories.find((a) => a.name === val)
      if (acc && fields.label_category && !acc.categories.some((c) => c.name === fields.label_category)) {
        set('label_category', '')
      }
    }
    if (val) {
      setPatternPrompt({ field, vendor: fields.vendor || receipt.vendor, value: val })
    }
  }

  const selectedAccount = accountsWithCategories.find((a) => a.name === fields.label_property)
  const accountNames = accountsWithCategories.map((a) => a.name)
  const categoryOptions = selectedAccount
    ? selectedAccount.categories.map((c) => c.name)
    : accountsWithCategories.flatMap((a) => a.categories.map((c) => c.name))

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
          {editingName ? (
            <input
              ref={nameInputRef}
              className="font-semibold text-[#1A1A18] bg-transparent border-b border-primary focus:outline-none w-full truncate"
              value={fields.vendor}
              onChange={(e) => set('vendor', e.target.value)}
              onBlur={() => setEditingName(false)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') setEditingName(false) }}
              autoFocus
            />
          ) : (
            <p
              className="font-semibold text-[#1A1A18] truncate cursor-pointer flex items-center gap-1.5 group"
              onClick={() => { setEditingName(true) }}
            >
              <span className="truncate">{fields.vendor || <span className="text-muted font-normal">—</span>}</span>
              <Pencil size={11} className="text-border flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
            </p>
          )}
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

      {/* Inline preview — visible by default in review mode */}
      {mode === 'review' && receipt.drive_file_id && (
        <div className="border-b border-border bg-black/5">
          <iframe
            src={`https://drive.google.com/file/d/${receipt.drive_file_id}/preview`}
            className="w-full border-0"
            style={{ height: '220px' }}
            allow="autoplay"
            title="Receipt preview"
          />
        </div>
      )}

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
        <EditRow label={t('receipt.vendor')} value={fields.vendor} onSave={(v) => set('vendor', v)} />
        <EditRow label={t('receipt.date')} value={fields.invoice_date} onSave={(v) => set('invoice_date', v)} type="date" />
        <EditRow label={t('receipt.invoice_number')} value={fields.invoice_number} onSave={(v) => set('invoice_number', v)} />
        <EditRow label={t('receipt.description')} value={fields.description} onSave={(v) => set('description', v)} />

        {/* Dimensions — Account & Category */}
        <DimensionRow label={t('receipt.account')} value={fields.label_property} onChange={(v) => handleDimensionChange('label_property', v)} options={accountNames} />
        <DimensionRow label={t('receipt.category')} value={fields.label_category} onChange={(v) => handleDimensionChange('label_category', v)} options={categoryOptions} dimmed={accountsWithCategories.length > 0 && !fields.label_property} />

        <EditRow
          label={t('receipt.total')}
          value={fields.total}
          onSave={(v) => set('total', v)}
          type="number"
          lowConfidence={conf.total === 'low'}
        />
        <EditRow label={t('receipt.subtotal')} value={fields.subtotal} onSave={(v) => set('subtotal', v)} type="number" />

        {/* Tax calculation helpers — shown when no taxes were on the receipt */}
        {showTaxCheckboxes && (
          <div className="px-4 py-2.5 space-y-2 bg-background/60">
            <p className="text-[10px] text-muted uppercase tracking-wide font-medium">
              {lang === 'en' ? 'Calculate taxes' : 'Calculer les taxes'}
            </p>
            <TaxCheckboxRow
              label="TPS/GST 5% + TVQ/QST 9.975%"
              hint={lang === 'en' ? 'Quebec' : 'Québec'}
              checked={taxMode === 'gstqst'}
              onToggle={() => handleTaxMode('gstqst')}
            />
            <TaxCheckboxRow
              label="HST 13%"
              hint={lang === 'en' ? 'Ontario & Atlantic provinces' : 'Ontario & provinces atlantiques'}
              checked={taxMode === 'hst'}
              onToggle={() => handleTaxMode('hst')}
            />
          </div>
        )}

        <EditRow
          label="TPS / GST"
          value={fields.gst}
          onSave={(v) => set('gst', v)}
          type="number"
          badge={gstCalculated && !showTaxCheckboxes ? t('review.calculated') : null}
          lowConfidence={conf.total === 'low'}
        />
        <EditRow
          label="TVQ / QST"
          value={fields.qst}
          onSave={(v) => set('qst', v)}
          type="number"
          badge={qstCalculated && !showTaxCheckboxes ? t('review.calculated') : null}
        />
        <EditRow label="HST" value={fields.hst} onSave={(v) => set('hst', v)} type="number" />

        {/* Currency */}
        <div className="flex items-center justify-between px-4 py-2.5">
          <span className="text-sm text-muted w-28 flex-shrink-0">{t('receipt.currency')}</span>
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
          <Warning text="TVQ calculée automatiquement (sous-total × 9.975%)" />
        )}
        {taxMode === 'gstqst' && (
          <Warning text={lang === 'en'
            ? 'TPS/GST and TVQ/QST calculated — verify before filing'
            : 'TPS/TVQ calculées — vérifiez avant de déclarer'} />
        )}
        {taxMode === 'hst' && (
          <Warning text={lang === 'en'
            ? 'HST calculated at 13% — confirm the rate for your province'
            : 'HST calculé à 13 % — confirmez le taux selon votre province'} />
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
              <div className="space-y-2">
                {receipt.drive_file_id && (
                  <p className="text-xs text-error/80 text-center px-2">{t('drive.delete_warning')}</p>
                )}
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
              <div className="space-y-2">
                {receipt.drive_file_id && (
                  <p className="text-xs text-error/80 text-center px-2">{t('drive.delete_warning')}</p>
                )}
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
                  {receipt.status === 'pending' ? (
                    <button
                      onClick={() => onConfirm?.(receipt.id, buildData(), null, patternPrompt)}
                      className="flex-1 py-2.5 text-sm bg-primary text-white rounded-[8px] font-medium active:scale-[0.98] transition-transform"
                    >
                      {t('ledger.approve')}
                    </button>
                  ) : (
                    <button
                      onClick={handleSave}
                      disabled={!dirty}
                      className="flex-1 py-2.5 text-sm bg-primary text-white rounded-[8px] font-medium active:scale-[0.98] transition-transform disabled:opacity-40"
                    >
                      {t('common.save')}
                    </button>
                  )}
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

function DimensionRow({ label, value, onChange, options = [], dimmed = false }) {
  const { i18n } = useTranslation()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [localVal, setLocalVal] = useState(value)
  const lang = i18n.language === 'en' ? 'en' : 'fr'

  if (!open && localVal !== value) setLocalVal(value)

  const filtered = options.filter(
    (o) => !localVal || o.toLowerCase().includes(localVal.toLowerCase())
  )
  const showDropdown = open && (filtered.length > 0 || options.length === 0)

  const commit = (val) => { onChange(val); setLocalVal(val); setOpen(false) }

  return (
    <div>
      <div className={`px-4 py-2.5 flex items-center gap-2 ${dimmed ? 'opacity-40' : ''}`}>
        <span className="text-sm text-muted w-28 flex-shrink-0">{label}</span>
        <input
          value={localVal}
          onChange={(e) => { setLocalVal(e.target.value); onChange(e.target.value) }}
          onFocus={() => !dimmed && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={dimmed ? (lang === 'en' ? 'Select account first' : 'Choisir un compte d\'abord') : '—'}
          readOnly={dimmed}
          className="flex-1 text-sm text-[#1A1A18] bg-transparent border-none focus:outline-none min-w-0"
        />
        {!dimmed && localVal ? (
          <button onMouseDown={() => commit('')} className="flex-shrink-0 text-muted hover:text-error transition-colors">
            <X size={12} />
          </button>
        ) : (
          <ChevronDown size={12} className="text-border flex-shrink-0" />
        )}
      </div>
      {showDropdown && (
        <div className="border-t border-border/60 bg-background/60">
          {filtered.map((opt) => (
            <button
              key={opt}
              onMouseDown={() => commit(opt)}
              className={`w-full text-left px-4 py-2 text-sm border-b border-border/40 last:border-0 transition-colors ${
                opt === localVal ? 'text-primary font-medium bg-primary/5' : 'text-[#1A1A18] hover:bg-surface'
              }`}
            >
              {opt}
            </button>
          ))}
          {options.length === 0 && (
            <p className="px-4 py-2 text-xs text-muted italic">
              {lang === 'en' ? 'No options yet' : 'Aucune option'}
            </p>
          )}
          <button
            onMouseDown={() => navigate('/dimensions')}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-primary border-t border-border hover:bg-primary/5 transition-colors"
          >
            <Settings size={11} />
            {lang === 'en' ? 'Edit dimensions' : 'Gérer les dimensions'}
          </button>
        </div>
      )}
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

function TaxCheckboxRow({ label, hint, checked, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex items-center gap-2.5 w-full text-left"
    >
      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
        checked ? 'bg-primary border-primary' : 'border-border'
      }`}>
        {checked && <Check size={9} strokeWidth={3} className="text-white" />}
      </div>
      <div className="min-w-0">
        <span className="text-sm text-[#1A1A18]">{label}</span>
        {hint && <span className="text-xs text-muted ml-1.5">{hint}</span>}
      </div>
    </button>
  )
}
