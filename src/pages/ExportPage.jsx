import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { FileSpreadsheet, FileText, ExternalLink, HardDrive, CheckCircle, X, SlidersHorizontal, Link as LinkIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useReceipts } from '../hooks/useReceipts'
import { useDrive } from '../hooks/useDrive'
import { useDimensions } from '../context/DimensionsContext'

const EMPTY_FILTERS = {
  dateFrom: '', dateTo: '', account: '', category: '',
  vendor: '', status: 'all', amountMin: '', amountMax: '',
}

function applyFilters(receipts, f) {
  let list = receipts
  if (f.status !== 'all') list = list.filter((r) => r.status === f.status)
  if (f.dateFrom) list = list.filter((r) => (r.invoice_date || '') >= f.dateFrom)
  if (f.dateTo) list = list.filter((r) => (r.invoice_date || '') <= f.dateTo)
  if (f.vendor.trim()) {
    const q = f.vendor.toLowerCase()
    list = list.filter((r) => (r.vendor || '').toLowerCase().includes(q))
  }
  if (f.account) list = list.filter((r) => r.labels?.property === f.account)
  if (f.category) list = list.filter((r) => r.labels?.category === f.category)
  if (f.amountMin !== '') list = list.filter((r) => r.total != null && r.total >= parseFloat(f.amountMin))
  if (f.amountMax !== '') list = list.filter((r) => r.total != null && r.total <= parseFloat(f.amountMax))
  return list
}

function activeCount(f) {
  return [
    f.status !== 'all',
    !!(f.dateFrom || f.dateTo),
    !!f.vendor,
    !!f.account,
    !!f.category,
    !!(f.amountMin || f.amountMax),
  ].filter(Boolean).length
}

const isoToday = () => new Date().toISOString().slice(0, 10)

function dateRangePresets(lang) {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()

  const pad = (n) => String(n).padStart(2, '0')
  const lastDayOfMonth = (yr, mo) => new Date(yr, mo + 1, 0).getDate()

  const thisYear  = { from: `${y}-01-01`,             to: `${y}-12-31` }
  const thisQ     = (() => {
    const q = Math.floor(m / 3)
    const qStart = q * 3
    return { from: `${y}-${pad(qStart + 1)}-01`, to: `${y}-${pad(qStart + 3)}-${pad(lastDayOfMonth(y, qStart + 2))}` }
  })()
  const thisMonth = { from: `${y}-${pad(m + 1)}-01`,  to: `${y}-${pad(m + 1)}-${pad(lastDayOfMonth(y, m))}` }
  const lastMonth = (() => {
    const lm = m === 0 ? 11 : m - 1
    const ly = m === 0 ? y - 1 : y
    return { from: `${ly}-${pad(lm + 1)}-01`, to: `${ly}-${pad(lm + 1)}-${pad(lastDayOfMonth(ly, lm))}` }
  })()

  if (lang === 'fr') {
    return [
      { label: 'Cette année',      ...thisYear },
      { label: 'Ce trimestre',     ...thisQ },
      { label: 'Ce mois',          ...thisMonth },
      { label: 'Mois dernier',     ...lastMonth },
    ]
  }
  return [
    { label: 'This year',    ...thisYear },
    { label: 'This quarter', ...thisQ },
    { label: 'This month',   ...thisMonth },
    { label: 'Last month',   ...lastMonth },
  ]
}

