import { useState } from 'react'
import { useTranslation } from 'react-i18next'

const FREQUENCY_OPTIONS = [
  { label: 'freq_weekly', unit: 'weekly', interval: 1 },
  { label: 'freq_monthly', unit: 'monthly', interval: 1 },
  { label: 'freq_bimonthly', unit: 'monthly', interval: 2 },
  { label: 'freq_quarterly', unit: 'monthly', interval: 3 },
  { label: 'freq_semestrial', unit: 'monthly', interval: 6 },
  { label: 'freq_annual', unit: 'yearly', interval: 1 },
]

const CONFIRMATION_OPTIONS = [
  { label: 'recurring_auto', value: 'fixed' },
  { label: 'recurring_review_amount', value: 'variable' },
  { label: 'recurring_review_all', value: 'estimated' },
]

const today = () => new Date().toISOString().slice(0, 10)

export default function RecurringFields({ value, onChange }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  const [freq, setFreq] = useState(FREQUENCY_OPTIONS[1]) // Mensuel default
  const [startDate, setStartDate] = useState(today())
  const [endDate, setEndDate] = useState('')
  const [confirmationType, setConfirmationType] = useState('variable')

  const toggle = (checked) => {
    setOpen(checked)
    if (!checked) {
      onChange(null)
    } else {
      emitChange(freq, startDate, endDate, confirmationType)
    }
  }

  const emitChange = (f, start, end, conf) => {
    onChange({
      frequency_unit: f.unit,
      frequency_interval: f.interval,
      start_date: start,
      end_date: end || null,
      amount_type: conf,
    })
  }

  const handleFreq = (f) => {
    setFreq(f)
    emitChange(f, startDate, endDate, confirmationType)
  }
  const handleStart = (v) => {
    setStartDate(v)
    emitChange(freq, v, endDate, confirmationType)
  }
  const handleEnd = (v) => {
    setEndDate(v)
    emitChange(freq, startDate, v, confirmationType)
  }
  const handleConf = (v) => {
    setConfirmationType(v)
    emitChange(freq, startDate, endDate, v)
  }

  return (
    <div className="border-t border-border pt-4 space-y-3">
      <label className="flex items-center gap-3 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={open}
          onChange={(e) => toggle(e.target.checked)}
          className="w-4 h-4 rounded accent-primary"
        />
        <span className="text-sm font-medium text-[#1A1A18]">{t('review.recurring_checkbox')}</span>
      </label>

      <div
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{ maxHeight: open ? '400px' : '0px' }}
      >
        <div className="space-y-3 pt-1 pb-2">
          {/* Frequency */}
          <FieldRow label={t('review.recurring_frequency')}>
            <select
              value={`${freq.unit}:${freq.interval}`}
              onChange={(e) => {
                const found = FREQUENCY_OPTIONS.find(
                  (f) => `${f.unit}:${f.interval}` === e.target.value,
                )
                if (found) handleFreq(found)
              }}
              className="text-sm border border-border rounded-[6px] px-2 py-1.5 bg-surface focus:outline-none focus:border-primary"
            >
              {FREQUENCY_OPTIONS.map((f) => (
                <option key={`${f.unit}:${f.interval}`} value={`${f.unit}:${f.interval}`}>
                  {t(`review.${f.label}`)}
                </option>
              ))}
            </select>
          </FieldRow>

          {/* Start date */}
          <FieldRow label={t('review.recurring_start')}>
            <input
              type="date"
              value={startDate}
              onChange={(e) => handleStart(e.target.value)}
              className="text-sm border border-border rounded-[6px] px-2 py-1.5 bg-surface focus:outline-none focus:border-primary"
            />
          </FieldRow>

          {/* End date */}
          <FieldRow label={t('review.recurring_end')}>
            <input
              type="date"
              value={endDate}
              onChange={(e) => handleEnd(e.target.value)}
              placeholder={t('review.recurring_end_placeholder')}
              className="text-sm border border-border rounded-[6px] px-2 py-1.5 bg-surface focus:outline-none focus:border-primary"
            />
          </FieldRow>

          {/* Confirmation mode */}
          <FieldRow label={t('review.recurring_confirmation')}>
            <select
              value={confirmationType}
              onChange={(e) => handleConf(e.target.value)}
              className="text-sm border border-border rounded-[6px] px-2 py-1.5 bg-surface focus:outline-none focus:border-primary"
            >
              {CONFIRMATION_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {t(`review.${o.label}`)}
                </option>
              ))}
            </select>
          </FieldRow>
        </div>
      </div>
    </div>
  )
}

function FieldRow({ label, children }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-muted flex-shrink-0">{label}</span>
      {children}
    </div>
  )
}
