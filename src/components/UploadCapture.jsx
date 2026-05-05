import { useRef, useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Upload, X, FileText, Camera, Plus, Check } from 'lucide-react'
import { compressImage } from '../lib/imageUtils'

function isPdf(file) {
  return file.type === 'application/pdf'
}

export default function UploadCapture({ onSubmit, onClose, initialFiles }) {
  const { t } = useTranslation()
  const inputRef = useRef(null)
  const cameraRef = useRef(null)
  const [groupPrompt, setGroupPrompt] = useState(null)
  const [processing, setProcessing] = useState(false)
  const [cameraFiles, setCameraFiles] = useState([])

  // Auto-process drag-dropped files only (no programmatic click — blocked on mobile)
  useEffect(() => {
    if (initialFiles?.length) {
      processFiles(Array.from(initialFiles))
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleFileInput = (e) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    processFiles(files)
  }

  const handleCameraInput = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setCameraFiles((prev) => [...prev, file])
  }

  const processFiles = (files) => {
    const imageFiles = files.filter((f) => !isPdf(f))
    const pdfFiles = files.filter(isPdf)

    if (pdfFiles.length > 0) {
      const pdfs = pdfFiles.map((f) => [f])
      const images = imageFiles.length > 1 ? null : imageFiles.length === 1 ? [[imageFiles[0]]] : []
      handleGroups([...pdfs, ...(images || [])])
      if (imageFiles.length > 1) showGroupPrompt(imageFiles)
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
    setCameraFiles([])

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

  const handleCameraAdd = () => {
    cameraRef.current?.click()
  }

  const handleCameraDone = () => {
    if (cameraFiles.length === 0) return
    handleGroups([cameraFiles])
  }

  if (processing) {
    return (
      <div className="fixed inset-0 bg-background z-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-center px-8">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-[#1A1A18] font-medium text-sm">
            {cameraFiles.length > 1
              ? t('capture.processing_pages', { count: cameraFiles.length })
              : t('capture.processing')}
          </p>
          <p className="text-xs text-muted">{t('capture.processing_hint')}</p>
        </div>
      </div>
    )
  }

  if (cameraFiles.length > 0) {
    return (
      <CameraMultiCapture
        files={cameraFiles}
        onAddPage={handleCameraAdd}
        onDone={handleCameraDone}
        onRemovePage={(i) => setCameraFiles((prev) => prev.filter((_, j) => j !== i))}
        onCancel={() => setCameraFiles([])}
      />
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
    <div className="fixed inset-0 bg-background z-50 flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 h-14 border-b border-border bg-surface flex-shrink-0"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <h1 className="text-sm font-semibold text-[#1A1A18]">{t('nav.upload')}</h1>
        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-background transition-colors">
          <X size={20} className="text-muted" />
        </button>
      </header>

      {/* Upload zone */}
      <div className="flex-1 flex flex-col items-center justify-center gap-6 px-6">
        <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center">
          <Upload size={36} className="text-primary" strokeWidth={1.6} />
        </div>

        <div className="text-center space-y-1">
          <p className="text-lg font-bold text-[#1A1A18]">{t('capture.upload_title')}</p>
          <p className="text-sm text-muted">{t('capture.upload_hint')}</p>
        </div>

        {/* File picker (gallery, files, single camera) */}
        <label className="w-full max-w-xs cursor-pointer">
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,image/*"
            multiple
            className="hidden"
            onChange={handleFileInput}
          />
          <div className="w-full flex items-center justify-center gap-2 bg-primary text-white rounded-[10px] py-4 active:scale-[0.97] transition-transform shadow-sm select-none">
            <Upload size={18} strokeWidth={2} />
            <span className="font-semibold text-sm">{t('capture.choose_file')}</span>
          </div>
        </label>

        {/* Camera multi-page button */}
        <div className="w-full max-w-xs">
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleCameraInput}
          />
          <button
            onClick={handleCameraAdd}
            className="w-full flex items-center justify-center gap-2 border border-border bg-surface text-[#1A1A18] rounded-[10px] py-3.5 active:scale-[0.97] transition-transform"
          >
            <Camera size={17} strokeWidth={1.8} className="text-muted" />
            <span className="text-sm font-medium">{t('capture.camera_multipage')}</span>
          </button>
          <p className="text-[11px] text-muted text-center mt-1.5">{t('capture.camera_multipage_hint')}</p>
        </div>

        <p className="text-xs text-muted text-center">{t('capture.formats')}</p>
      </div>
    </div>
  )
}

function CameraMultiCapture({ files, onAddPage, onDone, onRemovePage, onCancel }) {
  const { t } = useTranslation()
  const previews = files.map((f) => URL.createObjectURL(f))
  const maxReached = files.length >= 10

  useEffect(() => {
    return () => previews.forEach((url) => URL.revokeObjectURL(url))
  }, [files]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col">
      <header className="flex items-center justify-between px-4 h-14 border-b border-border bg-surface flex-shrink-0">
        <h1 className="text-sm font-semibold text-[#1A1A18]">
          {t('review.pages', { count: files.length })}
        </h1>
        <button onClick={onCancel} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-background transition-colors">
          <X size={20} className="text-muted" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="grid grid-cols-3 gap-2 mb-4">
          {previews.map((url, i) => (
            <div key={i} className="relative aspect-[3/4]">
              <img
                src={url}
                alt={`Page ${i + 1}`}
                className="w-full h-full object-cover rounded-[8px] border border-border"
              />
              <div className="absolute top-1 left-1 bg-[#1A1A18]/70 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {i + 1}
              </div>
              <button
                onClick={() => onRemovePage(i)}
                className="absolute top-1 right-1 bg-error/80 text-white rounded-full w-5 h-5 flex items-center justify-center"
              >
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
        {maxReached && (
          <p className="text-xs text-muted text-center mb-3">{t('capture.max_pages')}</p>
        )}
      </div>

      <div className="px-4 space-y-2.5" style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))' }}>
        {!maxReached && (
          <button
            onClick={onAddPage}
            className="w-full flex items-center justify-center gap-2 border border-border bg-surface rounded-[10px] py-3.5 transition-transform active:scale-[0.98]"
          >
            <Plus size={16} className="text-primary" />
            <span className="text-sm font-medium text-[#1A1A18]">{t('capture.add_page')}</span>
          </button>
        )}
        <button
          onClick={onDone}
          className="w-full flex items-center justify-center gap-2 bg-primary text-white rounded-[10px] py-4 font-semibold text-sm shadow-sm transition-transform active:scale-[0.98]"
        >
          <Check size={16} />
          {t('capture.done_pages')} — {t('review.pages', { count: files.length })}
        </button>
      </div>
    </div>
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

        <button onClick={onClose} className="w-full text-sm text-muted py-1">
          {t('common.cancel')}
        </button>
      </div>
    </div>
  )
}
