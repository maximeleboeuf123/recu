import { useState, useRef, useEffect } from 'react'
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
  const { accountsWithCategories, loading, removeAccount, addCategory, removeCategory, renameAccount, renameCategory, applyPreset } = useDimensions()
  const [configSheet, setConfigSheet] = useState(null) // null | { accountName, categories[] }
  const [toast, setToast] = useState(null)

  const lang = i18n.language === 'en' ? 'en' : 'fr'
  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2500) }

  const handleCreate = async ({ accountName, categories }) => {
    const ok = await applyPreset(null, accountName.trim(), categories)
    if (ok) {
      showToast(lang === 'en' ? `"${accountName}" created` : `« ${accountName} » créé`)
      setConfigSheet(null)
    }
    return ok
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (configSheet) {
    return (
      <AccountConfigSheet
        lang={lang}
        initialName={configSheet.accountName}
        initialCategories={configSheet.categories}
        onBack={() => setConfigSheet(null)}
        onCreate={handleCreate}
      />
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
            ? 'Creates a new account with pre-filled categories you can edit before confirming.'
            : 'Crée un nouveau compte avec des catégories préremplies que vous pouvez modifier avant de confirmer.'}
        </p>
        <div className="bg-surface rounded-[8px] border border-border divide-y divide-border">
          {PRESETS.map((preset) => {
            const p = preset[lang]
            return (
              <div key={preset.key} className="flex items-center gap-3 px-4 py-3">
                <span className="text-base flex-shrink-0">{preset.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#1A1A18]">{p.label}</p>
                  <p className="text-xs text-muted">{p.categories.length} {lang === 'en' ? 'categories' : 'catégories'}</p>
                </div>
                <button
                  onClick={() => setConfigSheet({ accountName: p.accountName, categories: [...p.categories] })}
                  className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 active:scale-[0.97] transition-colors"
                >
                  <Plus size={12} />
                  {lang === 'en' ? 'Add' : 'Ajouter'}
                </button>
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
              onRenameAccount={(name) => renameAccount(account.id, name)}
              onAddCategory={(name) => addCategory(account.id, name)}
              onRemoveCategory={(id) => removeCategory(id)}
              onRenameCategory={(id, name) => renameCategory(id, name)}
            />
          ))}

          {accountsWithCategories.length === 0 && (
            <p className="text-sm text-muted text-center py-4">
              {lang === 'en' ? 'No accounts yet — add a preset or create one below.' : 'Aucun compte — ajoutez un pack ou créez-en un ci-dessous.'}
            </p>
          )}
        </div>

        <button
          onClick={() => setConfigSheet({ accountName: '', categories: [] })}
          className="mt-3 w-full flex items-center justify-center gap-2 text-sm text-primary py-2.5 bg-surface rounded-[8px] border border-dashed border-primary/30 px-4 hover:opacity-70 transition-opacity"
        >
          <Plus size={13} />
          {lang === 'en' ? 'New account...' : 'Nouveau compte...'}
        </button>
      </section>

      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-[#1A1A18] text-white px-5 py-2.5 rounded-full text-sm z-50 shadow-lg pointer-events-none">
          {toast}
        </div>
      )}
    </div>
  )
}

function AccountConfigSheet({ lang, initialName, initialCategories, onBack, onCreate }) {
  const [accountName, setAccountName] = useState(initialName)
  const [categories, setCategories] = useState(initialCategories)
  const [newCat, setNewCat] = useState('')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef(null)

  const isManual = initialCategories.length === 0

  const addCat = () => {
    const val = newCat.trim()
    if (!val) return
    if (!categories.includes(val)) setCategories((prev) => [...prev, val])
    setNewCat('')
    inputRef.current?.focus()
  }

  const removeCat = (cat) => setCategories((prev) => prev.filter((c) => c !== cat))

  const loadPreset = (preset) => {
    const cats = preset[lang].categories
    setCategories((prev) => {
      const existing = new Set(prev)
      return [...prev, ...cats.filter((c) => !existing.has(c))]
    })
    if (!accountName.trim()) setAccountName(preset[lang].accountName)
  }

  const handleCreate = async () => {
    if (!accountName.trim()) return
    setSaving(true)
    await onCreate({ accountName, categories })
    setSaving(false)
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6 pb-24 space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-border/30 transition-colors">
          <ArrowLeft size={18} className="text-muted" />
        </button>
        <h1 className="text-xl font-bold text-[#1A1A18]">
          {lang === 'en' ? 'New account' : 'Nouveau compte'}
        </h1>
      </div>

      {/* Account name */}
      <section>
        <p className="text-xs text-muted uppercase tracking-wide font-medium mb-2">
          {lang === 'en' ? 'Account name' : 'Nom du compte'}
        </p>
        <input
          autoFocus={isManual}
          value={accountName}
          onChange={(e) => setAccountName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.focus()}
          placeholder={lang === 'en' ? 'e.g. Business, Rental Property 1…' : 'ex. Commerce, Bien locatif 1…'}
          className="w-full bg-surface border border-border rounded-[8px] px-4 py-2.5 text-sm text-[#1A1A18] placeholder:text-muted focus:outline-none focus:border-primary/50 transition-colors"
        />
      </section>

      {/* Categories */}
      <section>
        <p className="text-xs text-muted uppercase tracking-wide font-medium mb-2">
          {lang === 'en' ? 'Categories' : 'Catégories'}
        </p>
        <div className="bg-surface rounded-[8px] border border-border overflow-hidden">
          {categories.length === 0 && (
            <p className="text-xs text-muted px-4 py-3 italic">
              {lang === 'en' ? 'No categories yet.' : 'Aucune catégorie.'}
            </p>
          )}
          {categories.map((cat) => (
            <div key={cat} className="flex items-center justify-between px-4 py-2.5 border-b border-border/60 last:border-0">
              <span className="text-sm text-[#1A1A18]">{cat}</span>
              <button
                onClick={() => removeCat(cat)}
                className="w-5 h-5 flex items-center justify-center rounded-full text-muted hover:text-error hover:bg-error/10 transition-colors"
              >
                <X size={11} />
              </button>
            </div>
          ))}

          {/* Inline add category */}
          <div className="flex items-center gap-2 px-4 py-2.5 border-t border-dashed border-border">
            <input
              ref={inputRef}
              value={newCat}
              onChange={(e) => setNewCat(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addCat() }}
              placeholder={lang === 'en' ? 'Add a category…' : 'Ajouter une catégorie…'}
              className="flex-1 text-sm bg-transparent border-none focus:outline-none text-[#1A1A18] placeholder:text-muted min-w-0"
            />
            {newCat.trim() && (
              <button onClick={addCat} className="text-xs text-primary font-medium flex-shrink-0">
                OK
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Preset import — shown for manual accounts or always visible */}
      <section>
        <p className="text-xs text-muted uppercase tracking-wide font-medium mb-2">
          {lang === 'en' ? 'Import from a preset' : 'Importer depuis un pack'}
        </p>
        <div className="bg-surface rounded-[8px] border border-border divide-y divide-border">
          {PRESETS.map((preset) => {
            const p = preset[lang]
            return (
              <button
                key={preset.key}
                onClick={() => loadPreset(preset)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-background transition-colors text-left"
              >
                <span className="text-base flex-shrink-0">{preset.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#1A1A18]">{p.label}</p>
                  <p className="text-xs text-muted">{p.categories.length} {lang === 'en' ? 'categories' : 'catégories'}</p>
                </div>
                <Plus size={14} className="text-primary flex-shrink-0" />
              </button>
            )
          })}
        </div>
      </section>

      <button
        onClick={handleCreate}
        disabled={!accountName.trim() || saving}
        className="w-full py-3 text-sm bg-primary text-white rounded-[8px] font-medium active:scale-[0.98] transition-transform disabled:opacity-50"
      >
        {saving
          ? (lang === 'en' ? 'Creating…' : 'Création…')
          : (lang === 'en' ? 'Create account' : 'Créer le compte')}
      </button>
    </div>
  )
}

function AccountBlock({ account, lang, onRemoveAccount, onRenameAccount, onAddCategory, onRemoveCategory, onRenameCategory }) {
  const [open, setOpen] = useState(true)

  return (
    <div className="bg-surface rounded-[8px] border border-border overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 bg-background/40">
        <button onClick={() => setOpen((v) => !v)} className="flex-shrink-0">
          {open
            ? <ChevronDown size={14} className="text-muted" />
            : <ChevronRight size={14} className="text-muted" />}
        </button>
        <EditableName
          value={account.name}
          onSave={onRenameAccount}
          className="flex-1 min-w-0 text-sm font-semibold text-[#1A1A18]"
        />
        <span className="text-xs text-muted flex-shrink-0 mr-1">{account.categories.length}</span>
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
            <div key={cat.id} className="flex items-center gap-2 pl-10 pr-4 py-2.5">
              <EditableName
                value={cat.name}
                onSave={(name) => onRenameCategory(cat.id, name)}
                className="flex-1 min-w-0 text-sm text-[#1A1A18]"
              />
              <button
                onClick={() => onRemoveCategory(cat.id)}
                className="w-5 h-5 flex items-center justify-center rounded-full text-muted hover:text-error hover:bg-error/10 transition-colors flex-shrink-0"
              >
                <X size={11} />
              </button>
            </div>
          ))}
          <div className="pl-10 pr-4">
            <InlineAddCategory
              placeholder={lang === 'en' ? 'New category...' : 'Nouvelle catégorie...'}
              onAdd={onAddCategory}
            />
          </div>
        </div>
      )}
    </div>
  )
}

