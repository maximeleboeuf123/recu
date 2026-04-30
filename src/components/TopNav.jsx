import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import LanguageToggle from './LanguageToggle'
import { useAuth } from '../hooks/useAuth'

const LINKS = [
  { path: '/', key: 'home' },
  { path: '/review', key: 'review' },
  { path: '/ledger', key: 'ledger' },
  { path: '/settings', key: 'settings' },
]

export default function TopNav() {
  const { t } = useTranslation()
  const { session } = useAuth()

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

      <LanguageToggle session={session} />
    </header>
  )
}
