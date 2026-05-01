import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const ReceiptsContext = createContext(null)

export function ReceiptsProvider({ children }) {
  const { session } = useAuth()
  const [receipts, setReceipts] = useState([])
  const [loading, setLoading] = useState(true)

  const userId = session?.user?.id

  useEffect(() => {
    if (!userId) {
      setReceipts([])
      setLoading(false)
      return
    }

    setLoading(true)
    supabase
      .from('receipts')
      .select('*')
      .eq('user_id', userId)
      .neq('status', 'deleted')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setReceipts(data || [])
        setLoading(false)
      })
  }, [userId])

  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel(`receipts:${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'receipts', filter: `user_id=eq.${userId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setReceipts((prev) => [payload.new, ...prev])
          } else if (payload.eventType === 'UPDATE') {
            if (payload.new.status === 'deleted') {
              setReceipts((prev) => prev.filter((r) => r.id !== payload.new.id))
            } else {
              setReceipts((prev) => prev.map((r) => (r.id === payload.new.id ? payload.new : r)))
            }
          }
        },
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [userId])

  const confirmReceipt = useCallback(async (id, data) => {
    setReceipts((prev) => prev.map((r) => r.id === id ? { ...r, ...data, status: 'confirmed' } : r))
    const { error } = await supabase
      .from('receipts')
      .update({ ...data, status: 'confirmed' })
      .eq('id', id)
    if (error) {
      console.error('confirmReceipt:', error.message)
      setReceipts((prev) => prev.map((r) => r.id === id ? { ...r, status: 'pending' } : r))
    }
    return !error
  }, [])

  const updateReceipt = useCallback(async (id, data, previousData) => {
    const changes = Object.entries(data).reduce((acc, [key, val]) => {
      if (previousData?.[key] !== val) acc[key] = { from: previousData?.[key], to: val }
      return acc
    }, {})

    if (!Object.keys(changes).length) return true

    const { data: existing } = await supabase
      .from('receipts')
      .select('edit_history')
      .eq('id', id)
      .single()

    const history = [
      ...(existing?.edit_history || []),
      { edited_at: new Date().toISOString(), changes },
    ]

    const { error } = await supabase
      .from('receipts')
      .update({ ...data, edit_history: history })
      .eq('id', id)
    if (error) console.error('updateReceipt:', error.message)
    return !error
  }, [])

  const deleteReceipt = useCallback(async (id) => {
    const { error } = await supabase
      .from('receipts')
      .update({ status: 'deleted' })
      .eq('id', id)
    if (error) console.error('deleteReceipt:', error.message)
    return !error
  }, [])

  const createRecurringEntry = useCallback(
    async (_receiptId, recurringData, receiptData) => {
      const { error } = await supabase.from('recurring_entries').insert({
        user_id: userId,
        vendor: receiptData.vendor || '',
        labels: receiptData.labels || {},
        frequency: recurringData.frequency,
        interval: recurringData.interval,
        start_date: recurringData.start_date,
        end_date: recurringData.end_date || null,
        amount_type: recurringData.amount_type,
        amount: receiptData.total ?? null,
        source: 'manual',
        active: true,
      })
      if (error) console.error('createRecurringEntry:', error.message)
      return !error
    },
    [userId],
  )

  const pendingReceipts = receipts.filter((r) => r.status === 'pending')

  return (
    <ReceiptsContext.Provider
      value={{
        receipts,
        pendingReceipts,
        pendingCount: pendingReceipts.length,
        loading,
        confirmReceipt,
        updateReceipt,
        deleteReceipt,
        createRecurringEntry,
      }}
    >
      {children}
    </ReceiptsContext.Provider>
  )
}

export function useReceipts() {
  const ctx = useContext(ReceiptsContext)
  if (!ctx) throw new Error('useReceipts must be used within ReceiptsProvider')
  return ctx
}
