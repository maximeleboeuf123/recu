import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, X, Plus, ChevronDown, ChevronRight } from 'lucide-react'
import { useDimensions } from '../context/DimensionsContext'

const PRESETS = [
  {
    key: 'selfEmployed',
    icon: '💼',
    en: { label: 'CRA Self-Employed (T2125)', accountName: 'Self-Employed Business', categories: ['Advertising', 'Meals & entertainment', 'Insurance', 'Interest', 'Professional fees', 'Rent', 'Repairs & maintenance', 'Travel', 'Telephone & utilities', 'Other expenses'] },
    fr: { label: 'Travailleur autonome (T2125)', accountName: 'Travailleur autonome', categories: ['Publicité', 'Repas et représentation', 'Assurances', 'Intérêts', 'Honoraires professionnels', 'Loyer', 'Réparations', 'Voyages', 'Téléphone et services publics', 'Autres dépenses'] },
  },
  {
    key: 'rental',
    icon: '🏠',
    en: { label: 'CRA Rental Property (T776)', accountName: 'Rental Property 1', categories: ['Advertising', 'Insurance', 'Interest', 'Maintenance & repairs', 'Management fees', 'Motor vehicle', 'Office expenses', 'Professional fees', 'Property taxes', 'Travel', 'Utilities'] },
    fr: { label: 'Bien locatif (T776)', accountName: 'Bien locatif 1', categories: ['Publicité', 'Assurances', 'Intérêts', 'Entretien et réparations', 'Frais de gestion', 'Véhicule à moteur', 'Frais de bureau', 'Honoraires professionnels', 'Taxes foncières', 'Voyages', 'Services publics'] },
  },
  {
    key: 'personal',
    icon: '👤',
    en: { label: 'Personal', accountName: 'Personal', categories: ['Groceries', 'Restaurant', 'Transportation', 'Health & medical', 'Entertainment', 'Clothing', 'Home', 'Travel', 'Other'] },
    fr: { label: 'Personnel', accountName: 'Personnel', categories: ['Épicerie', 'Restaurant', 'Transport', 'Santé', 'Divertissement', 'Vêtements', 'Maison', 'Voyages', 'Autres'] },
  },
]