export default function ExportPage() {
  const { i18n } = useTranslation()
  const { session } = useAuth()
  const { receipts, loading: receiptsLoading } = useReceipts()
  const { driveState, loading: driveLoading } = useDrive()
  const { accountsWithCategories } = useDimensions()

  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [format, setFormat] = useState('xlsx')
  const [filename, setFilename] = useState(`export_${isoToday()}`)
  const [exporting, setExporting] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [showFilters, setShowFilters] = useState(true)

  const lang = i18n.language?.startsWith('fr') ? 'fr' : 'en'

  const setField = (k, v) => setFilters((p) => ({ ...p, [k]: v }))
  const clearFilters = () => setFilters(EMPTY_FILTERS)

  const allReceipts = useMemo(
    () => receipts.filter((r) => r.status !== 'deleted').sort((a, b) => new Date(a.invoice_date || 0) - new Date(b.invoice_date || 0)),
    [receipts]
  )

  const numActive = useMemo(() => activeCount(filters), [filters])
  const exportList = useMemo(() => numActive > 0 ? applyFilters(allReceipts, filters) : allReceipts, [allReceipts, filters, numActive])

  const exportTotal = useMemo(
    () => exportList.reduce((sum, r) => sum + (r.total ?? 0), 0),
    [exportList]
  )

  const periodLabel = useMemo(() => {
    const dates = exportList.map((r) => r.invoice_date).filter(Boolean).sort()
    if (!dates.length) return ''
    return dates[0] === dates[dates.length - 1] ? dates[0] : `${dates[0]} to ${dates[dates.length - 1]}`
  }, [exportList])

  const presets = useMemo(() => dateRangePresets(lang), [lang])

  const categoryOptions = useMemo(() => {
    const acc = accountsWithCategories.find((a) => a.name === filters.account)
    return acc
      ? acc.categories.map((c) => c.name)
      : accountsWithCategories.flatMap((a) => a.categories.map((c) => c.name))
  }, [accountsWithCategories, filters.account])

  const accountsInExport = useMemo(() => {
    const seen = new Set(exportList.map((r) => r.labels?.property || ''))
    return [...seen].filter(Boolean).sort()
  }, [exportList])

  const handleExport = async () => {
    if (!exportList.length || !filename.trim()) return
    setExporting(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch('/api/drive/export', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: filename.trim(), format, receipts: exportList, period: periodLabel }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'export_failed')
      setResult(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setExporting(false)
    }
  }

  if (receiptsLoading || driveLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6 pb-28 space-y-5">
      <h1 className="text-xl font-bold text-[#1A1A18]">
        {lang === 'en' ? 'Export' : 'Exporter'}
      </h1>

      {/* Drive not connected */}
      {!driveState && (
        <div className="bg-surface border border-border rounded-[8px] p-4 flex items-start gap-3">
          <HardDrive size={17} className="text-muted flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[#1A1A18]">
              {lang === 'en' ? 'Google Drive required' : 'Google Drive requis'}
            </p>
            <p className="text-xs text-muted mt-0.5">
              {lang === 'en'
                ? 'Connect Google Drive in Settings to export your receipts.'
                : 'Connectez Google Drive dans les paramètres pour exporter vos reçus.'}
            </p>
            <Link to="/settings" className="text-xs text-primary font-medium mt-2 inline-block hover:underline">
              {lang === 'en' ? 'Go to Settings →' : 'Aller aux paramètres →'}
            </Link>
          </div>
        </div>
      )}

      {driveState && (
        <>
          {/* Filters */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <button
                onClick={() => setShowFilters((v) => !v)}
                className="flex items-center gap-1.5 text-xs text-muted uppercase tracking-wide font-medium hover:text-primary transition-colors"
              >
                <SlidersHorizontal size={13} />
                {lang === 'en' ? 'Filters' : 'Filtres'}
                {numActive > 0 && (
                  <span className="bg-primary text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 leading-none">
                    {numActive}
                  </span>
                )}
              </button>
              {numActive > 0 && (
                <button onClick={clearFilters} className="flex items-center gap-1 text-xs text-error hover:text-error/80 transition-colors">
                  <X size={11} />
                  {lang === 'en' ? 'Clear all' : 'Tout effacer'}
                </button>
              )}
            </div>

            {showFilters && (
              <div className="bg-surface border border-border rounded-[8px] p-4 space-y-4">
                {/* Date presets */}
                <div>
                  <p className="text-xs text-muted font-medium mb-2">
                    {lang === 'en' ? 'Period' : 'Période'}
                  </p>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {presets.map((p) => {
                      const active = filters.dateFrom === p.from && filters.dateTo === p.to
                      return (
                        <button
                          key={p.label}
                          onClick={() => { setField('dateFrom', p.from); setField('dateTo', p.to) }}
                          className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                            active
                              ? 'bg-primary text-white border-primary'
                              : 'bg-background border-border text-muted hover:border-primary hover:text-primary'
                          }`}
                        >
                          {p.label}
                        </button>
                      )
                    })}
                  </div>
                  <div className="flex gap-2 items-center">
                    <input
                      type="date"
                      value={filters.dateFrom}
                      onChange={(e) => setField('dateFrom', e.target.value)}
                      className="flex-1 text-sm bg-background border border-border rounded-[6px] px-3 py-2 focus:outline-none focus:border-primary transition-colors text-[#1A1A18]"
                    />
                    <span className="text-xs text-muted flex-shrink-0">→</span>
                    <input
                      type="date"
                      value={filters.dateTo}
                      onChange={(e) => setField('dateTo', e.target.value)}
                      className="flex-1 text-sm bg-background border border-border rounded-[6px] px-3 py-2 focus:outline-none focus:border-primary transition-colors text-[#1A1A18]"
                    />
                  </div>
                </div>

                {/* Status */}
                <div>
                  <p className="text-xs text-muted font-medium mb-2">
                    {lang === 'en' ? 'Status' : 'Statut'}
                  </p>
                  <div className="flex gap-2">
                    {['all', 'confirmed', 'pending'].map((s) => (
                      <button
                        key={s}
                        onClick={() => setField('status', s)}
                        className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
                          filters.status === s
                            ? 'bg-primary text-white border-primary'
                            : 'bg-background border-border text-muted hover:border-primary hover:text-primary'
                        }`}
                      >
                        {s === 'all' ? (lang === 'en' ? 'All' : 'Tous') : s === 'confirmed' ? (lang === 'en' ? 'Confirmed' : 'Confirmés') : (lang === 'en' ? 'Pending' : 'En attente')}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Account + Category */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-xs text-muted font-medium mb-2">
                      {lang === 'en' ? 'Account' : 'Compte'}
                    </p>
                    <select
                      value={filters.account}
                      onChange={(e) => { setField('account', e.target.value); setField('category', '') }}
                      className="w-full text-sm bg-background border border-border rounded-[6px] px-3 py-2 focus:outline-none focus:border-primary transition-colors text-[#1A1A18]"
                    >
                      <option value="">{lang === 'en' ? 'All' : 'Tous'}</option>
                      {accountsWithCategories.map((a) => (
                        <option key={a.id} value={a.name}>{a.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <p className="text-xs text-muted font-medium mb-2">
                      {lang === 'en' ? 'Category' : 'Catégorie'}
                    </p>
                    <select
                      value={filters.category}
                      onChange={(e) => setField('category', e.target.value)}
                      className="w-full text-sm bg-background border border-border rounded-[6px] px-3 py-2 focus:outline-none focus:border-primary transition-colors text-[#1A1A18]"
                    >
                      <option value="">{lang === 'en' ? 'All' : 'Toutes'}</option>
                      {categoryOptions.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Vendor */}
                <div>
                  <p className="text-xs text-muted font-medium mb-2">
                    {lang === 'en' ? 'Vendor' : 'Fournisseur'}
                  </p>
                  <input
                    type="text"
                    value={filters.vendor}
                    onChange={(e) => setField('vendor', e.target.value)}
                    placeholder={lang === 'en' ? 'Contains…' : 'Contient…'}
                    className="w-full text-sm bg-background border border-border rounded-[6px] px-3 py-2 focus:outline-none focus:border-primary transition-colors text-[#1A1A18] placeholder:text-muted"
                  />
                </div>

                {/* Amount range */}
                <div>
                  <p className="text-xs text-muted font-medium mb-2">
                    {lang === 'en' ? 'Total amount' : 'Montant total'}
                  </p>
                  <div className="flex gap-2 items-center">
                    <input
                      type="number" min="0" step="0.01"
                      value={filters.amountMin}
                      onChange={(e) => setField('amountMin', e.target.value)}
                      placeholder="Min"
                      className="flex-1 text-sm bg-background border border-border rounded-[6px] px-3 py-2 focus:outline-none focus:border-primary transition-colors text-[#1A1A18] placeholder:text-muted"
                    />
                    <span className="text-xs text-muted flex-shrink-0">—</span>
                    <input
                      type="number" min="0" step="0.01"
                      value={filters.amountMax}
                      onChange={(e) => setField('amountMax', e.target.value)}
                      placeholder="Max"
                      className="flex-1 text-sm bg-background border border-border rounded-[6px] px-3 py-2 focus:outline-none focus:border-primary transition-colors text-[#1A1A18] placeholder:text-muted"
                    />
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Summary card */}
          <div className="bg-primary/5 border border-primary/20 rounded-[8px] px-4 py-3 space-y-1">
            <div className="flex items-center justify-between">
              <p className="text-sm text-[#1A1A18]">
                <span className="font-semibold">{exportList.length}</span>{' '}
                {lang === 'en' ? `receipt${exportList.length !== 1 ? 's' : ''}` : `reçu${exportList.length !== 1 ? 's' : ''}`}
                {numActive > 0 && (
                  <span className="text-primary font-medium"> · {lang === 'en' ? 'filtered' : 'filtré'}</span>
                )}
              </p>
              <p className="text-sm font-semibold text-primary">
                {new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' }).format(exportTotal)}
              </p>
            </div>
            <p className="text-xs text-muted">
              {exportList.filter((r) => r.status === 'confirmed').length}{' '}
              {lang === 'en' ? 'confirmed' : 'confirmés'}{' · '}
              {exportList.filter((r) => r.status === 'pending').length}{' '}
              {lang === 'en' ? 'pending' : 'en attente'}
              {periodLabel ? ` · ${periodLabel}` : ''}
            </p>
            {accountsInExport.length > 1 && (
              <p className="text-xs text-primary font-medium">
                {lang === 'en'
                  ? `${accountsInExport.length} files will be created — one per account`
                  : `${accountsInExport.length} fichiers seront créés — un par compte`}
              </p>
            )}
          </div>

          {/* Format */}
          <section>
            <p className="text-xs text-muted uppercase tracking-wide font-medium mb-2">Format</p>
            <div className="grid grid-cols-2 gap-2">
              <FormatCard
                selected={format === 'xlsx'}
                onClick={() => setFormat('xlsx')}
                icon={FileSpreadsheet}
                label="XLSX"
                description={lang === 'en' ? '2 tabs: Transactions + Summary by account & category' : '2 onglets : Transactions + Résumé par compte & catégorie'}
              />
              <FormatCard
                selected={format === 'csv'}
                onClick={() => setFormat('csv')}
                icon={FileText}
                label="CSV"
                description={lang === 'en' ? 'Plain text, compatible with any app' : 'Texte simple, compatible partout'}
              />
            </div>
          </section>

          {/* Filename */}
          <section>
            <p className="text-xs text-muted uppercase tracking-wide font-medium mb-2">
              {lang === 'en' ? 'Filename' : 'Nom du fichier'}
            </p>
            <div className="flex items-center gap-2">
              <input
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                className="flex-1 bg-surface border border-border rounded-[8px] px-4 py-2.5 text-sm text-[#1A1A18] focus:outline-none focus:border-primary transition-colors"
                placeholder="export_2026-01-01"
              />
              <span className="text-sm text-muted flex-shrink-0">.{format}</span>
            </div>
            <p className="text-xs text-muted mt-1.5">
              {lang === 'en'
                ? 'Saved to Récu/{Account}/_Exports in your Drive. Same filename overwrites the previous file.'
                : 'Enregistré dans Récu/{Compte}/_Exports de votre Drive. Un même nom remplace le fichier précédent.'}
            </p>
            <p className="text-xs text-muted mt-1">
              {lang === 'en'
                ? 'One file per account — each saved to its own folder so you can share a folder directly with your accountant.'
                : 'Un fichier par compte — chacun dans son propre dossier pour partager facilement avec votre comptable.'}
            </p>
          </section>

          {/* Error */}
          {error && (
            <p className="text-sm text-error">
              {error === 'drive_not_connected'
                ? (lang === 'en' ? 'Drive not connected.' : 'Drive non connecté.')
                : (lang === 'en' ? 'Something went wrong.' : 'Une erreur est survenue.')}
            </p>
          )}

          {/* Success */}
          {result?.files?.length > 0 && (
            <div className="bg-surface border border-border rounded-[8px] p-4 space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle size={16} className="text-success flex-shrink-0" />
                <p className="text-sm font-medium text-[#1A1A18]">
                  {lang === 'en'
                    ? `${result.files.length} file${result.files.length !== 1 ? 's' : ''} exported`
                    : `${result.files.length} fichier${result.files.length !== 1 ? 's' : ''} exporté${result.files.length !== 1 ? 's' : ''}`}
                </p>
              </div>
              <div className="space-y-2">
                {result.files.map((f) => (
                  <div key={f.filename} className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      {f.account && (
                        <p className="text-xs font-semibold text-[#1A1A18] truncate">{f.account}</p>
                      )}
                      <p className="text-xs text-muted truncate">{f.filename}</p>
                    </div>
                    <a
                      href={f.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-shrink-0 flex items-center gap-1 text-xs text-primary font-medium hover:underline"
                    >
                      <ExternalLink size={13} />
                      {lang === 'en' ? 'Open' : 'Ouvrir'}
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Export button */}
          <button
            onClick={handleExport}
            disabled={exporting || !exportList.length || !filename.trim()}
            className="w-full py-3.5 text-sm bg-primary text-white rounded-[8px] font-semibold active:scale-[0.98] transition-transform disabled:opacity-50"
          >
            {exporting
              ? (lang === 'en' ? 'Exporting…' : 'Exportation…')
              : (lang === 'en'
                  ? `Export ${exportList.length} receipt${exportList.length !== 1 ? 's' : ''}`
                  : `Exporter ${exportList.length} reçu${exportList.length !== 1 ? 's' : ''}`)}
          </button>
        </>
      )}
    </div>
  )
}

function FormatCard({ selected, onClick, icon: Icon, label, description }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col gap-2 p-3 rounded-[8px] border text-left transition-colors ${
        selected ? 'border-primary bg-primary/5' : 'border-border bg-surface hover:border-primary/40'
      }`}
    >
      <Icon size={20} className={selected ? 'text-primary' : 'text-muted'} />
      <p className={`text-sm font-semibold ${selected ? 'text-primary' : 'text-[#1A1A18]'}`}>{label}</p>
      <p className="text-xs text-muted leading-snug">{description}</p>
    </button>
  )
}
