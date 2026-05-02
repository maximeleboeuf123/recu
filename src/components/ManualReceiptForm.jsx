import { useState, useRef } from 'react'
import { ArrowLeft, Check, Paperclip, X, ChevronDown } from 'lucide-react'
import { useDimensions } from '../context/DimensionsContext'

const FREQ_OPTIONS = [
  { value: 'weekly:1',  label_en: 'Weekly',         label_fr: 'Hebdomadaire', unit: 'weekly',  interval: 1 },
  { value: 'monthly:1', label_en: 'Monthly',        label_fr: 'Mensuel',      unit: 'monthly', interval: 1 },
  { value: 'monthly:2', label_en: 'Every 2 months', label_fr: 'Bimestriel',   unit: 'monthly', interval: 2 },
  { value: 'monthly:3', label_en: 'Quarterly',      label_fr: 'Trimestriel',  unit: 'monthly', interval: 3 },
  { value: 'monthly:6', label_en: 'Semi-annual',    label_fr: 'Semestriel',   unit: 'monthly', interval: 6 },
  { value: 'yearly:1',  label_en: 'Annual',         label_fr: 'Annuel',       unit: 'yearly',  interval: 1 },
]

function today() {
  return new Date().toISOString().slice(0, 10)
}

function generateDates(startDate, endDate, unit, interval) {
  if (!startDate) return []
  const dates = []
  const start = new Date(startDate + 'T12:00:00')
  const end = endDate ? new Date(endDate + 'T12:00:00') : null
  let current = new Date(start)
  while (dates.length < 120) {
    dates.push(current.toISOString().slice(0, 10))
    const next = new Date(current)
    if (unit === 'weekly') next.setDate(next.getDate() + 7 * interval)
    else if (unit === 'monthly') next.setMonth(next.getMonth() + interval)
    else next.setFullYear(next.getFullYear() + interval)
    current = next
    if (end && current > end) break
  }
  return dates
}

