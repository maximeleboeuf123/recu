import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const DimensionsContext = createContext(null)

export function DimensionsProvider({ children }) {
  const { session } = useAuth()
  const [accounts, setAccounts] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const userId = session?.user?.id

  const load = useCallback(async () => {
    if (!userId) { setLoading(false); return }
    const { data } = await supabase
      .from('dimensions')
      .select('id, type, name, sort_order')
      .eq('user_id', userId)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true })
    if (data) {
      setAccounts(data.filter((d) => d.type === 'account').map((d) => d.name))
      setCategories(data.filter((d) => d.type === 'category').map((d) => d.name))
    }
    setLoading(false)
  }, [userId])

  useEffect(() => { load() }, [load])

  const add = useCallback(async (type, name) => {
    const trimmed = name.trim()
    if (!trimmed) return false
    const { error } = await supabase.from('dimensions').insert({ user_id: userId, type, name: trimmed })
    if (!error) await load()
    return !error
  }, [userId, load])

  const remove = useCallback(async (type, name) => {
    const { error } = await supabase.from('dimensions')
      .delete()
      .eq('user_id', userId)
      .eq('type', type)
      .eq('name', name)
    if (!error) await load()
    return !error
  }, [userId, load])

  const applyPreset = useCallback(async (type, names) => {
    const existing = type === 'account' ? accounts : categories
    const toAdd = names.filter((n) => !existing.includes(n))
    if (toAdd.length === 0) return true
    const { error } = await supabase.from('dimensions').insert(
      toAdd.map((name) => ({ user_id: userId, type, name }))
    )
    if (!error) await load()
    return !error
  }, [userId, accounts, categories, load])

  return (
    <DimensionsContext.Provider value={{ accounts, categories, loading, add, remove, applyPreset }}>
      {children}
    </DimensionsContext.Provider>
  )
}

export function useDimensions() {
  const ctx = useContext(DimensionsContext)
  if (!ctx) throw new Error('useDimensions must be used within DimensionsProvider')
  return ctx
}
