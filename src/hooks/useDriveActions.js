import { useAuth } from './useAuth'

export function useDriveActions() {
  const { session } = useAuth()

  const call = (path, body) => {
    if (!session?.access_token) return
    fetch(path, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }).catch((e) => console.error(`Drive ${path}:`, e?.message))
  }

  return {
    // Legacy — kept for backward compatibility
    renameToFinal: (fileId) => call('/api/drive/rename', { fileId }),
    deleteFromDrive: (fileId) => call('/api/drive/delete-file', { fileId }),
    // New: rename + move to correct Account/Year/Category folder
    organizeFile: (receiptId) => call('/api/drive/organize', { receiptId }),
    // New: create or rename Drive folder for an account dimension
    syncDimensionFolder: (dimensionId, newName) =>
      call('/api/drive/sync-folder', { dimensionId, ...(newName ? { newName } : {}) }),
  }
}
