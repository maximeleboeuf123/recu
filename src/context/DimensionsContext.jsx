import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const DimensionsContext = createContext(null)

export function DimensionsProvider({ children }) {
  const { session } = useAuth()
  const [accountsWithCategories, setAccountsWithCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const userId = session?.user?.id

  const load = useCallback(async () => {
    if (!userId) { setLoading(false); return }
    const { data } = await supabase
      .from('dimensions')
      .select('id, type, name, parent_id, sort_order')
      .eq('user_id', userId)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true })
    if (data) {
      const accs = data.filter((d) => d.type === 'account')
      const cats = data.filter((d) => d.type === 'category')
      setAccountsWithCategories(
        accs.map((a) => ({
          id: a.id,
          name: a.name,
          categories: cats.filter((c) => c.parent_id === a.id).map((c) => ({ id: c.id, name: c.name })),
        }))
      )
    }
    setLoading(false)
  }, [userId])

  useEffect(() => { load() }, [load])

  const addAccount = useCallback(async (name) => {
    const { error } = await supabase.from('dimensions').insert({ user_id: userId, type: 'account', name: name.trim() })
    if (!error) await load()
    return !error
  }, [userId, load])

  const removeAccount = useCallback(async (id) => {
    // parent_id FK has ON DELETE CASCADE so child categories are removed automatically
    const { error } = await supabase.from('dimensions').delete().eq('id', id)
    if (!error) await load()
    return !error
  }, [load])

  const addCategory = useCallback(async (accountId, name) => {
    const { error } = await supabase.from('dimensions').insert({
      user_id: userId, type: 'category', name: name.trim(), parent_id: accountId,
    })
    if (!error) await load()
    return !error
  }, [userId, load])

  const removeCategory = useCallback(async (id) => {
    const { error } = await supabase.from('dimensions').delete().eq('id', id)
    if (!error) await load()
    return !error
  }, [load])

  // Creates an account (or reuses existing) and bulk-adds missing categories under it
  const applyPreset = useCallback(async (accountName, categoryNames) => {
    const existing = accountsWithCategories.find((a) => a.name === accountName)
    let accountId
    if (existing) {
      accountId = existing.id
    } else {
      const { data: acc, error } = await supabase
        .from('dimensions')
        .insert({ user_id: userId, type: 'account', name: accountName })
        .select('id')
        .single()
      if (error) return false
      accountId = acc.id
    }
    const existingNames = existing?.categories.map((c) => c.name) || []
    const toAdd = categoryNames.filter((n) => !existingNames.includes(n))
    if (toAdd.length > 0) {
      await supabase.from('dimensions').insert(
        toAdd.map((name) => ({ user_id: userId, type: 'category', name, parent_id: accountId }))
      )
    }
    await load()
    return true
  }, [userId, accountsWithCategories, load])

  return (
    <DimensionsContext.Provider value={{
      accountsWithCategories, loading,
      addAccount, removeAccount, addCategory, removeCategory, applyPreset,
    }}>
      {children}
    </DimensionsContext.Provider>
  )
}

export function useDimensions() {
  const ctx = useContext(DimensionsContext)
  if (!ctx) throw new Error('useDimensions must be used within DimensionsProvider')
  return ctx
}
