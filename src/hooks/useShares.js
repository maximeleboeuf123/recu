import { useState, useEffect, useCallback } from 'react'
import { useAuth } from './useAuth'

export function useShares() {
  const { session } = useAuth()
  const [owned, setOwned] = useState([])
  const [received, setReceived] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchShares = useCallback(async () => {
    if (!session?.access_token) return
    try {
      const res = await fetch('/api/shares', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!res.ok) return
      const data = await res.json()
      setOwned(data.owned || [])
      setReceived(data.received || [])
    } finally {
      setLoading(false)
    }
  }, [session?.access_token])

  useEffect(() => { fetchShares() }, [fetchShares])

  const createShare = useCallback(async (account_name, shared_with_email, permission = 'edit') => {
    try {
      const res = await fetch('/api/shares', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ account_name, shared_with_email, permission }),
      })
      const data = await res.json()
      if (!res.ok) return { error: data.error || 'unknown' }
      setOwned(prev => [data.share, ...prev])
      return { share: data.share }
    } catch {
      return { error: 'network_error' }
    }
  }, [session?.access_token])

  const revokeShare = useCallback(async (id) => {
    await fetch(`/api/shares?id=${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    setOwned(prev => prev.filter(s => s.id !== id))
  }, [session?.access_token])

  return { owned, received, loading, createShare, revokeShare, refresh: fetchShares }
}
