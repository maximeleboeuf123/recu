import { useState } from 'react'
import { NavLink, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { RefreshCw, HelpCircle } from 'lucide-react'
import LanguageToggle from './LanguageToggle'
import { useAuth } from '../hooks/useAuth'
import { useReceipts } from '../hooks/useReceipts'

const LINKS = [
  { path: '/', key: 'home' },
  { path: '/review', key: 'review' },
  { path: '/ledger', key: 'ledger' },
  { path: '/export', key: 'export' },
  { path: '/settings', key: 'settings' },
]

export default function TopNav() {
  const { t } = useTranslation()
  const { session } = useAuth()
  const { refresh } = useReceipts()
  const [spinning, setSpinning] = useState(false)

  const handleRefresh = () => {
    refresh()
    setSpinning(true)
    setTimeout(() => setSpinning(false), 800)
  }

  return (
    <header className="fixed top-0 left-0 right-0 h-16 bg-surface border-b border-border z-50 px-6 flex items-center justify-between shadow-sm">
      <span className="text-primary font-bold text-xl font-serif tracking-tight">Récu</span>

      <nav className="flex items-center gap-1">
        {LINKS.map(({ path, key }) => (
          <NavLink
            key={path}
            to={path}
            end={path === '/'}
            className={({ isActive }) =>
              `px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted hover:text-primary hover:bg-primary/5'
              }`
            }
          >
            {t(`nav.${key}`)}
          </NavLink>
        ))}
      </nav>

      <div className="flex items-center gap-3">
        <button
          onClick={handleRefresh}
          className="text-muted hover:text-primary transition-colors p-1"
          aria-label="Refresh"
        >
          <RefreshCw size={17} className={spinning ? 'animate-spin' : ''} />
        </button>
        <Link to="/guide" className="text-muted hover:text-primary transition-colors p-1" aria-label="Guide">
          <HelpCircle size={17} />
        </Link>
        <LanguageToggle session={session} />
      </div>
    </header>
  )
}
