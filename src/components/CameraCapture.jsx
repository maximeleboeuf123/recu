import { useRef, useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Check, X } from 'lucide-react'
import { compressImage } from '../lib/imageUtils'

export default function CameraCapture({ onSubmit, onClose }) {
  const { t } = useTranslation()
  const inputRef = useRef(null)
  const [pages, setPages] = useState([])
  const [processing, setProcessing] = useState(false)

  // Trigger camera immediately on mount
  useEffect(() => {
    inputRef.current?.click()
  }, [])

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    const reader = new FileReader()
    reader.onload = async (ev) => {
      const compressed = await compressImage(ev.target.result, file.type)
      setPages((prev) => [...prev, compressed])
    }
    reader.readAsDataURL(file)
  }

  const handleFinish = async () => {
    if (!pages.length) return onClose()
    setProcessing(true)
    await onSubmit(pages.map(({ fileBase64, mimeType }) => ({ fileBase64, mimeType })))
    setProcessing(false)
  }

  // If no pages captured yet and camera was dismissed — close the flow
  const handleInputCancel = () => {
    if (pages.length === 0) onClose()
  }

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col safe-top">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFile}
        onCancel={handleInputCancel}
      />

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface">
        <button
          onClick={onClose}
          className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-background transition-colors"
        >
          <X size={20} className="text-muted" />
        </button>
        <span className="text-sm font-medium text-[#1A1A18]">
          {pages.length > 0
            ? `${pages.length} page${pages.length > 1 ? 's' : ''}`
            : t('capture.photo')}
        </span>
        <div className="w-8" />
      </div>

      {processing ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-4">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-[#1A1A18] font-medium text-center">
            {t('capture.processing_pages', { count: pages.length })}
          </p>
        </div>
      ) : (
        <>
          {/* Page thumbnails */}
          {pages.length > 0 && (
            <div className="flex gap-3 p-4 overflow-x-auto border-b border-border">
              {pages.map((page, i) => (
                <div key={i} className="flex-shrink-0 relative">
                  <img
                    src={page.dataUrl}
                    alt={`Page ${i + 1}`}
                    className="w-20 h-28 object-cover rounded-[6px] border border-border"
                  />
                  <span className="absolute bottom-1 right-1 bg-black/50 text-white text-[10px] rounded px-1 leading-4">
                    {i + 1}
                  </span>
                </div>
              ))}
            </div>
          )}

          {pages.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-muted text-sm">
              {t('capture.photo')}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 px-4 text-center text-muted text-sm">
              <p>{t('capture.same_receipt')}</p>
            </div>
          )}

          {/* Action buttons */}
          <div className="px-4 pb-safe-bottom space-y-3 pt-4 border-t border-border">
            {pages.length < 10 ? (
              <button
                onClick={() => inputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-border rounded-[8px] py-4 text-muted font-medium active:scale-[0.98] transition-transform"
              >
                <Plus size={18} />
                {t('capture.add_page')}
              </button>
            ) : (
              <p className="text-center text-xs text-muted py-2">{t('capture.max_pages')}</p>
            )}

            {pages.length > 0 && (
              <button
                onClick={handleFinish}
                className="w-full flex items-center justify-center gap-2 bg-primary text-white rounded-[8px] py-4 font-semibold active:scale-[0.98] transition-transform"
              >
                <Check size={18} />
                {t('capture.done_pages')}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
