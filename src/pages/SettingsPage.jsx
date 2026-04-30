import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Layers, RefreshCw, Mail, HardDrive, LogOut, ChevronRight } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import LanguageToggle from '../components/LanguageToggle'

export default function SettingsPage() {
  const { t } = useTranslation()
  const { session, signOut } = useAuth()

  const user = session?.user
  const email = user?.email ?? ''
  const avatarUrl = user?.user_metadata?.avatar_url

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-5">
      <h1 className="text-xl font-bold text-[#1A1A18]">{t('settings.title')}</h1>

      {/* User card */}
      <div className="bg-surface rounded-[8px] border border-border p-4 flex items-center gap-4">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt="avatar"
            className="w-12 h-12 rounded-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-primary text-white flex items-center justify-center font-semibold text-lg flex-shrink-0">
            {email[0]?.toUpperCase() || 'U'}
          </div>
        )}
        <div className="min-w-0">
          <p className="font-medium text-[#1A1A18] truncate">{email}</p>
          <p className="text-sm text-muted">{t('settings.plan_free')}</p>
        </div>
      </div>

      {/* Settings rows */}
      <div className="bg-surface rounded-[8px] border border-border divide-y divide-border">
        <Row icon={Layers} label={t('settings.dimensions')} />
        <Row icon={RefreshCw} label={t('settings.recurring')} />
        <Row
          icon={Mail}
          label={t('settings.email_inbox')}
          subtitle={t('settings.email_inbox_sub')}
        />
        <Row
          icon={HardDrive}
          label={t('settings.drive')}
          value={t('settings.drive_disconnected')}
          valueClass="text-muted"
        />

        {/* Language toggle row */}
        <div className="flex items-center justify-between px-4 py-3.5">
          <span className="text-[#1A1A18] font-medium text-sm">{t('settings.language')}</span>
          <LanguageToggle session={session} />
        </div>
      </div>

      {/* Sign out */}
      <button
        onClick={signOut}
        className="w-full flex items-center justify-center gap-2 bg-error/10 text-error rounded-[8px] py-3 font-medium text-sm hover:bg-error/20 transition-colors active:scale-[0.98]"
      >
        <LogOut size={16} />
        {t('auth.signout')}
      </button>

      {/* Legal footer */}
      <div className="flex items-center justify-center gap-4 text-xs text-muted pt-2 pb-4">
        <Link to="/privacy" className="hover:text-primary transition-colors">
          {t('privacy.title')}
        </Link>
        <span>·</span>
        <Link to="/terms" className="hover:text-primary transition-colors">
          {t('terms.title')}
        </Link>
      </div>
    </div>
  )
}

function Row({ icon: Icon, label, subtitle, value, valueClass = '' }) {
  return (
    <div className="flex items-center justify-between px-4 py-3.5 gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <Icon size={17} className="text-muted flex-shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-[#1A1A18]">{label}</p>
          {subtitle && <p className="text-xs text-muted mt-0.5">{subtitle}</p>}
        </div>
      </div>
      <div className="flex items-center gap-1 text-muted flex-shrink-0">
        {value && <span className={`text-xs ${valueClass}`}>{value}</span>}
        <ChevronRight size={14} />
      </div>
    </div>
  )
}
