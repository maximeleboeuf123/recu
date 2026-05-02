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

    const allData = data || []
    const accs = allData.filter((d) => d.type === 'account')
    const cats = allData.filter((d) => d.type === 'category')
    setAccountsWithCategories(
      accs.map((a) => ({
        id: a.id,
        name: a.name,
        categories: cats.filter((c) => c.parent_id === a.id).map((c) => ({ id: c.id, name: c.name })),
      }))
    )
    setLoading(false)

    // First login: if no accounts exist, create a default one
    if (accs.length === 0) {
      const { data: userData } = await supabase
        .from('users')
        .select('language')
        .eq('id', userId)
        .single()
      const defaultName = userData?.language === 'en' ? 'Personal' : 'Personnel'
      const { error: insertError } = await supabase
        .from('dimensions')
        .insert({ user_id: userId, type: 'account', name: defaultName })
      if (!insertError) {
        // Re-load to get the real ID
        load()
      }
    }
  }, [userId]) // eslint-disable-line react-hooks/exhaustive-deps

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

    // Fire-and-forget: create Drive folder for this account
    if (session?.access_token) {
      fetch('/api/drive/sync-folder', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ dimensionId: data.id }),
      }).catch(() => {})
    }

    return true
  }, [userId, session])

  // --- removeAccount: optimistic, restore on failure, cascade-clear receipts ---
  const removeAccount = useCallback(async (id) => {
    const snapshot = accountsWithCategories.find((a) => a.id === id)
    if (!snapshot) return false
    const accountName = snapshot.name
    const categoryNames = new Set(snapshot.categories.map((c) => c.name))

    setAccountsWithCategories((prev) => prev.filter((a) => a.id !== id))

    const { error } = await supabase.from('dimensions').delete().eq('id', id)
    if (error) {
      console.error('removeAccount:', error.message)
      setAccountsWithCategories((prev) => [...prev, snapshot])
      return false
    }

    // Cascade: clear account + matching category from receipts
    const { data: affected } = await supabase
      .from('receipts').select('id, labels').eq('user_id', userId).filter('labels->>property', 'eq', accountName)
    if (affected?.length) {
      await Promise.all(affected.map((r) =>
        supabase.from('receipts').update({
          labels: { ...r.labels, property: null, category: categoryNames.has(r.labels?.category) ? null : r.labels?.category },
        }).eq('id', r.id)
      ))
    }
    return true
  }, [accountsWithCategories, userId])

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

    // Fire-and-forget: create the category folder in Drive under the current year
    if (session?.access_token) {
      fetch('/api/drive/sync-dimensions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      }).catch(() => {})
    }

    return true
  }, [userId, session])

  // --- removeCategory: optimistic, cascade-clear receipts ---
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

    // Cascade: clear category from receipts
    if (removed) {
      const { data: affected } = await supabase
        .from('receipts').select('id, labels').eq('user_id', userId).filter('labels->>category', 'eq', removed.name)
      if (affected?.length) {
        await Promise.all(affected.map((r) =>
          supabase.from('receipts').update({ labels: { ...r.labels, category: null } }).eq('id', r.id)
        ))
      }
    }
    return true
  }, [userId])

  // --- renameAccount: update dimension + cascade to receipts labels.property ---
  const renameAccount = useCallback(async (id, newName) => {
    const trimmed = newName.trim()
    if (!trimmed || !userId) return false
    const account = accountsWithCategories.find((a) => a.id === id)
    if (!account || account.name === trimmed) return false
    const oldName = account.name

    setAccountsWithCategories((prev) =>
      prev.map((a) => (a.id === id ? { ...a, name: trimmed } : a))
    )

    const { error } = await supabase.from('dimensions').update({ name: trimmed }).eq('id', id)
    if (error) {
      console.error('renameAccount:', error.message)
      setAccountsWithCategories((prev) =>
        prev.map((a) => (a.id === id ? { ...a, name: oldName } : a))
      )
      return false
    }

    // Cascade: patch receipts where labels.property === oldName
    const { data: affected } = await supabase
      .from('receipts')
      .select('id, labels')
      .eq('user_id', userId)
      .filter('labels->>property', 'eq', oldName)
    if (affected?.length) {
      await Promise.all(
        affected.map((r) =>
          supabase.from('receipts').update({ labels: { ...r.labels, property: trimmed } }).eq('id', r.id)
        )
      )
    }

    // Fire-and-forget: rename Drive folder for this account
    if (session?.access_token) {
      fetch('/api/drive/sync-folder', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ dimensionId: id, newName: trimmed }),
      }).catch(() => {})
    }

    return true
  }, [userId, accountsWithCategories, session])

  // --- renameCategory: update dimension + cascade to receipts labels.category ---
  const renameCategory = useCallback(async (id, newName) => {
    const trimmed = newName.trim()
    if (!trimmed || !userId) return false
    let oldName = null
    for (const acc of accountsWithCategories) {
      const cat = acc.categories.find((c) => c.id === id)
      if (cat) { oldName = cat.name; break }
    }
    if (!oldName || oldName === trimmed) return false

    setAccountsWithCategories((prev) =>
      prev.map((a) => ({
        ...a,
        categories: a.categories.map((c) => (c.id === id ? { ...c, name: trimmed } : c)),
      }))
    )

    const { error } = await supabase.from('dimensions').update({ name: trimmed }).eq('id', id)
    if (error) {
      console.error('renameCategory:', error.message)
      setAccountsWithCategories((prev) =>
        prev.map((a) => ({
          ...a,
          categories: a.categories.map((c) => (c.id === id ? { ...c, name: oldName } : c)),
        }))
      )
      return false
    }

    // Cascade: patch receipts where labels.category === oldName
    const { data: affected } = await supabase
      .from('receipts')
      .select('id, labels')
      .eq('user_id', userId)
      .filter('labels->>category', 'eq', oldName)
    if (affected?.length) {
      await Promise.all(
        affected.map((r) =>
          supabase.from('receipts').update({ labels: { ...r.labels, category: trimmed } }).eq('id', r.id)
        )
      )
    }
    return true
  }, [userId, accountsWithCategories])

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

      // Fire-and-forget: create Drive folder for the new account
      if (session?.access_token) {
        fetch('/api/drive/sync-folder', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ dimensionId: accountId }),
        }).catch(() => {})
      }
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
  }, [userId, accountsWithCategories, session])

  return (
    <DimensionsContext.Provider value={{
      accountsWithCategories, loading,
      addAccount, removeAccount, addCategory, removeCategory, renameAccount, renameCategory, applyPreset,
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
