import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Search, BookOpen, SlidersHorizontal, X, Copy } from 'lucide-react'
import { useReceipts } from '../hooks/useReceipts'
import { usePatterns } from '../hooks/usePatterns'
import { useDriveActions } from '../hooks/useDriveActions'
import { useLedgerFilters } from '../context/LedgerFilterContext'
import { useDimensions } from '../context/DimensionsContext'
import ReviewCard from '../components/ReviewCard'

export default function LedgerPage() {
  const { t, i18n } = useTranslation()
  const { receipts, loading, updateReceipt, deleteReceipt, confirmReceipt, duplicateReceipt } = useReceipts()
  const { savePattern, applyPatternToPending } = usePatterns()
  const { organizeFile, deleteFromDrive, uploadFile } = useDriveActions()
  const { filters, setField, setSearch, resetFilters, activeCount } = useLedgerFilters()
  const { accountsWithCategories } = useDimensions()

  const [expandedId, setExpandedId] = useState(null)
  const [showFilters, setShowFilters] = useState(false)
  const [toast, setToast] = useState(null)

  const lang = i18n.language === 'en' ? 'en' : 'fr'

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const thisMonth = () => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  }

  const setThisMonth = () => {
    const now = new Date()
    const first = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    const lastStr = `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`
    setField('dateFrom', first)
    setField('dateTo', lastStr)
  }

  const filtered = useMemo(() => {
    let list = receipts.filter((r) => r.status !== 'deleted')

    if (filters.search.trim()) {
      const q = filters.search.toLowerCase()
      list = list.filter(
        (r) =>
          (r.vendor || '').toLowerCase().includes(q) ||
          (r.description || '').toLowerCase().includes(q) ||
          (r.invoice_number || '').toLowerCase().includes(q),
      )
    }

    if (filters.status !== 'all') {
      list = list.filter((r) => r.status === filters.status)
    }

    if (filters.dateFrom) {
      list = list.filter((r) => r.invoice_date >= filters.dateFrom)
    }
    if (filters.dateTo) {
      list = list.filter((r) => r.invoice_date <= filters.dateTo)
    }

    if (filters.vendor.trim()) {
      const q = filters.vendor.toLowerCase()
      list = list.filter((r) => (r.vendor || '').toLowerCase().includes(q))
    }

    if (filters.account) {
      list = list.filter((r) => r.labels?.property === filters.account)
    }

    if (filters.category) {
      list = list.filter((r) => r.labels?.category === filters.category)
    }

    if (filters.amountMin !== '') {
      list = list.filter((r) => r.total != null && r.total >= parseFloat(filters.amountMin))
    }
    if (filters.amountMax !== '') {
      list = list.filter((r) => r.total != null && r.total <= parseFloat(filters.amountMax))
    }

    return list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  }, [receipts, filters])

  const handleDelete = async (id) => {
    const receipt = receipts.find((r) => r.id === id)
    const ok = await deleteReceipt(id)
    if (!ok) return showToast(t('common.error'))
    if (receipt?.drive_file_id) deleteFromDrive(receipt.drive_file_id)
    setExpandedId(null)
    showToast(t('review.deleted'))
  }

  const handleSave = async (id, data, _recurring, patternInfo) => {
    const original = receipts.find((r) => r.id === id)
    const isApproval = original?.status === 'pending'
    const ok = isApproval
      ? await confirmReceipt(id, data)
      : await updateReceipt(id, data, original)
    if (!ok) return showToast(t('common.error'))

    if (original?.drive_file_id) organizeFile(original.id)

    if (data.vendor && data.labels) {
      const dimChanged =
        original?.labels?.category !== data.labels.category ||
        original?.labels?.property !== data.labels.property
      if (dimChanged) {
        await savePattern(data.vendor, data.labels)
        await applyPatternToPending(data.vendor, data.labels)
      }
    }

    setExpandedId(null)
    showToast(isApproval ? t('review.confirm_success', { count: 1 }) : t('common.save'))
  }

  const handleDuplicate = async (receipt) => {
    const ok = await duplicateReceipt(receipt)
    if (!ok) return showToast(t('common.error'))
    showToast(lang === 'en' ? 'Receipt duplicated' : 'Reçu dupliqué')
  }

  const handleReplaceFile = async (receiptId, file) => {
    const receipt = receipts.find((r) => r.id === receiptId)
    const uploaded = await uploadFile(file)
    if (!uploaded?.fileId) return showToast(t('common.error'))
    const oldFileId = receipt?.drive_file_id
    await updateReceipt(receiptId, { drive_file_id: uploaded.fileId, drive_url: uploaded.fileUrl, filename: file.name }, receipt)
    if (oldFileId) deleteFromDrive(oldFileId)
    organizeFile(receiptId)
    showToast(lang === 'en' ? 'File replaced' : 'Fichier remplacé')
  }

  // Category options filtered by selected account
  const selectedAccount = accountsWithCategories.find((a) => a.name === filters.account)
  const categoryOptions = selectedAccount
    ? selectedAccount.categories.map((c) => c.name)
    : accountsWithCategories.flatMap((a) => a.categories.map((c) => c.name))

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6 relative">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-[#1A1A18]">{t('ledger.title')}</h1>
        <Link to="/export" className="text-sm text-primary font-medium hover:underline">
          {t('ledger.export')}
        </Link>
      </div>

      {/* Search + filter toggle */}
      <div className="flex gap-2 mb-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
          <input
            type="search"
            value={filters.search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('ledger.search')}
            className="w-full pl-9 pr-4 py-2.5 bg-surface border border-border rounded-[8px] text-sm focus:outline-none focus:border-primary transition-colors"
          />
        </div>
        <button
          onClick={() => setShowFilters((v) => !v)}
          className={`relative flex items-center gap-1.5 px-3 py-2.5 rounded-[8px] border text-sm font-medium transition-colors ${
            showFilters || activeCount > 0
              ? 'bg-primary text-white border-primary'
              : 'bg-surface border-border text-muted hover:border-primary hover:text-primary'
          }`}
        >
          <SlidersHorizontal size={15} />
          {lang === 'en' ? 'Filters' : 'Filtres'}
          {activeCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-white text-primary text-[10px] font-bold flex items-center justify-center border border-primary">
              {activeCount}
            </span>
          )}
        </button>
      </div>

      {/* Status pills */}
      <div className="flex gap-2 mb-3">
        {(['all', 'pending', 'confirmed']).map((s) => (
          <button
            key={s}
            onClick={() => setField('status', s)}
            className={`px-3 py-1 rounded-full text-sm border transition-colors ${
              filters.status === s
                ? 'bg-primary text-white border-primary'
                : 'bg-surface border-border text-muted hover:border-primary hover:text-primary'
            }`}
          >
            {s === 'all' ? t('ledger.all') : s === 'pending' ? t('ledger.pending') : t('ledger.confirmed')}
          </button>
        ))}
        {activeCount > 0 && (
          <button
            onClick={resetFilters}
            className="ml-auto px-3 py-1 rounded-full text-sm border border-error/40 text-error hover:bg-error/10 transition-colors flex items-center gap-1"
          >
            <X size={11} />
            {lang === 'en' ? 'Clear' : 'Effacer'}
          </button>
        )}
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="mb-4 bg-surface border border-border rounded-[8px] p-4 space-y-4">
          {/* Date range */}
          <div>
            <p className="text-xs text-muted uppercase tracking-wide font-medium mb-2">
              {lang === 'en' ? 'Date range' : 'Période'}
            </p>
            <div className="flex gap-2 items-center mb-2">
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
            <button
              onClick={setThisMonth}
              className="text-xs text-primary hover:underline"
            >
              {t('ledger.this_month')}
            </button>
          </div>

          {/* Vendor */}
          <div>
            <p className="text-xs text-muted uppercase tracking-wide font-medium mb-2">
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

          {/* Account + Category */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-xs text-muted uppercase tracking-wide font-medium mb-2">
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
              <p className="text-xs text-muted uppercase tracking-wide font-medium mb-2">
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

          {/* Amount range */}
          <div>
            <p className="text-xs text-muted uppercase tracking-wide font-medium mb-2">
              {lang === 'en' ? 'Amount' : 'Montant'}
            </p>
            <div className="flex gap-2 items-center">
              <input
                type="number"
                min="0"
                step="0.01"
                value={filters.amountMin}
                onChange={(e) => setField('amountMin', e.target.value)}
                placeholder="Min"
                className="flex-1 text-sm bg-background border border-border rounded-[6px] px-3 py-2 focus:outline-none focus:border-primary transition-colors text-[#1A1A18] placeholder:text-muted"
              />
              <span className="text-xs text-muted flex-shrink-0">—</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={filters.amountMax}
                onChange={(e) => setField('amountMax', e.target.value)}
                placeholder="Max"
                className="flex-1 text-sm bg-background border border-border rounded-[6px] px-3 py-2 focus:outline-none focus:border-primary transition-colors text-[#1A1A18] placeholder:text-muted"
              />
            </div>
          </div>
        </div>
      )}

      {/* Results count */}
      {activeCount > 0 && (
        <p className="text-xs text-muted mb-3">
          {filtered.length} {lang === 'en' ? 'result(s)' : 'résultat(s)'}
        </p>
      )}

      {/* Receipts */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
          <BookOpen size={48} className="text-border" strokeWidth={1.5} />
          <p className="text-muted text-sm">{t('ledger.empty')}</p>
        </div>
      ) : (
        <div className="space-y-2 pb-6">
          {filtered.map((r) =>
            expandedId === r.id ? (
              <ReviewCard
                key={r.id}
                receipt={r}
                mode="ledger"
                onConfirm={handleSave}
                onClose={() => setExpandedId(null)}
                onDelete={handleDelete}
                onReplaceFile={(file) => handleReplaceFile(r.id, file)}
              />
            ) : (
              <LedgerRow key={r.id} receipt={r} onClick={() => setExpandedId(r.id)} onDuplicate={handleDuplicate} />
            ),
          )}
        </div>
      )}

      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-[#1A1A18] text-white px-5 py-2.5 rounded-full text-sm z-50 shadow-lg pointer-events-none">
          {toast}
        </div>
      )}
    </div>
  )
}

