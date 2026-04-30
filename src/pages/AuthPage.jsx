import { useTranslation } from 'react-i18next'
import { useAuth } from '../hooks/useAuth'
import LanguageToggle from '../components/LanguageToggle'

export default function AuthPage() {
  const { t } = useTranslation()
  const { signInWithGoogle } = useAuth()

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="absolute top-4 right-4">
        <LanguageToggle />
      </div>

      <div className="w-full max-w-sm bg-surface rounded-xl p-8 shadow-sm border border-border space-y-6">
        {/* Logo mark */}
        <div className="text-center space-y-3">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto shadow-md">
            <span className="text-white text-3xl font-bold" style={{ fontFamily: 'Georgia, serif' }}>
              R
            </span>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#1A1A18]">{t('auth.welcome')}</h1>
            <p className="text-muted text-sm mt-1">{t('auth.subtitle')}</p>
          </div>
        </div>

        {/* Google sign-in */}
        <button
          onClick={signInWithGoogle}
          className="w-full flex items-center justify-center gap-3 bg-primary text-white rounded-[6px] py-3 font-medium hover:bg-[#153255] active:scale-[0.98] transition-all"
        >
          <GoogleColorIcon />
          {t('auth.signin')}
        </button>

        {/* Legal footer */}
        <p className="text-center text-xs text-muted">
          En continuant, vous acceptez nos{' '}
          <a href="/terms" className="underline hover:text-primary">conditions</a>
          {' '}et notre{' '}
          <a href="/privacy" className="underline hover:text-primary">politique de confidentialité</a>.
        </p>
      </div>
    </div>
  )
}

function GoogleColorIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
      <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.7-.4-3.9z"/>
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2A11.9 11.9 0 0 1 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
      <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3a12 12 0 0 1-4.1 5.6l6.2 5.2C36.9 39.2 44 34 44 24c0-1.3-.1-2.7-.4-3.9z"/>
    </svg>
  )
}
