import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'
import { Layers, Mail, HardDrive, LogOut, ExternalLink, Unlink, CheckCircle, ChevronRight, BookOpen, FolderSync, Copy, Check, Share2 } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useDrive } from '../hooks/useDrive'
import LanguageToggle from '../components/LanguageToggle'

export default function SettingsPage() {
  const { t, i18n } = useTranslation()
  const { session, signOut } = useAuth()
  const { driveState, loading: driveLoading, refresh: refreshDrive } = useDrive()
  const [searchParams, setSearchParams] = useSearchParams()
  const [toast, setToast] = useState(null)
  const [inboxEmail, setInboxEmail] = useState(null)
  const [copied, setCopied] = useState(false)

  const user = session?.user
  const email = user?.email ?? ''
  const avatarUrl = user?.user_metadata?.avatar_url
  const lang = i18n.language === 'en' ? 'en' : 'fr'

  // Handle OAuth callback redirect (?drive=connected or ?drive=error)
  useEffect(() => {
    const driveParam = searchParams.get('drive')
    if (driveParam === 'connected') {
      refreshDrive()
      showToast(t('drive.inbox_ready'))
      setSearchParams({}, { replace: true })
    } else if (driveParam === 'error') {
      showToast(t('common.error'))
      setSearchParams({}, { replace: true })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }

  useEffect(() => {
    fetch('/api/config')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.inboxEmail) setInboxEmail(d.inboxEmail) })
      .catch(() => {})
  }, [])

  const handleCopyInbox = () => {
    if (!inboxEmail) return
    navigator.clipboard.writeText(inboxEmail).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const dimensionsLabel = lang === 'en' ? 'Accounts & Categories' : 'Comptes et catégories'

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-5">
      <h1 className="text-xl font-bold text-[#1A1A18]">{t('settings.title')}</h1>

      {/* User card */}
      <div className="bg-surface rounded-[8px] border border-border p-4 flex items-center gap-4">
        {avatarUrl ? (
          <img src={avatarUrl} alt="avatar" className="w-12 h-12 rounded-full object-cover" referrerPolicy="no-referrer" />
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
        <Link to="/guide" className="flex items-center px-4 py-3.5 gap-3 hover:bg-background transition-colors">
          <BookOpen size={17} className="text-muted flex-shrink-0" />
          <span className="flex-1 text-sm font-medium text-[#1A1A18]">
            {lang === 'en' ? 'How it works' : 'Comment ça marche'}
          </span>
          <ChevronRight size={15} className="text-muted" />
        </Link>
        <Link to="/dimensions" className="flex items-center px-4 py-3.5 gap-3 hover:bg-background transition-colors">
          <Layers size={17} className="text-muted flex-shrink-0" />
          <span className="flex-1 text-sm font-medium text-[#1A1A18]">{dimensionsLabel}</span>
          <ChevronRight size={15} className="text-muted" />
        </Link>
        <Link to="/sharing" className="flex items-center px-4 py-3.5 gap-3 hover:bg-background transition-colors">
          <Share2 size={17} className="text-muted flex-shrink-0" />
          <span className="flex-1 text-sm font-medium text-[#1A1A18]">
            {lang === 'en' ? 'Account sharing' : 'Partage de comptes'}
          </span>
          <ChevronRight size={15} className="text-muted" />
        </Link>
        <div className="flex items-center justify-between px-4 py-3.5">
          <span className="text-[#1A1A18] font-medium text-sm">{t('settings.language')}</span>
          <LanguageToggle session={session} />
        </div>
      </div>

      {/* Email inbox */}
      <div className="bg-surface rounded-[8px] border border-border p-4">
        <div className="flex items-start gap-3">
          <Mail size={17} className="text-muted flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[#1A1A18]">{t('settings.email_inbox')}</p>
            <p className="text-xs text-muted mt-0.5 leading-snug">
              {lang === 'fr'
                ? `Transférez vos reçus à cette adresse depuis ${email}.`
                : `Forward receipts to this address from ${email}.`}
            </p>
            {inboxEmail && (
              <div className="flex items-center gap-2 mt-2 bg-background rounded-[6px] px-3 py-2 border border-border">
                <p className="text-xs text-muted font-mono flex-1 truncate">{inboxEmail}</p>
                <button
                  onClick={handleCopyInbox}
                  className="flex-shrink-0 p-0.5 text-muted hover:text-primary transition-colors"
                  title={lang === 'en' ? 'Copy' : 'Copier'}
                >
                  {copied ? <Check size={13} className="text-success" /> : <Copy size={13} />}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Google Drive */}
      <DriveSection
        session={session}
        driveState={driveState}
        loading={driveLoading}
        onRefresh={refreshDrive}
        showToast={showToast}
      />

      {/* Sign out */}
      <button
        onClick={signOut}
        className="w-full flex items-center justify-center gap-2 bg-error/10 text-error rounded-[8px] py-3 font-medium text-sm hover:bg-error/20 transition-colors active:scale-[0.98]"
      >
        <LogOut size={16} />
        {t('auth.signout')}
      </button>

      {/* Legal */}
      <div className="flex items-center justify-center gap-4 text-xs text-muted pt-2 pb-4">
        <Link to="/privacy" className="hover:text-primary transition-colors">{t('privacy.title')}</Link>
        <span>·</span>
        <Link to="/terms" className="hover:text-primary transition-colors">{t('terms.title')}</Link>
      </div>

      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-[#1A1A18] text-white px-5 py-2.5 rounded-full text-sm z-50 shadow-lg pointer-events-none">
          {toast}
        </div>
      )}
    </div>
  )
}

function DriveSection({ session, driveState, loading, onRefresh, showToast }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language === 'en' ? 'en' : 'fr'
  const [connecting, setConnecting] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [syncing, setSyncing] = useState(false)

  const handleConnect = async () => {
    setConnecting(true)
    try {
      const res = await fetch(`/api/drive/auth-url?lang=${i18n.language}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!res.ok) throw new Error('auth-url failed')
      const { url } = await res.json()
      window.location.href = url
    } catch {
      showToast(t('common.error'))
      setConnecting(false)
    }
  }

  const handleDisconnect = async () => {
    if (!window.confirm(`${t('drive.disconnect')} ?`)) return
    setDisconnecting(true)
    try {
      await fetch('/api/drive/disconnect', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      onRefresh()
    } catch {
      showToast(t('common.error'))
    } finally {
      setDisconnecting(false)
    }
  }

  const handleSyncFolders = async () => {
    setSyncing(true)
    try {
      const res = await fetch('/api/drive/sync-dimensions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const data = await res.json()
      showToast(lang === 'en'
        ? `Folders synced (${data.created ?? 0} created)`
        : `Dossiers synchronisés (${data.created ?? 0} créés)`)
    } catch {
      showToast(t('common.error'))
    } finally {
      setSyncing(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-surface rounded-[8px] border border-border px-4 py-3.5 flex items-center gap-3">
        <HardDrive size={17} className="text-muted" />
        <span className="text-sm font-medium text-[#1A1A18]">{t('settings.drive')}</span>
      </div>
    )
  }

  if (!driveState) {
    return (
      <div className="bg-surface rounded-[8px] border border-border p-4 space-y-3">
        <div className="flex items-center gap-3">
          <HardDrive size={17} className="text-muted flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-[#1A1A18]">{t('settings.drive')}</p>
            <p className="text-xs text-muted mt-0.5">{t('drive.connect_prompt')}</p>
          </div>
        </div>
        <button
          onClick={handleConnect}
          disabled={connecting}
          className="w-full py-2.5 text-sm bg-primary text-white rounded-[8px] font-medium active:scale-[0.98] transition-transform disabled:opacity-60"
        >
          {connecting ? t('drive.connecting') : t('drive.connect')}
        </button>
        <p className="text-xs text-muted leading-relaxed">
          {lang === 'en'
            ? 'Récu only accesses files it creates. It cannot see, read, or modify any other file in your Google Drive.'
            : 'Récu accède uniquement aux fichiers qu\'il crée. Il ne peut pas voir, lire ni modifier les autres fichiers de votre Google Drive.'}
        </p>
      </div>
    )
  }

  const lastSyncText = driveState.lastSync ? relativeTime(driveState.lastSync) : null

  return (
    <div className="bg-surface rounded-[8px] border border-border p-4 space-y-3">
      <div className="flex items-center gap-3">
        <HardDrive size={17} className="text-primary flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-medium text-[#1A1A18]">{t('settings.drive')}</p>
            <CheckCircle size={13} className="text-success flex-shrink-0" />
          </div>
          <p className="text-xs text-muted mt-0.5">Récu/{i18n.language === 'en' ? '_Receipts' : '_Factures'}</p>
        </div>
      </div>

      <div className="text-xs text-muted pl-8 space-y-0.5">
        <p>{t('drive.files_saved', { count: driveState.fileCount })}</p>
        {lastSyncText && <p>{t('drive.last_sync', { time: lastSyncText })}</p>}
      </div>

      <p className="text-xs text-muted pl-8 leading-relaxed">
        {lang === 'en'
          ? 'Récu only accesses files it creates. It cannot see, read, or modify any other file in your Google Drive.'
          : 'Récu accède uniquement aux fichiers qu\'il crée. Il ne peut pas voir, lire ni modifier les autres fichiers de votre Google Drive.'}</p>

      <div className="flex gap-2">
        <a
          href={driveState.folderUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 flex items-center justify-center gap-1.5 py-2 text-sm text-primary border border-primary/30 rounded-[8px] font-medium active:scale-[0.98] transition-transform"
        >
          <ExternalLink size={14} />
          {t('drive.open_in_drive')}
        </a>
        <button
          onClick={handleSyncFolders}
          disabled={syncing}
          className="flex items-center gap-1.5 px-3 py-2 text-sm text-muted border border-border rounded-[8px] font-medium active:scale-[0.98] transition-transform disabled:opacity-50"
          title={lang === 'en' ? 'Sync account & category folders' : 'Synchroniser les dossiers'}
        >
          <FolderSync size={14} className={syncing ? 'animate-spin' : ''} />
        </button>
        <button
          onClick={handleDisconnect}
          disabled={disconnecting}
          className="flex items-center gap-1.5 px-3 py-2 text-sm text-muted border border-border rounded-[8px] font-medium active:scale-[0.98] transition-transform disabled:opacity-50"
        >
          <Unlink size={14} />
          {disconnecting ? t('drive.disconnecting') : t('drive.disconnect')}
        </button>
      </div>
    </div>
  )
}

function relativeTime(iso) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return '< 1 min'
  if (mins < 60) return `${mins} min`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  return `${Math.floor(hrs / 24)}j`
}

function Row({ icon: Icon, label, subtitle }) {
  return (
    <div className="flex items-center px-4 py-3.5 gap-3">
      <Icon size={17} className="text-muted flex-shrink-0" />
      <div className="min-w-0">
        <p className="text-sm font-medium text-[#1A1A18]">{label}</p>
        {subtitle && <p className="text-xs text-muted mt-0.5">{subtitle}</p>}
      </div>
    </div>
  )
}