function LedgerRow({ receipt, onClick, onDuplicate }) {
  const isPending = receipt.status === 'pending'

  return (
    <div className="flex items-center bg-surface border border-border rounded-[8px] hover:border-primary/40 transition-colors">
      <div
        onClick={onClick}
        className="flex-1 min-w-0 flex items-center px-4 py-3 cursor-pointer active:scale-[0.99]"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-[#1A1A18] truncate">{receipt.vendor || receipt.description || '—'}</p>
            {isPending && (
              <span className="flex-shrink-0 text-[10px] bg-warning/20 text-warning rounded px-1.5 py-0.5 font-medium">
                En attente
              </span>
            )}
          </div>
          <p className="text-xs text-muted mt-0.5">
            {[receipt.invoice_date || '—', receipt.labels?.property, receipt.labels?.category].filter(Boolean).join(' · ')}
          </p>
        </div>
        <p className="text-sm font-semibold text-[#1A1A18] flex-shrink-0 ml-3">
          {receipt.total != null
            ? new Intl.NumberFormat('fr-CA', { style: 'currency', currency: receipt.currency || 'CAD' }).format(receipt.total)
            : '—'}
        </p>
      </div>
      {!isPending && (
        <button
          onClick={(e) => { e.stopPropagation(); onDuplicate?.(receipt) }}
          className="px-3 py-4 text-muted hover:text-primary transition-colors border-l border-border/60 flex-shrink-0"
          aria-label="Duplicate"
        >
          <Copy size={14} />
        </button>
      )}
    </div>
  )
}