export default function ManualReceiptForm({ lang, initialValues, isRecurring, driveConnected, onSave, onClose }) {
  const { accountsWithCategories } = useDimensions()

  const [fields, setFields] = useState({
    name: initialValues.description || '',
    vendor: initialValues.vendor || '',
    invoice_date: !isRecurring ? (initialValues.invoice_date || today()) : '',
    invoice_number: initialValues.invoice_number || '',
    subtotal: initialValues.subtotal ?? '',
    gst: '',
    qst: '',
    hst: '',
    total: initialValues.total ?? '',
    currency: initialValues.currency || 'CAD',
    vendor_gst_number: initialValues.vendor_gst_number || '',
    vendor_qst_number: initialValues.vendor_qst_number || '',
    label_category: initialValues.labels?.category || '',
    label_property: initialValues.labels?.property || '',
  })

  const [schedule, setSchedule] = useState({
    unit: 'monthly',
    interval: 1,
    start_date: today(),
    end_date: '',
  })

  const [taxMode, setTaxMode] = useState(null) // null | 'gstqst' | 'hst'
  const [photoFile, setPhotoFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef(null)

  const setField = (key, value) => setFields((prev) => ({ ...prev, [key]: value }))

  // Tax mode handler — mirrors ReviewCard logic
  const handleTaxMode = (mode) => {
    if (mode === taxMode) {
      // Deselect: clear tax fields
      setFields((prev) => ({ ...prev, gst: '', qst: '', hst: '' }))
      setTaxMode(null)
      return
    }
    setTaxMode(mode)
    const sub = parseFloat(fields.subtotal)
    const tot = parseFloat(fields.total)
    if (mode === 'gstqst') {
      if (!isNaN(sub)) {
        const gst = Math.round(sub * 0.05 * 100) / 100
        const qst = Math.round(sub * 0.09975 * 100) / 100
        setFields((prev) => ({ ...prev, gst: String(gst), qst: String(qst), hst: '' }))
      } else if (!isNaN(tot)) {
        const sub2 = Math.round((tot / 1.14975) * 100) / 100
        const gst = Math.round(sub2 * 0.05 * 100) / 100
        const qst = Math.round(sub2 * 0.09975 * 100) / 100
        setFields((prev) => ({ ...prev, subtotal: String(sub2), gst: String(gst), qst: String(qst), hst: '' }))
      } else {
        setFields((prev) => ({ ...prev, hst: '' }))
      }
    } else if (mode === 'hst') {
      if (!isNaN(sub)) {
        const hst = Math.round(sub * 0.13 * 100) / 100
        setFields((prev) => ({ ...prev, hst: String(hst), gst: '', qst: '' }))
      } else if (!isNaN(tot)) {
        const sub2 = Math.round((tot / 1.13) * 100) / 100
        const hst = Math.round(sub2 * 0.13 * 100) / 100
        setFields((prev) => ({ ...prev, subtotal: String(sub2), hst: String(hst), gst: '', qst: '' }))
      } else {
        setFields((prev) => ({ ...prev, gst: '', qst: '' }))
      }
    }
  }

  const freqValue = `${schedule.unit}:${schedule.interval}`
  const handleFreqChange = (val) => {
    const opt = FREQ_OPTIONS.find((o) => o.value === val)
    if (opt) setSchedule((prev) => ({ ...prev, unit: opt.unit, interval: opt.interval }))
  }

  const previewDates = isRecurring
    ? generateDates(schedule.start_date, schedule.end_date, schedule.unit, schedule.interval)
    : []

  const selectedAccount = accountsWithCategories.find((a) => a.name === fields.label_property)
  const categoryOptions = selectedAccount?.categories || []

  const buildReceiptData = () => {
    const { label_category, label_property, name, ...rest } = fields
    const data = { ...rest }
    data.description = name || null
    for (const k of ['subtotal', 'gst', 'qst', 'hst', 'total']) {
      data[k] = (data[k] !== '' && data[k] != null) ? parseFloat(data[k]) : null
    }
    data.labels = { category: label_category || null, property: label_property || null }
    return data
  }

  const handleSubmit = async () => {
    setSaving(true)
    const success = await onSave(buildReceiptData(), schedule, photoFile)
    if (!success) setSaving(false)
  }

  const title = isRecurring
    ? (lang === 'en' ? 'Recurring entries' : 'Entrées récurrentes')
    : (lang === 'en' ? 'New receipt' : 'Reçu vierge')

  const labelClass = 'w-28 flex-shrink-0 text-sm text-muted'
  const inputClass = 'flex-1 bg-transparent border-none focus:outline-none text-sm text-[#1A1A18] py-0'
  const rowClass = 'flex items-center px-4 py-2.5 min-h-[44px]'
  const sectionLabelClass = 'text-xs text-muted uppercase tracking-wide font-medium px-4 pt-4 pb-1'

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 bg-surface border-b border-border z-10 flex items-center justify-between px-4 h-14 gap-3 flex-shrink-0">
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 text-muted hover:text-[#1A1A18] transition-colors"
        >
          <ArrowLeft size={20} />
          <span className="text-sm">{lang === 'en' ? 'Cancel' : 'Annuler'}</span>
        </button>
        <h1 className="text-sm font-semibold text-[#1A1A18] truncate">{title}</h1>
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="flex items-center gap-1.5 text-sm font-semibold text-primary disabled:opacity-50 transition-opacity"
        >
          {saving
            ? (lang === 'en' ? 'Saving...' : 'Enregistrement...')
            : (lang === 'en' ? 'Save' : 'Enregistrer')}
          {!saving && <Check size={16} />}
        </button>
      </header>

      {/* Body */}
      <div className="flex-1 overflow-y-auto pb-20 divide-y divide-border/60">

        {/* Section: Receipt details */}
        <div>
          <p className={sectionLabelClass}>
            {lang === 'en' ? 'Receipt details' : 'Détails du reçu'}
          </p>
          <div className={rowClass}>
            <span className={labelClass}>{lang === 'en' ? 'Vendor' : 'Fournisseur'}</span>
            <input
              className={inputClass}
              placeholder="—"
              value={fields.vendor}
              onChange={(e) => setField('vendor', e.target.value)}
            />
          </div>
          {!isRecurring && (
            <div className={rowClass}>
              <span className={labelClass}>{lang === 'en' ? 'Date' : 'Date'}</span>
              <input
                type="date"
                className={inputClass}
                value={fields.invoice_date}
                onChange={(e) => setField('invoice_date', e.target.value)}
              />
            </div>
          )}
          <div className={rowClass}>
            <span className={labelClass}>{lang === 'en' ? 'Invoice #' : 'No. facture'}</span>
            <input
              className={inputClass}
              placeholder="—"
              value={fields.invoice_number}
              onChange={(e) => setField('invoice_number', e.target.value)}
            />
          </div>
          <div className={rowClass}>
            <span className={labelClass}>{lang === 'en' ? 'Name' : 'Nom'}</span>
            <input
              className={inputClass}
              placeholder="—"
              value={fields.name}
              onChange={(e) => setField('name', e.target.value)}
            />
          </div>
        </div>

        {/* Section: Account & category */}
        <div>
          <p className={sectionLabelClass}>
            {lang === 'en' ? 'Account & category' : 'Compte et catégorie'}
          </p>
          <div className={rowClass}>
            <span className={labelClass}>{lang === 'en' ? 'Account' : 'Compte'}</span>
            <div className="flex-1 flex items-center gap-1">
              <select
                className={`${inputClass} appearance-none`}
                value={fields.label_property}
                onChange={(e) => {
                  setField('label_property', e.target.value)
                  setField('label_category', '')
                }}
              >
                <option value="">—</option>
                {accountsWithCategories.map((a) => (
                  <option key={a.id} value={a.name}>{a.name}</option>
                ))}
              </select>
              <ChevronDown size={14} className="text-muted flex-shrink-0" />
            </div>
          </div>
          <div className={rowClass}>
            <span className={labelClass}>{lang === 'en' ? 'Category' : 'Catégorie'}</span>
            <div className="flex-1 flex items-center gap-1">
              <select
                className={`${inputClass} appearance-none`}
                value={fields.label_category}
                onChange={(e) => setField('label_category', e.target.value)}
                disabled={categoryOptions.length === 0}
              >
                <option value="">—</option>
                {categoryOptions.map((c) => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
              <ChevronDown size={14} className="text-muted flex-shrink-0" />
            </div>
          </div>
        </div>

        {/* Section: Amounts */}
        <div>
          <p className={sectionLabelClass}>
            {lang === 'en' ? 'Amounts' : 'Montants'}
          </p>
          <div className={rowClass}>
            <span className={labelClass}>{lang === 'en' ? 'Total' : 'Total'}</span>
            <input
              type="number"
              inputMode="decimal"
              className={inputClass}
              placeholder="0.00"
              value={fields.total}
              onChange={(e) => setField('total', e.target.value)}
            />
          </div>
          <div className={rowClass}>
            <span className={labelClass}>{lang === 'en' ? 'Subtotal' : 'Sous-total'}</span>
            <input
              type="number"
              inputMode="decimal"
              className={inputClass}
              placeholder="0.00"
              value={fields.subtotal}
              onChange={(e) => setField('subtotal', e.target.value)}
            />
          </div>

          {/* Tax mode selectors */}
          <div className="px-4 py-3 space-y-2">
            <TaxCheckboxRow
              checked={taxMode === 'gstqst'}
              onChange={() => handleTaxMode('gstqst')}
              label="TPS/GST 5% + TVQ/QST 9.975%"
              hint="Québec"
            />
            <TaxCheckboxRow
              checked={taxMode === 'hst'}
              onChange={() => handleTaxMode('hst')}
              label="HST 13%"
              hint="Ontario & provinces atlantiques"
            />
          </div>

          {(taxMode === 'gstqst' || taxMode === null) && (
            <div className={rowClass}>
              <span className={labelClass}>TPS/GST</span>
              <input
                type="number"
                inputMode="decimal"
                className={inputClass}
                placeholder="0.00"
                value={fields.gst}
                onChange={(e) => setField('gst', e.target.value)}
              />
            </div>
          )}
          {taxMode === 'gstqst' && (
            <div className={rowClass}>
              <span className={labelClass}>TVQ/QST</span>
              <input
                type="number"
                inputMode="decimal"
                className={inputClass}
                placeholder="0.00"
                value={fields.qst}
                onChange={(e) => setField('qst', e.target.value)}
              />
            </div>
          )}
          {(taxMode === 'hst' || taxMode === null) && (
            <div className={rowClass}>
              <span className={labelClass}>HST</span>
              <input
                type="number"
                inputMode="decimal"
                className={inputClass}
                placeholder="0.00"
                value={fields.hst}
                onChange={(e) => setField('hst', e.target.value)}
              />
            </div>
          )}

          <div className={rowClass}>
            <span className={labelClass}>{lang === 'en' ? 'Currency' : 'Devise'}</span>
            <div className="flex-1 flex items-center gap-1">
              <select
                className={`${inputClass} appearance-none`}
                value={fields.currency}
                onChange={(e) => setField('currency', e.target.value)}
              >
                {['CAD', 'USD', 'EUR', 'GBP', 'CHF', 'MXN'].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <ChevronDown size={14} className="text-muted flex-shrink-0" />
            </div>
          </div>
        </div>

        {/* Section: Vendor tax numbers */}
        <div>
          <p className={sectionLabelClass}>
            {lang === 'en' ? 'Vendor tax numbers' : 'Numéros de taxe du fournisseur'}
          </p>
          <div className={rowClass}>
            <span className={labelClass}>GST #</span>
            <input
              className={inputClass}
              placeholder="RT-XXXXXXXXX"
              value={fields.vendor_gst_number}
              onChange={(e) => setField('vendor_gst_number', e.target.value)}
            />
          </div>
          <div className={rowClass}>
            <span className={labelClass}>QST #</span>
            <input
              className={inputClass}
              placeholder="XXXXXXXXXX TQ XXXX"
              value={fields.vendor_qst_number}
              onChange={(e) => setField('vendor_qst_number', e.target.value)}
            />
          </div>
        </div>

        {/* Section: Schedule (recurring only) */}
        {isRecurring && (
          <div>
            <p className={sectionLabelClass}>
              {lang === 'en' ? 'Schedule' : 'Calendrier'}
            </p>
            <div className={rowClass}>
              <span className={labelClass}>{lang === 'en' ? 'Start date' : 'Date début'}</span>
              <input
                type="date"
                className={inputClass}
                value={schedule.start_date}
                onChange={(e) => setSchedule((prev) => ({ ...prev, start_date: e.target.value }))}
              />
            </div>
            <div className={rowClass}>
              <span className={labelClass}>{lang === 'en' ? 'End date' : 'Date fin'}</span>
              <input
                type="date"
                className={inputClass}
                value={schedule.end_date}
                placeholder={lang === 'en' ? 'none' : 'aucune'}
                onChange={(e) => setSchedule((prev) => ({ ...prev, end_date: e.target.value }))}
              />
            </div>
            <div className={rowClass}>
              <span className={labelClass}>{lang === 'en' ? 'Frequency' : 'Fréquence'}</span>
              <div className="flex-1 flex items-center gap-1">
                <select
                  className={`${inputClass} appearance-none`}
                  value={freqValue}
                  onChange={(e) => handleFreqChange(e.target.value)}
                >
                  {FREQ_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {lang === 'en' ? o.label_en : o.label_fr}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} className="text-muted flex-shrink-0" />
              </div>
            </div>

            {previewDates.length > 0 && (
              <div className="px-4 py-3">
                <div className="bg-primary/5 border border-primary/20 rounded-[6px] px-3 py-2 text-sm text-primary font-medium">
                  {lang === 'en'
                    ? `Will create ${previewDates.length} receipt${previewDates.length === 1 ? '' : 's'}`
                    : `Créera ${previewDates.length} reçu${previewDates.length === 1 ? '' : 's'}`}
                  {previewDates.length >= 120 && (
                    <p className="text-xs font-normal mt-0.5 text-warning">
                      {lang === 'en'
                        ? 'Limit of 120 reached — add an end date'
                        : 'Limite de 120 atteinte — ajoutez une date de fin'}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Section: Attachment */}
        <div>
          <p className={sectionLabelClass}>
            {lang === 'en' ? 'Attachment' : 'Pièce jointe'}
          </p>
          {driveConnected ? (
            <div className="px-4 py-3">
              {photoFile ? (
                <div className="flex items-center gap-2">
                  <Paperclip size={16} className="text-primary flex-shrink-0" />
                  <span className="flex-1 text-sm text-[#1A1A18] truncate">{photoFile.name}</span>
                  <button
                    onClick={() => setPhotoFile(null)}
                    className="text-muted hover:text-error transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 text-sm text-primary font-medium"
                >
                  <Paperclip size={16} />
                  {lang === 'en' ? 'Attach a photo or PDF' : 'Joindre une photo ou PDF'}
                </button>
              )}
              {photoFile && (
                <p className="text-xs text-muted mt-1">
                  {lang === 'en'
                    ? 'Uploaded to Drive — no AI extraction'
                    : 'Envoyé vers Drive — sans extraction IA'}
                </p>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) setPhotoFile(f)
                  e.target.value = ''
                }}
              />
            </div>
          ) : (
            <div className="px-4 py-3">
              <p className="text-xs text-muted">
                {lang === 'en'
                  ? 'Connect Google Drive in Settings to attach a photo'
                  : 'Connectez Google Drive dans les paramètres pour joindre une photo'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function TaxCheckboxRow({ checked, onChange, label, hint }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer select-none">
      <div
        onClick={onChange}
        className={`w-4 h-4 rounded flex items-center justify-center border transition-colors flex-shrink-0 ${
          checked
            ? 'bg-primary border-primary'
            : 'border-border bg-surface'
        }`}
      >
        {checked && <Check size={10} strokeWidth={3} className="text-white" />}
      </div>
      <span className="text-sm text-[#1A1A18] flex-1">{label}</span>
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </label>
  )
}
