import { createContext, useContext, useState, useCallback } from 'react'

const Ctx = createContext(null)

const INITIAL = { search: '', activeChip: 0, vendor: '', category: '' }

export function LedgerFilterProvider({ children }) {
  const [filters, setFilters] = useState(INITIAL)

  const setSearch = useCallback((search) => setFilters((p) => ({ ...p, search })), [])
  const setChip = useCallback((activeChip) => setFilters((p) => ({ ...p, activeChip })), [])
  const setVendor = useCallback((vendor) => setFilters((p) => ({ ...p, vendor })), [])
  const setCategory = useCallback((category) => setFilters((p) => ({ ...p, category })), [])
  const resetFilters = useCallback(() => setFilters(INITIAL), [])

  return (
    <Ctx.Provider value={{ filters, setSearch, setChip, setVendor, setCategory, resetFilters }}>
      {children}
    </Ctx.Provider>
  )
}

export function useLedgerFilters() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useLedgerFilters must be used within LedgerFilterProvider')
  return ctx
}
