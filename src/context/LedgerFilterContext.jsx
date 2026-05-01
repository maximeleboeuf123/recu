import { createContext, useContext, useState, useCallback, useMemo } from 'react'

const Ctx = createContext(null)

const INITIAL = {
  search: '',
  status: 'all',    // 'all' | 'pending' | 'confirmed'
  dateFrom: '',
  dateTo: '',
  vendor: '',
  account: '',
  category: '',
  amountMin: '',
  amountMax: '',
}

export function LedgerFilterProvider({ children }) {
  const [filters, setFilters] = useState(INITIAL)

  const setField = useCallback((key, val) => setFilters((p) => ({ ...p, [key]: val })), [])
  const setSearch = useCallback((v) => setField('search', v), [setField])
  const resetFilters = useCallback(() => setFilters(INITIAL), [])

  const activeCount = useMemo(() => [
    filters.status !== 'all',
    !!filters.dateFrom || !!filters.dateTo,
    !!filters.vendor,
    !!filters.account,
    !!filters.category,
    !!filters.amountMin || !!filters.amountMax,
  ].filter(Boolean).length, [filters])

  return (
    <Ctx.Provider value={{ filters, setField, setSearch, resetFilters, activeCount }}>
      {children}
    </Ctx.Provider>
  )
}

export function useLedgerFilters() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useLedgerFilters must be used within LedgerFilterProvider')
  return ctx
}
