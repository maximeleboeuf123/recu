import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ArrowLeft, FileSpreadsheet, FileText, ExternalLink, HardDrive, CheckCircle } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useReceipts } from '../hooks/useReceipts'
import { useDrive } from '../hooks/useDrive'
import { useLedgerFilters } from '../context/LedgerFilterContext'

function applyFilters(receipts, filters) {
  let list = receipts
  if (filters.search.trim()) {
    const q = filters.search.toLowerCase()
    list = list.filter((r) =>
      (r.vendor || '').toLowerCase().includes(q) ||
      (r.description || '').toLowerCase().includes(q) ||
      (r.invoice_number || '').toLowerCase().includes(q)
    )
  }
  if (filters.status !== 'all') list = list.filter((r) => r.status === filters.status)
  if (filters.dateFrom) list = list.filter((r) => r.invoice_date >= filters.dateFrom)
  if (filters.dateTo) list = list.filter((r) => r.invoice_date <= filters.dateTo)
  if (filters.vendor.trim()) {
    const q = filters.vendor.toLowerCase()
    list = list.filter((r) => (r.vendor || '').toLowerCase().includes(q))
  }
  if (filters.account) list = list.filter((r) => r.labels?.property === filters.account)
  if (filters.category) list = list.filter((r) => r.labels?.category === filters.category)
  if (filters.amountMin !== '') list = list.filter((r) => r.total != null && r.total >= parseFloat(filters.amountMin))
  if (filters.amountMax !== '') list = list.filter((r) => r.total != null && r.total <= parseFloat(filters.amountMax))
  return list
}

const today = () => new Date().toISOString().slice(0, 10)

