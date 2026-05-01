import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const DimensionsContext = createContext(null)

const tempId = () => `__tmp_${Math.random().toString(36).slice(2)}`

export function DimensionsProvider({ children }) {
  const { session } = useAuth()
  const [accountsWithCategories, setAccountsWithCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const userId = session?.user?.id

  const load = useCallback(async () => {
    if (!userId) { setLoading(false); return }
    const { data, error } = await supabase
      .from('dimensions')
      .select('id, type, name, parent_id, sort_order')
      .eq('user_id', userId)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true })
    if (error) {
      console.error('DimensionsContext load:', error.message, '— did you run the parent_id migration?')
      setLoading(false)
      return
    }
    const accs = (data || []).filter((d) => d.type === 'account')
    const cats = (data || []).filter((d) => d.type === 'category')
    setAccountsWithCategories(
      accs.map((a) => ({
        id: a.id,
        name: a.name,
        categories: cats.filter((c) => c.parent_id === a.id).map((c) => ({ id: c.id, name: c.name })),
      }))
    )
    setLoading(false)
  }, [userId])

  useEffect(() => { load() }, [load])

  // --- addAccount: optimistic, swap temp id for real on success ---
  const addAccount = useCallback(async (name) => {
    const trimmed = name.trim()
    if (!trimmed || !userId) return false
    const tid = tempId()
    setAccountsWithCategories((prev) => [...prev, { id: tid, name: trimmed, categories: [] }])

    const { data, error } = await supabase
      .from('dimensions')
      .insert({ user_id: userId, type: 'account', name: trimmed })
      .select('id')
      .single()

    if (error || !data) {
      console.error('addAccount:', error?.message)
      setAccountsWithCategories((prev) => prev.filter((a) => a.id !== tid))
      return false
    }
    setAccountsWithCategories((prev) =>
      prev.map((a) => (a.id === tid ? { ...a, id: data.id } : a))
    )
    return true
  }, [userId])

  // --- removeAccount: optimistic, restore on failure ---
  const removeAccount = useCallback(async (id) => {
    const snapshot = accountsWithCategories.find((a) => a.id === id)
    setAccountsWithCategories((prev) => prev.filter((a) => a.id !== id))

    const { error } = await supabase.from('dimensions').delete().eq('id', id)
    if (error) {
      console.error('removeAccount:', error.message)
      if (snapshot) setAccountsWithCategories((prev) => [...prev, snapshot])
      return false
    }
    return true
  }, [accountsWithCategories])

  // --- addCategory: optimistic under the right account ---
  const addCategory = useCallback(async (accountId, name) => {
    const trimmed = name.trim()
    if (!trimmed || !userId) return false
    const tid = tempId()
    setAccountsWithCategories((prev) =>
      prev.map((a) =>
        a.id === accountId ? { ...a, categories: [...a.categories, { id: tid, name: trimmed }] } : a
      )
    )

    const { data, error } = await supabase
      .from('dimensions')
      .insert({ user_id: userId, type: 'category', name: trimmed, parent_id: accountId })
      .select('id')
      .single()

    if (error || !data) {
      console.error('addCategory:', error?.message)
      setAccountsWithCategories((prev) =>
        prev.map((a) =>
          a.id === accountId ? { ...a, categories: a.categories.filter((c) => c.id !== tid) } : a
        )
      )
      return false
    }
    setAccountsWithCategories((prev) =>
      prev.map((a) =>
        a.id === accountId
          ? { ...a, categories: a.categories.map((c) => (c.id === tid ? { ...c, id: data.id } : c)) }
          : a
      )
    )
    return true
  }, [userId])

  // --- removeCategory: optimistic ---
  const removeCategory = useCallback(async (categoryId) => {
    let ownerAccountId, removed
    setAccountsWithCategories((prev) =>
      prev.map((a) => {
        const cat = a.categories.find((c) => c.id === categoryId)
        if (cat) { ownerAccountId = a.id; removed = cat }
        return { ...a, categories: a.categories.filter((c) => c.id !== categoryId) }
      })
    )

    const { error } = await supabase.from('dimensions').delete().eq('id', categoryId)
    if (error) {
      console.error('removeCategory:', error.message)
      if (ownerAccountId && removed) {
        setAccountsWithCategories((prev) =>
          prev.map((a) =>
            a.id === ownerAccountId ? { ...a, categories: [...a.categories, removed] } : a
          )
        )
      }
      return false
    }
    return true
  }, [])

  // --- applyPreset: targetAccountId=null → create new account with accountName ---
  const applyPreset = useCallback(async (targetAccountId, accountName, categoryNames) => {
    let accountId = targetAccountId
    let isNew = false

    if (!accountId) {
      // Create new account
      const { data: acc, error } = await supabase
        .from('dimensions')
        .insert({ user_id: userId, type: 'account', name: accountName })
        .select('id')
        .single()
      if (error || !acc) { console.error('applyPreset create account:', error?.message); return false }
      accountId = acc.id
      isNew = true
      setAccountsWithCategories((prev) => [...prev, { id: accountId, name: accountName, categories: [] }])
    }

    const targetAcc = accountsWithCategories.find((a) => a.id === accountId)
    const existingNames = targetAcc?.categories.map((c) => c.name) || []
    const toAdd = categoryNames.filter((n) => !existingNames.includes(n))

    if (toAdd.length > 0) {
      const { data: inserted, error } = await supabase
        .from('dimensions')
        .insert(toAdd.map((name) => ({ user_id: userId, type: 'category', name, parent_id: accountId })))
        .select('id, name')

      if (error || !inserted) {
        console.error('applyPreset insert categories:', error?.message)
        if (isNew) setAccountsWithCategories((prev) => prev.filter((a) => a.id !== accountId))
        return false
      }

      setAccountsWithCategories((prev) =>
        prev.map((a) =>
          a.id === accountId
            ? { ...a, categories: [...a.categories, ...inserted.map((r) => ({ id: r.id, name: r.name }))] }
            : a
        )
      )
    }

    return true
  }, [userId, accountsWithCategories])

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
