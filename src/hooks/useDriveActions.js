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
    renameToFinal: (fileId) => call('/api/drive/rename', { fileId }),
    deleteFromDrive: (fileId) => call('/api/drive/delete-file', { fileId }),
  }
}