export default function ExportPage() {
  const { t, i18n } = useTranslation()
  const { session } = useAuth()
  const { receipts, loading: receiptsLoading } = useReceipts()
  const { driveState, loading: driveLoading } = useDrive()
  const { filters, activeCount } = useLedgerFilters()

  const [scope, setScope] = useState('all')
  const [format, setFormat] = useState('xlsx')
  const [filename, setFilename] = useState(`export_${today()}`)
  const [exporting, setExporting] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const lang = i18n.language === 'en' ? 'en' : 'fr'

  const allReceipts = useMemo(
    () => receipts.filter((r) => r.status !== 'deleted').sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
    [receipts]
  )
  const filteredReceipts = useMemo(() => applyFilters(allReceipts, filters), [allReceipts, filters])

  const exportList = scope === 'filtered' && activeCount > 0 ? filteredReceipts : allReceipts

  const handleExport = async () => {
    if (!exportList.length || !filename.trim()) return
    setExporting(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch('/api/drive/export', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ filename: filename.trim(), format, receipts: exportList }),
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
    <div className="max-w-lg mx-auto px-4 py-6 pb-24 space-y-5">
      <div className="flex items-center gap-3">
        <Link to="/ledger" className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-border/30 transition-colors">
          <ArrowLeft size={18} className="text-muted" />
        </Link>
        <h1 className="text-xl font-bold text-[#1A1A18]">{t('export.title')}</h1>
      </div>

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
          {/* Scope */}
          <section>
            <p className="text-xs text-muted uppercase tracking-wide font-medium mb-2">
              {lang === 'en' ? 'What to export' : 'Quoi exporter'}
            </p>
            <div className="bg-surface rounded-[8px] border border-border divide-y divide-border">
              <ScopeRow
                selected={scope === 'all'}
                onClick={() => setScope('all')}
                label={lang === 'en' ? 'Full ledger' : 'Grand livre complet'}
                count={allReceipts.length}
                lang={lang}
              />
              <ScopeRow
                selected={scope === 'filtered'}
                onClick={() => setScope('filtered')}
                label={lang === 'en' ? 'Current filters' : 'Filtres actuels'}
                count={filteredReceipts.length}
                lang={lang}
                disabled={activeCount === 0}
                hint={activeCount === 0 ? (lang === 'en' ? 'No active filters' : 'Aucun filtre actif') : null}
              />
            </div>
          </section>

          {/* Format */}
          <section>
            <p className="text-xs text-muted uppercase tracking-wide font-medium mb-2">
              {lang === 'en' ? 'Format' : 'Format'}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <FormatCard
                selected={format === 'xlsx'}
                onClick={() => setFormat('xlsx')}
                icon={FileSpreadsheet}
                label="XLSX"
                description={lang === 'en' ? 'Spreadsheet with frozen header, column widths & number formatting' : 'Tableau avec en-tête figé, colonnes et format numérique'}
              />
              <FormatCard
                selected={format === 'csv'}
                onClick={() => setFormat('csv')}
                icon={FileText}
                label="CSV"
                description={lang === 'en' ? 'Plain text, compatible with any spreadsheet app' : 'Texte simple, compatible avec toutes les applications'}
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
                placeholder="export_2026-05-01"
              />
              <span className="text-sm text-muted flex-shrink-0">.{format}</span>
            </div>
            <p className="text-xs text-muted mt-1.5">
              {lang === 'en'
                ? 'Saved to Récu/_Exports in your Google Drive. Existing file with this name will be replaced.'
                : 'Enregistré dans Récu/_Exports de votre Google Drive. Un fichier existant portant ce nom sera remplacé.'}
            </p>
          </section>

          {/* Summary */}
          <div className="bg-primary/5 border border-primary/20 rounded-[8px] px-4 py-3">
            <p className="text-sm text-[#1A1A18]">
              <span className="font-semibold">{exportList.length}</span>{' '}
              {lang === 'en' ? `receipt${exportList.length !== 1 ? 's' : ''}` : `reçu${exportList.length !== 1 ? 's' : ''}`}
              {' · '}
              {exportList.filter((r) => r.status === 'confirmed').length}{' '}
              {lang === 'en' ? 'confirmed' : 'confirmés'},{' '}
              {exportList.filter((r) => r.status === 'pending').length}{' '}
              {lang === 'en' ? 'pending' : 'en attente'}
            </p>
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-error">
              {error === 'drive_not_connected'
                ? (lang === 'en' ? 'Drive not connected.' : 'Drive non connecté.')
                : t('common.error')}
            </p>
          )}

          {/* Success */}
          {result && (
            <div className="bg-surface border border-border rounded-[8px] p-4 flex items-center gap-3">
              <CheckCircle size={18} className="text-success flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#1A1A18]">
                  {lang === 'en' ? 'Exported successfully' : 'Exporté avec succès'}
                </p>
                <p className="text-xs text-muted truncate">{result.filename}</p>
              </div>
              <a
                href={result.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-shrink-0 flex items-center gap-1 text-xs text-primary font-medium hover:underline"
              >
                <ExternalLink size={13} />
                {lang === 'en' ? 'Open' : 'Ouvrir'}
              </a>
            </div>
          )}

          {/* Export button */}
          <button
            onClick={handleExport}
            disabled={exporting || !exportList.length || !filename.trim()}
            className="w-full py-3 text-sm bg-primary text-white rounded-[8px] font-medium active:scale-[0.98] transition-transform disabled:opacity-50"
          >
            {exporting
              ? (lang === 'en' ? 'Exporting…' : 'Exportation…')
              : (lang === 'en' ? `Export ${exportList.length} receipt${exportList.length !== 1 ? 's' : ''}` : `Exporter ${exportList.length} reçu${exportList.length !== 1 ? 's' : ''}`)}
          </button>
        </>
      )}
    </div>
  )
}

function ScopeRow({ selected, onClick, label, count, lang, disabled, hint }) {
  return (
    <button
      onClick={!disabled ? onClick : undefined}
      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${disabled ? 'opacity-40 cursor-default' : 'hover:bg-background'}`}
    >
      <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${selected && !disabled ? 'border-primary bg-primary' : 'border-border'}`}>
        {selected && !disabled && <div className="w-full h-full rounded-full bg-white scale-[0.45]" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[#1A1A18]">{label}</p>
        {hint && <p className="text-xs text-muted">{hint}</p>}
      </div>
      {!hint && (
        <span className="text-xs text-muted flex-shrink-0">
          {count} {lang === 'en' ? (count !== 1 ? 'receipts' : 'receipt') : (count !== 1 ? 'reçus' : 'reçu')}
        </span>
      )}
    </button>
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
