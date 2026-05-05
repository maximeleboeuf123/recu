import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { X, ChevronDown, Settings } from 'lucide-react'

export default function DimensionRow({ label, value, onChange, options = [], dimmed = false }) {
  const { i18n } = useTranslation()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [localVal, setLocalVal] = useState(value)
  const lang = i18n.language === 'en' ? 'en' : 'fr'

  if (!open && localVal !== value) setLocalVal(value)

  const normalized = useMemo(() =>
    options.map(o => typeof o === 'string' ? { value: o, label: o, isShared: false } : o),
  [options])

  const filtered = normalized.filter(
    (o) => !localVal || o.label.toLowerCase().includes(localVal.toLowerCase())
  )
  const showDropdown = open && (filtered.length > 0 || normalized.length === 0)

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
          placeholder={dimmed ? (lang === 'en' ? 'Select account first' : "Choisir un compte d'abord") : '—'}
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
              key={opt.value}
              onMouseDown={() => commit(opt.value)}
              className={`w-full text-left px-4 py-2 text-sm border-b border-border/40 last:border-0 transition-colors ${
                opt.value === localVal
                  ? 'text-primary font-medium bg-primary/5'
                  : opt.isShared
                  ? 'text-indigo-600 hover:bg-indigo-50/60'
                  : 'text-[#1A1A18] hover:bg-surface'
              }`}
            >
              {opt.label}
            </button>
          ))}
          {normalized.length === 0 && (
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
