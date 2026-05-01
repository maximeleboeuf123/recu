import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, X, Plus, Check } from 'lucide-react'
import { useDimensions } from '../context/DimensionsContext'

const PRESETS = {
  accounts: {
    en: { label: 'Default Accounts', names: ['Personal', 'Business 1', 'Property 1'] },
    fr: { label: 'Comptes par défaut', names: ['Personnel', 'Entreprise 1', 'Propriété 1'] },
    type: 'account',
    icon: '🗂️',
  },
  selfEmployed: {
    en: {
      label: 'CRA Self-Employed (T2125)',
      names: [
        'Advertising', 'Meals & entertainment', 'Insurance', 'Interest',
        'Professional fees', 'Rent', 'Repairs & maintenance', 'Travel',
        'Telephone & utilities', 'Other expenses',
      ],
    },
    fr: {
      label: 'Travailleur autonome (T2125)',
      names: [
        'Publicité', 'Repas et représentation', 'Assurances', 'Intérêts',
        'Honoraires professionnels', 'Loyer', 'Réparations', 'Voyages',
        'Téléphone et services publics', 'Autres dépenses',
      ],
    },
    type: 'category',
    icon: '💼',
  },
  rental: {
    en: {
      label: 'CRA Rental Property (T776)',
      names: [
        'Advertising', 'Insurance', 'Interest', 'Maintenance & repairs',
        'Management fees', 'Motor vehicle', 'Office expenses', 'Professional fees',
        'Property taxes', 'Travel', 'Utilities',
      ],
    },
    fr: {
      label: 'Bien locatif (T776)',
      names: [
        'Publicité', 'Assurances', 'Intérêts', 'Entretien et réparations',
        'Frais de gestion', 'Véhicule à moteur', 'Frais de bureau',
        'Honoraires professionnels', 'Taxes foncières', 'Voyages', 'Services publics',
      ],
    },
    type: 'category',
    icon: '🏠',
  },
  personal: {
    en: {
      label: 'Personal',
      names: ['Groceries', 'Restaurant', 'Transportation', 'Health & medical', 'Entertainment', 'Clothing', 'Home', 'Travel', 'Other'],
    },
    fr: {
      label: 'Personnel',
      names: ['Épicerie', 'Restaurant', 'Transport', 'Santé', 'Divertissement', 'Vêtements', 'Maison', 'Voyages', 'Autres'],
    },
    type: 'category',
    icon: '👤',
  },
}

export default function DimensionsPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { accounts, categories, loading, add, remove, applyPreset } = useDimensions()
  const [appliedPresets, setAppliedPresets] = useState(new Set())
  const [toast, setToast] = useState(null)

  const lang = i18n.language === 'en' ? 'en' : 'fr'

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  const handleApplyPreset = async (key, preset) => {
    const ok = await applyPreset(preset.type, preset[lang].names)
    if (ok) {
      setAppliedPresets((prev) => new Set([...prev, key]))
      showToast(lang === 'en' ? `${preset[lang].label} added` : `${preset[lang].label} ajouté`)
    }
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
        <button
          onClick={() => navigate(-1)}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-border/30 transition-colors"
        >
          <ArrowLeft size={18} className="text-muted" />
        </button>
        <h1 className="text-xl font-bold text-[#1A1A18]">{t('settings.dimensions')}</h1>
      </div>

      {/* Preset packs */}
      <section>
        <p className="text-xs text-muted uppercase tracking-wide font-medium mb-2">
          {lang === 'en' ? 'Quick-start presets' : 'Packs prédéfinis'}
        </p>
        <div className="bg-surface rounded-[8px] border border-border divide-y divide-border">
          {Object.entries(PRESETS).map(([key, preset]) => {
            const applied = appliedPresets.has(key)
            return (
              <div key={key} className="flex items-center justify-between px-4 py-3 gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-base flex-shrink-0">{preset.icon}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#1A1A18] truncate">{preset[lang].label}</p>
                    <p className="text-xs text-muted">
                      {preset.type === 'account' ? t('receipt.account') : t('receipt.category')}
                      {' · '}{preset[lang].names.length} {lang === 'en' ? 'items' : 'éléments'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleApplyPreset(key, preset)}
                  disabled={applied}
                  className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-xs font-medium transition-colors ${
                    applied
                      ? 'bg-success/10 text-success cursor-default'
                      : 'bg-primary/10 text-primary hover:bg-primary/20 active:scale-[0.97]'
                  }`}
                >
                  {applied ? <><Check size={12} /> {lang === 'en' ? 'Added' : 'Ajouté'}</> : <><Plus size={12} /> {lang === 'en' ? 'Add' : 'Ajouter'}</>}
                </button>
              </div>
            )
          })}
        </div>
      </section>

      {/* Accounts */}
      <DimensionSection
        title={t('receipt.account')}
        items={accounts}
        type="account"
        placeholder={lang === 'en' ? 'New account...' : 'Nouveau compte...'}
        onAdd={(name) => add('account', name)}
        onRemove={(name) => remove('account', name)}
      />

      {/* Categories */}
      <DimensionSection
        title={t('receipt.category')}
        items={categories}
        type="category"
        placeholder={lang === 'en' ? 'New category...' : 'Nouvelle catégorie...'}
        onAdd={(name) => add('category', name)}
        onRemove={(name) => remove('category', name)}
      />

      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-[#1A1A18] text-white px-5 py-2.5 rounded-full text-sm z-50 shadow-lg pointer-events-none">
          {toast}
        </div>
      )}
    </div>
  )
}

function DimensionSection({ title, items, placeholder, onAdd, onRemove }) {
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)
  const [showInput, setShowInput] = useState(false)

  const handleAdd = async () => {
    if (!newName.trim()) return
    setAdding(true)
    await onAdd(newName)
    setNewName('')
    setAdding(false)
    setShowInput(false)
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-muted uppercase tracking-wide font-medium">{title}</p>
        <span className="text-xs text-muted">{items.length}</span>
      </div>
      <div className="bg-surface rounded-[8px] border border-border overflow-hidden">
        {items.length === 0 && !showInput && (
          <p className="text-sm text-muted text-center py-4 px-4">
            {title === 'Account' || title === 'Compte' ? 'Aucun compte' : 'Aucune catégorie'}
          </p>
        )}
        {items.map((item) => (
          <div key={item} className="flex items-center justify-between px-4 py-3 border-b border-border last:border-0">
            <span className="text-sm text-[#1A1A18]">{item}</span>
            <button
              onClick={() => onRemove(item)}
              className="w-6 h-6 flex items-center justify-center rounded-full text-muted hover:text-error hover:bg-error/10 transition-colors"
            >
              <X size={13} />
            </button>
          </div>
        ))}
        {showInput && (
          <div className="flex items-center gap-2 px-4 py-2.5 border-t border-border">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setShowInput(false) }}
              placeholder={placeholder}
              className="flex-1 text-sm bg-transparent border-none focus:outline-none text-[#1A1A18] placeholder:text-muted"
            />
            <button
              onClick={handleAdd}
              disabled={!newName.trim() || adding}
              className="text-xs text-primary font-medium disabled:opacity-40"
            >
              OK
            </button>
            <button onClick={() => { setShowInput(false); setNewName('') }} className="text-xs text-muted">
              ✕
            </button>
          </div>
        )}
        {!showInput && (
          <button
            onClick={() => setShowInput(true)}
            className="w-full flex items-center gap-2 px-4 py-3 text-sm text-primary hover:bg-background transition-colors border-t border-border first:border-0"
          >
            <Plus size={14} />
            {placeholder}
          </button>
        )}
      </div>
    </section>
  )
}
