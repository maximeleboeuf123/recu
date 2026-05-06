import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

const STORAGE_KEY = 'install_prompt_dismissed'

function isIos() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream
}

function isInStandaloneMode() {
  return window.navigator.standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches
}

export default function InstallPrompt() {
  const { i18n } = useTranslation()
  const lang = i18n.language === 'en' ? 'en' : 'fr'
  const [show, setShow] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [ios, setIos] = useState(false)

  useEffect(() => {
    // Never show if already installed or already dismissed
    if (isInStandaloneMode()) return
    if (localStorage.getItem(STORAGE_KEY)) return

    const _isIos = isIos()
    setIos(_isIos)

    if (_isIos) {
      // iOS: show after short delay
      const t = setTimeout(() => setShow(true), 1500)
      return () => clearTimeout(t)
    }

    // Android/Chrome: wait for beforeinstallprompt
    const handler = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setTimeout(() => setShow(true), 1500)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, '1')
    setShow(false)
  }

  const install = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') localStorage.setItem(STORAGE_KEY, '1')
    setShow(false)
  }

  if (!show) return null

  return (
    <>
      {/* Backdrop — non-dismissible, forces explicit choice */}
      <div className="fixed inset-0 bg-black/50 z-40" />

      {/* Bottom sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-surface rounded-t-[20px] shadow-xl p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] animate-slide-up">

        {/* Drag handle */}
        <div className="w-10 h-1 bg-border rounded-full mx-auto mb-5" />

        {/* Icon + heading */}
        <div className="flex items-center gap-3 mb-4">
          <img src="/icons/icon-192.png" alt="Récu" className="w-12 h-12 rounded-[14px] shadow-sm flex-shrink-0" />
          <div>
            <p className="font-bold text-[#1A1A18] text-base leading-tight">
              {lang === 'en' ? 'Add Récu to your home screen' : 'Ajouter Récu à l'écran d'accueil'}
            </p>
            <p className="text-xs text-muted mt-0.5">
              {lang === 'en' ? 'One tap access — no app store needed' : 'Accès en un tap — sans passer par l'App Store'}
            </p>
          </div>
        </div>

        {ios ? (
          /* iOS instructions */
          <div className="bg-background rounded-[10px] border border-border p-4 space-y-3 mb-5">
            <Step n={1} label={lang === 'en' ? 'Tap the Share button below' : 'Appuie sur le bouton Partager en bas'} icon="⬆️" />
            <Step n={2} label={lang === 'en' ? 'Scroll down and tap "Add to Home Screen"' : 'Fais défiler et appuie sur « Sur l'écran d'accueil »'} icon="➕" />
            <Step n={3} label={lang === 'en' ? 'Tap "Add" — done! 🎉' : 'Appuie sur « Ajouter » — c'est tout ! 🎉'} icon="✅" />
          </div>
        ) : (
          /* Android install button */
          <button
            onClick={install}
            className="w-full py-3 bg-primary text-white rounded-[10px] font-semibold text-sm mb-3 active:scale-[0.98] transition-transform"
          >
            {lang === 'en' ? 'Add to home screen' : 'Ajouter à l'écran d'accueil'}
          </button>
        )}

        <button
          onClick={dismiss}
          className="w-full py-2 text-sm text-muted hover:text-[#1A1A18] transition-colors"
        >
          {lang === 'en' ? 'Maybe later' : 'Plus tard'}
        </button>
      </div>
    </>
  )
}

function Step({ n, icon, label }) {
  return (
    <div className="flex items-start gap-3">
      <span className="w-5 h-5 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{n}</span>
      <span className="text-sm text-[#1A1A18]">{icon} {label}</span>
    </div>
  )
}
