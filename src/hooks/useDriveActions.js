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

  // Awaitable upload — returns { fileId, fileUrl } or null
  const uploadFile = async (file) => {
    if (!session?.access_token || !file) return null
    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          const result = reader.result
          const comma = result.indexOf(',')
          resolve(comma >= 0 ? result.slice(comma + 1) : result)
        }
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      const res = await fetch('/api/drive/upload', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fileBase64: base64, mimeType: file.type, filename: file.name }),
      })
      if (!res.ok) return null
      return res.json()
    } catch (e) {
      console.error('uploadFile:', e?.message)
      return null
    }
  }

  return {
    renameToFinal: (fileId) => call('/api/drive/rename', { fileId }),
    deleteFromDrive: (fileId) => call('/api/drive/delete-file', { fileId }),
    organizeFile: (receiptId) => call('/api/drive/organize', { receiptId }),
    syncDimensionFolder: (dimensionId, newName) =>
      call('/api/drive/sync-folder', { dimensionId, ...(newName ? { newName } : {}) }),
    uploadFile,
  }
}
