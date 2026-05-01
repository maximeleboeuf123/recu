import { useRef, useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { FileText } from 'lucide-react'
import { compressImage } from '../lib/imageUtils'

function isPdf(file) {
  return file.type === 'application/pdf'
}

export default function UploadCapture({ onSubmit, onClose, initialFiles }) {
  const { t } = useTranslation()
  const inputRef = useRef(null)
  const [groupPrompt, setGroupPrompt] = useState(null) // { files, previews }
  const [processing, setProcessing] = useState(false)

  // If initialFiles provided (from drag-and-drop), process them directly
  useEffect(() => {
    if (initialFiles?.length) {
      processFiles(Array.from(initialFiles))
    } else {
      inputRef.current?.click()
    }
  }, [])

  const handleFileInput = (e) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return onClose()
    processFiles(files)
  }

  const processFiles = (files) => {
    const imageFiles = files.filter((f) => !isPdf(f))
    const pdfFiles = files.filter(isPdf)

    if (pdfFiles.length > 0) {
      // PDFs always processed independently
      const pdfs = pdfFiles.map((f) => [f])
      const images = imageFiles.length > 1 ? null : imageFiles.length === 1 ? [[imageFiles[0]]] : []
      handleGroups([...pdfs, ...(images || [])])
      if (imageFiles.length > 1) {
        // Show grouping prompt for images while PDFs are already queued
        showGroupPrompt(imageFiles)
      }
      return
    }

    if (imageFiles.length > 1) {
      showGroupPrompt(imageFiles)
      return
    }

    if (imageFiles.length === 1) {
      handleGroups([[imageFiles[0]]])
    }
  }

  const showGroupPrompt = (imageFiles) => {
    const previews = imageFiles.map((f) => URL.createObjectURL(f))
    setGroupPrompt({ files: imageFiles, previews })
  }

  const handleGroups = async (groups) => {
    setProcessing(true)
    setGroupPrompt(null)

    // Convert each group to compressed pages array
    const toPages = (files) =>
      Promise.all(
        files.map(
          (file) =>
            new Promise((resolve) => {
              const reader = new FileReader()
              reader.onload = async (e) => {
                const compressed = await compressImage(e.target.result, file.type)
                resolve({ fileBase64: compressed.base64, mimeType: compressed.mimeType })
              }
              reader.readAsDataURL(file)
            }),
        ),
      )

    const pageGroups = await Promise.all(groups.map(toPages))
    await Promise.all(pageGroups.map((pages) => onSubmit(pages)))

    setProcessing(false)
    onClose()
  }

  if (processing) {
    return (
      <div className="fixed inset-0 bg-background/80 z-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-center px-8">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-[#1A1A18] font-medium text-sm">{t('capture.processing')}</p>
          <p className="text-xs text-muted">{t('capture.processing_hint')}</p>
        </div>
      </div>
    )
  }

  if (groupPrompt) {
    return (
      <GroupingPrompt
        files={groupPrompt.files}
        previews={groupPrompt.previews}
        onSingleReceipt={() => handleGroups([groupPrompt.files])}
        onSeparateReceipts={() => handleGroups(groupPrompt.files.map((f) => [f]))}
        onClose={onClose}
      />
    )
  }

  return (
    <input
      ref={inputRef}
      type="file"
      accept=".pdf,image/*"
      multiple
      className="hidden"
      onChange={handleFileInput}
    />
  )
}

function GroupingPrompt({ files, previews, onSingleReceipt, onSeparateReceipts, onClose }) {
  const { t } = useTranslation()

  useEffect(() => {
    return () => previews.forEach((url) => URL.revokeObjectURL(url))
  }, [previews])

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-surface rounded-t-[16px] sm:rounded-[12px] w-full max-w-md p-5 space-y-4">
        <p className="font-semibold text-[#1A1A18] text-center">
          {t('capture.same_receipt')}
        </p>

        {/* Thumbnails */}
        <div className="flex gap-2 justify-center overflow-x-auto pb-1">
          {previews.slice(0, 6).map((url, i) => (
            <div key={i} className="flex-shrink-0 relative">
              {files[i].type === 'application/pdf' ? (
                <div className="w-16 h-20 bg-background border border-border rounded-[6px] flex items-center justify-center">
                  <FileText size={24} className="text-muted" />
                </div>
              ) : (
                <img
                  src={url}
                  alt={`File ${i + 1}`}
                  className="w-16 h-20 object-cover rounded-[6px] border border-border"
                />
              )}
            </div>
          ))}
          {previews.length > 6 && (
            <div className="flex-shrink-0 w-16 h-20 bg-background border border-border rounded-[6px] flex items-center justify-center text-xs text-muted">
              +{previews.length - 6}
            </div>
          )}
        </div>

        <p className="text-sm text-muted text-center">
          {files.length} {t('capture.upload')}
        </p>

        <div className="flex gap-3">
          <button
            onClick={onSeparateReceipts}
            className="flex-1 py-3 border border-border rounded-[8px] text-sm font-medium text-[#1A1A18] active:scale-[0.98] transition-transform"
          >
            {t('capture.no_separate')}
          </button>
          <button
            onClick={onSingleReceipt}
            className="flex-1 py-3 bg-primary text-white rounded-[8px] text-sm font-medium active:scale-[0.98] transition-transform"
          >
            {t('capture.yes_same')}
          </button>
        </div>

        <button
          onClick={onClose}
          className="w-full text-sm text-muted py-1"
        >
          {t('common.cancel')}
        </button>
      </div>
    </div>
  )
}