export default function DimensionsPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { accountsWithCategories, loading, addAccount, removeAccount, addCategory, removeCategory, applyPreset } = useDimensions()
  const [pickerPresetKey, setPickerPresetKey] = useState(null)
  const [toast, setToast] = useState(null)

  const lang = i18n.language === 'en' ? 'en' : 'fr'
  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2500) }

  const handlePresetAdd = (preset) => {
    if (accountsWithCategories.length === 0) {
      // No accounts yet — create immediately with preset's default name
      applyPreset(null, preset[lang].accountName, preset[lang].categories)
      showToast(lang === 'en' ? `"${preset[lang].accountName}" created` : `« ${preset[lang].accountName} » créé`)
    } else {
      // Show account picker
      setPickerPresetKey(pickerPresetKey === preset.key ? null : preset.key)
    }
  }

  const handlePickAccount = async (preset, accountId, accountName) => {
    setPickerPresetKey(null)
    const ok = await applyPreset(accountId, accountName, preset[lang].categories)
    if (ok) showToast(lang === 'en' ? `Categories added to "${accountName}"` : `Catégories ajoutées à « ${accountName} »`)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6 pb-24 space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-border/30 transition-colors">
          <ArrowLeft size={18} className="text-muted" />
        </button>
        <h1 className="text-xl font-bold text-[#1A1A18]">{t('settings.dimensions')}</h1>
      </div>

      {/* Preset packs */}
      <section>
        <p className="text-xs text-muted uppercase tracking-wide font-medium mb-1">
          {lang === 'en' ? 'Quick-start presets' : 'Packs prédéfinis'}
        </p>
        <p className="text-xs text-muted mb-3">
          {lang === 'en'
            ? 'Add categories to an existing account or create a new one.'
            : 'Ajoutez des catégories à un compte existant ou créez-en un nouveau.'}
        </p>
        <div className="bg-surface rounded-[8px] border border-border divide-y divide-border">
          {PRESETS.map((preset) => {
            const p = preset[lang]
            const isOpen = pickerPresetKey === preset.key
            return (
              <div key={preset.key}>
                <div className="flex items-center gap-3 px-4 py-3">
                  <span className="text-base flex-shrink-0">{preset.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#1A1A18]">{p.label}</p>
                    <p className="text-xs text-muted">{p.categories.length} {lang === 'en' ? 'categories' : 'catégories'}</p>
                  </div>
                  <button
                    onClick={() => handlePresetAdd(preset)}
                    className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 active:scale-[0.97] transition-colors"
                  >
                    <Plus size={12} />
                    {lang === 'en' ? 'Add' : 'Ajouter'}
                  </button>
                </div>

                {/* Account picker — expands when accounts already exist */}
                {isOpen && (
                  <div className="border-t border-border/60 bg-background/50 px-4 py-2 space-y-1">
                    <p className="text-xs text-muted py-1">
                      {lang === 'en' ? 'Add categories to:' : 'Ajouter les catégories à :'}
                    </p>
                    {/* Create new option */}
                    <button
                      onClick={() => handlePickAccount(preset, null, p.accountName)}
                      className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-[6px] text-sm text-primary hover:bg-primary/5 transition-colors"
                    >
                      <Plus size={13} className="flex-shrink-0" />
                      {lang === 'en' ? `Create "${p.accountName}"` : `Créer « ${p.accountName} »`}
                    </button>
                    {/* Existing accounts */}
                    {accountsWithCategories.map((acc) => (
                      <button
                        key={acc.id}
                        onClick={() => handlePickAccount(preset, acc.id, acc.name)}
                        className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-[6px] text-sm text-[#1A1A18] hover:bg-surface transition-colors"
                      >
                        <span className="flex-1 truncate">{acc.name}</span>
                        <span className="text-xs text-muted flex-shrink-0">{acc.categories.length} cat.</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* Accounts + nested categories */}
      <section>
        <p className="text-xs text-muted uppercase tracking-wide font-medium mb-3">
          {lang === 'en' ? 'Accounts & Categories' : 'Comptes & Catégories'}
        </p>
        <div className="space-y-3">
          {accountsWithCategories.map((account) => (
            <AccountBlock
              key={account.id}
              account={account}
              lang={lang}
              onRemoveAccount={() => removeAccount(account.id)}
              onAddCategory={(name) => addCategory(account.id, name)}
              onRemoveCategory={(id) => removeCategory(id)}
            />
          ))}

          {accountsWithCategories.length === 0 && (
            <p className="text-sm text-muted text-center py-4">
              {lang === 'en' ? 'No accounts yet — add a preset or create one below.' : 'Aucun compte — ajoutez un pack ou créez-en un ci-dessous.'}
            </p>
          )}
        </div>

        <AddRow
          placeholder={lang === 'en' ? 'New account...' : 'Nouveau compte...'}
          onAdd={addAccount}
          className="mt-3"
        />
      </section>

      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-[#1A1A18] text-white px-5 py-2.5 rounded-full text-sm z-50 shadow-lg pointer-events-none">
          {toast}
        </div>
      )}
    </div>
  )
}

function AccountBlock({ account, lang, onRemoveAccount, onAddCategory, onRemoveCategory }) {
  const [open, setOpen] = useState(true)

  return (
    <div className="bg-surface rounded-[8px] border border-border overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 bg-background/40">
        <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-2 flex-1 min-w-0">
          {open
            ? <ChevronDown size={14} className="text-muted flex-shrink-0" />
            : <ChevronRight size={14} className="text-muted flex-shrink-0" />}
          <span className="text-sm font-semibold text-[#1A1A18] truncate">{account.name}</span>
          <span className="text-xs text-muted flex-shrink-0">{account.categories.length}</span>
        </button>
        <button
          onClick={onRemoveAccount}
          className="w-6 h-6 flex items-center justify-center rounded-full text-muted hover:text-error hover:bg-error/10 transition-colors flex-shrink-0"
        >
          <X size={13} />
        </button>
      </div>

      {open && (
        <div className="divide-y divide-border/60">
          {account.categories.length === 0 && (
            <p className="text-xs text-muted px-10 py-2.5 italic">
              {lang === 'en' ? 'No categories yet' : 'Aucune catégorie'}
            </p>
          )}
          {account.categories.map((cat) => (
            <div key={cat.id} className="flex items-center justify-between pl-10 pr-4 py-2.5">
              <span className="text-sm text-[#1A1A18]">{cat.name}</span>
              <button
                onClick={() => onRemoveCategory(cat.id)}
                className="w-5 h-5 flex items-center justify-center rounded-full text-muted hover:text-error hover:bg-error/10 transition-colors"
              >
                <X size={11} />
              </button>
            </div>
          ))}
          <div className="pl-10 pr-4">
            <AddRow
              placeholder={lang === 'en' ? 'New category...' : 'Nouvelle catégorie...'}
              onAdd={onAddCategory}
              compact
            />
          </div>
        </div>
      )}
    </div>
  )
}

function AddRow({ placeholder, onAdd, compact = false, className = '' }) {
  const [value, setValue] = useState('')
  const [showInput, setShowInput] = useState(false)
  const [saving, setSaving] = useState(false)

  const handleAdd = async () => {
    if (!value.trim()) return
    setSaving(true)
    const ok = await onAdd(value)
    if (ok !== false) { setValue(''); setShowInput(false) }
    setSaving(false)
  }

  if (showInput) {
    return (
      <div className={`flex items-center gap-2 py-2.5 ${className}`}>
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleAdd()
            if (e.key === 'Escape') { setShowInput(false); setValue('') }
          }}
          placeholder={placeholder}
          className="flex-1 text-sm bg-transparent border-none focus:outline-none text-[#1A1A18] placeholder:text-muted min-w-0"
        />
        <button onClick={handleAdd} disabled={!value.trim() || saving} className="text-xs text-primary font-medium disabled:opacity-40 flex-shrink-0">
          OK
        </button>
        <button onClick={() => { setShowInput(false); setValue('') }} className="text-xs text-muted flex-shrink-0">✕</button>
      </div>
    )
  }

  return (
    <button
      onClick={() => setShowInput(true)}
      className={`flex items-center gap-2 text-sm text-primary py-2.5 hover:opacity-70 transition-opacity ${
        compact ? '' : 'w-full bg-surface rounded-[8px] border border-dashed border-primary/30 px-4 justify-center'
      } ${className}`}
    >
      <Plus size={13} />
      {placeholder}
    </button>
  )
}
