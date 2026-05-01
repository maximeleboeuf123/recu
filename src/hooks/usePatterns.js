import { useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import { normalizeVendor, fuzzyMatch } from '../lib/utils'

export function usePatterns() {
  const { session } = useAuth()
  const userId = session?.user?.id

  const savePattern = useCallback(
    async (vendorName, labels) => {
      if (!userId || !vendorName) return
      const { error } = await supabase.from('patterns').upsert(
        { user_id: userId, vendor_name: vendorName, ...labels, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,vendor_name' },
      )
      if (error) console.error('savePattern:', error.message)
    },
    [userId],
  )

  // After updating a pattern, propagate new labels to all pending receipts from same vendor
  const applyPatternToPending = useCallback(
    async (vendorName, labels) => {
      if (!userId || !vendorName) return
      const { data: pending } = await supabase
        .from('receipts')
        .select('id, vendor')
        .eq('user_id', userId)
        .eq('status', 'pending')

      if (!pending?.length) return
      const vNorm = normalizeVendor(vendorName)
      const ids = pending
        .filter((r) => fuzzyMatch(normalizeVendor(r.vendor || ''), vNorm))
        .map((r) => r.id)
      if (!ids.length) return

      await supabase.from('receipts').update(labels).in('id', ids)
    },
    [userId],
  )

  return { savePattern, applyPatternToPending }
}