function EditableName({ value, onSave, className }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const inputRef = useRef(null)

  useEffect(() => { if (editing) inputRef.current?.select() }, [editing])

  const start = () => { setDraft(value); setEditing(true) }
  const cancel = () => setEditing(false)
  const save = async () => {
    if (!draft.trim() || draft.trim() === value) { cancel(); return }
    await onSave(draft.trim())
    setEditing(false)
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel() }}
        onBlur={save}
        className={`bg-transparent border-b border-primary focus:outline-none truncate ${className}`}
      />
    )
  }

  return (
    <button onClick={start} className={`text-left truncate hover:opacity-70 transition-opacity ${className}`}>
      {value}
    </button>
  )
}

function InlineAddCategory({ placeholder, onAdd }) {
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)

  const handleAdd = async () => {
    if (!value.trim()) return
    setSaving(true)
    const ok = await onAdd(value)
    if (ok !== false) setValue('')
    setSaving(false)
  }

  return (
    <div className="flex items-center gap-2 py-2.5">
      <Plus size={12} className="text-muted flex-shrink-0" />
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') handleAdd() }}
        placeholder={placeholder}
        className="flex-1 text-sm bg-transparent border-none focus:outline-none text-[#1A1A18] placeholder:text-muted min-w-0"
      />
      {value.trim() && (
        <button onClick={handleAdd} disabled={saving} className="text-xs text-primary font-medium disabled:opacity-40 flex-shrink-0">
          OK
        </button>
      )}
    </div>
  )
}
