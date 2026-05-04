import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const ReceiptsContext = createContext(null)
const PAGE_SIZE = 500

export function ReceiptsProvider({ children }) {
  const { session } = useAuth()
  const [receipts, setReceipts] = useState([])
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(false)
  const [channelKey, setChannelKey] = useState(0)

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
      .limit(PAGE_SIZE)
      .then(({ data }) => {
        setReceipts(data || [])
        setHasMore((data?.length ?? 0) >= PAGE_SIZE)
        setLoading(false)
      })
  }, [userId])

  const refresh = useCallback(() => {
    if (!userId) return Promise.resolve()
    return supabase
      .from('receipts')
      .select('*')
      .eq('user_id', userId)
      .neq('status', 'deleted')
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE)
      .then(({ data }) => {
        if (data) {
          setReceipts(data)
          setHasMore(data.length >= PAGE_SIZE)
        }
      })
  }, [userId])

  const loadMore = useCallback(() => {
    if (!userId || !hasMore) return Promise.resolve()
    const oldest = receipts[receipts.length - 1]?.created_at
    if (!oldest) return Promise.resolve()
    return supabase
      .from('receipts')
      .select('*')
      .eq('user_id', userId)
      .neq('status', 'deleted')
      .order('created_at', { ascending: false })
      .lt('created_at', oldest)
      .limit(PAGE_SIZE)
      .then(({ data }) => {
        if (data?.length) {
          setReceipts((prev) => [...prev, ...data])
          setHasMore(data.length >= PAGE_SIZE)
        } else {
          setHasMore(false)
        }
      })
  }, [userId, hasMore, receipts])

  // Re-fetch when the tab becomes visible again. Delay 800ms so the network
  // has time to wake before we fire the request (mobile backgrounding).
  useEffect(() => {
    let timer
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        timer = setTimeout(() => refresh(), 800)
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      clearTimeout(timer)
    }
  }, [refresh])

  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel(`receipts:${userId}:${channelKey}`)
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
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          refresh()
          setTimeout(() => setChannelKey((k) => k + 1), 5000)
        }
      })

    return () => supabase.removeChannel(channel)
  }, [userId, channelKey, refresh])

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

    // Optimistic update so the UI reflects immediately (real-time may be down on mobile)
    setReceipts((prev) => prev.map((r) => r.id === id ? { ...r, ...data } : r))

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
    if (error) {
      console.error('updateReceipt:', error.message)
      setReceipts((prev) => prev.map((r) => r.id === id ? { ...r, ...previousData } : r))
    }
    return !error
  }, [])

  const deleteReceipt = useCallback(async (id) => {
    setReceipts((prev) => prev.filter((r) => r.id !== id))
    const { error } = await supabase
      .from('receipts')
      .update({ status: 'deleted' })
      .eq('id', id)
    if (error) console.error('deleteReceipt:', error.message)
    return !error
  }, [])

  const duplicateReceipt = useCallback(async (receipt) => {
    const { data: newRow, error } = await supabase.from('receipts').insert({
      user_id: receipt.user_id,
      status: 'confirmed',
      source: 'manual',
      vendor: receipt.vendor,
      invoice_date: receipt.invoice_date,
      invoice_number: receipt.invoice_number,
      description: receipt.description,
      keyword: receipt.keyword,
      subtotal: receipt.subtotal,
      gst: receipt.gst,
      qst: receipt.qst,
      hst: receipt.hst,
      total: receipt.total,
      currency: receipt.currency || 'CAD',
      currency_original: receipt.currency_original,
      amount_original: receipt.amount_original,
      vendor_gst_number: receipt.vendor_gst_number,
      vendor_qst_number: receipt.vendor_qst_number,
      vendor_neq: receipt.vendor_neq,
      vendor_bn: receipt.vendor_bn,
      labels: receipt.labels || {},
      confidence_scores: {},
      extracted_raw: {},
      edit_history: [],
    }).select().single()
    if (error) { console.error('duplicateReceipt:', error.message); return false }
    setReceipts((prev) => [newRow, ...prev])

    // Copy the Drive file if the original has one
    if (receipt.drive_file_id && session?.access_token) {
      fetch('/api/drive/copy-file', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sourceFileId: receipt.drive_file_id, targetReceiptId: newRow.id }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.fileId) {
            setReceipts((prev) =>
              prev.map((r) =>
                r.id === newRow.id
                  ? { ...r, drive_file_id: data.fileId, drive_url: data.fileUrl }
                  : r
              )
            )
            // Move the copied file to the correct Account/Year/Category folder
            fetch('/api/drive/organize', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${session.access_token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ receiptId: newRow.id }),
            }).catch(() => {})
          }
        })
        .catch(() => {})
    }

    return true
  }, [session])

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
        hasMore,
        confirmReceipt,
        updateReceipt,
        deleteReceipt,
        duplicateReceipt,
        createRecurringEntry,
        refresh,
        loadMore,
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
