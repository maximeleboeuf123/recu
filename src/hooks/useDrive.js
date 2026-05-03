import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export function useDrive() {
  const { session } = useAuth()
  const [driveState, setDriveState] = useState(null) // null = not connected
  const [loading, setLoading] = useState(true)

  const userId = session?.user?.id

  const fetchDriveState = useCallback(async () => {
    if (!userId) { setLoading(false); return }

    const { data: userData } = await supabase
      .from('users')
      .select('drive_folder_id, drive_inbox_id, drive_token_active')
      .eq('id', userId)
      .single()

    if (!userData?.drive_folder_id || !userData?.drive_token_active) {
      setDriveState(null)
      setLoading(false)
      return
    }

    const [{ count: fileCount }, { data: lastRow }] = await Promise.all([
      supabase
        .from('receipts')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .not('drive_url', 'is', null),
      supabase
        .from('receipts')
        .select('confirmed_at')
        .eq('user_id', userId)
        .not('drive_url', 'is', null)
        .order('confirmed_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

    setDriveState({
      connected: true,
      folderId: userData.drive_folder_id,
      inboxId: userData.drive_inbox_id,
      fileCount: fileCount || 0,
      lastSync: lastRow?.confirmed_at || null,
      folderUrl: `https://drive.google.com/drive/folders/${userData.drive_folder_id}`,
    })
    setLoading(false)
  }, [userId])

  useEffect(() => { fetchDriveState() }, [fetchDriveState])

  return { driveState, loading, refresh: fetchDriveState }
}
