import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Folder, FolderPlus, X } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

export default function FolderPicker({ receipt, onClose }) {
  const { t } = useTranslation()
  const { session } = useAuth()
  const [folders, setFolders] = useState([])
  const [loading, setLoading] = useState(true)
  const [copying, setCopying] = useState(false)
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch('/api/drive/folders', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        setFolders(data.folders || [])
        setLoading(false)
      })
      .catch(() => {
        setError('drive_error')
        setLoading(false)
      })
  }, [session])

  const handleCopy = async (folderId, folderName) => {
    setCopying(true)
    try {
      const res = await fetch('/api/drive/copy', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ receiptId: receipt.id, folderId: folderId || null, folderName }),
      })
      if (!res.ok) throw new Error('copy failed')
      onClose(folderName)
    } catch {
      setError('copy_failed')
    } finally {
      setCopying(false)
    }
  }

  const handleNewFolder = () => {
    const name = newFolderName.trim()
    if (!name) return
    handleCopy(null, name)
  }

  // Visually separate _Factures and _Exports from user folders
  const systemFolders = folders.filter((f) => f.name === '_Factures' || f.name === '_Exports')
  const userFolders = folders.filter((f) => f.name !== '_Factures' && f.name !== '_Exports')

  return (
    <div className="fixed inset-0 bg-black/50 z-[300] flex items-end sm:items-center justify-center p-4">
      <div className="bg-surface rounded-t-[16px] sm:rounded-[12px] w-full max-w-md flex flex-col max-h-[75vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-border">
          <p className="font-semibold text-[#1A1A18]">{t('drive.copy_to_folder')}</p>
          <button onClick={() => onClose(null)} className="text-muted hover:text-primary p-1">
            <X size={18} />
          </button>
        </div>

        {/* Folder list */}
        <div className="overflow-y-auto flex-1 py-2">
          {loading ? (
            <div className="flex justify-center py-10">
              <div className="w-6 h-6 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : error ? (
            <p className="text-center text-sm text-muted py-8">{t('common.error')}</p>
          ) : (
            <>
              {/* System folders (grayed out) */}
              {systemFolders.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center gap-3 px-5 py-3 text-sm text-muted cursor-not-allowed"
                >
                  <Folder size={16} className="flex-shrink-0" />
                  <span>{f.name}</span>
                  {f.name === '_Factures' && (
                    <span className="ml-auto text-xs bg-primary/10 text-primary rounded px-1.5 py-0.5">
                      source
                    </span>
                  )}
                </div>
              ))}

              {/* User folders */}
              {userFolders.map((f) => (
                <button
                  key={f.id}
                  onClick={() => !copying && handleCopy(f.id, f.name)}
                  disabled={copying}
                  className="w-full flex items-center gap-3 px-5 py-3 text-sm text-[#1A1A18] hover:bg-background transition-colors disabled:opacity-50"
                >
                  <Folder size={16} className="text-primary flex-shrink-0" />
                  <span>{f.name}</span>
                </button>
              ))}

              {userFolders.length === 0 && !loading && (
                <p className="text-center text-xs text-muted py-4">
                  Aucun dossier — créez-en un ci-dessous
                </p>
              )}

              {/* New folder */}
              {showNewFolder ? (
                <div className="flex items-center gap-2 px-5 py-3">
                  <FolderPlus size={16} className="text-primary flex-shrink-0" />
                  <input
                    autoFocus
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleNewFolder()}
                    placeholder="Nom du dossier..."
                    className="flex-1 text-sm bg-background border border-primary rounded-[6px] px-3 py-1.5 focus:outline-none"
                  />
                  <button
                    onClick={handleNewFolder}
                    disabled={!newFolderName.trim() || copying}
                    className="text-primary text-sm font-medium px-2 py-1 disabled:opacity-40"
                  >
                    OK
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowNewFolder(true)}
                  className="w-full flex items-center gap-3 px-5 py-3 text-sm text-primary hover:bg-background transition-colors"
                >
                  <FolderPlus size={16} className="flex-shrink-0" />
                  {t('drive.new_folder')}
                </button>
              )}
            </>
          )}
        </div>

        {/* Cancel */}
        <div className="px-5 py-4 border-t border-border">
          <button
            onClick={() => onClose(null)}
            className="w-full text-sm text-muted py-1"
          >
            {t('common.cancel')}
          </button>
        </div>
      </div>
    </div>
  )
}
