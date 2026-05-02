import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Upload, ClipboardCheck, BookOpen, Settings } from 'lucide-react'

const TABS = [
  { path: '/', iconKey: 'upload', Icon: Upload },
  { path: '/review', iconKey: 'review', Icon: ClipboardCheck },
  { path: '/ledger', iconKey: 'ledger', Icon: BookOpen },
  { path: '/settings', iconKey: 'settings', Icon: Settings },
]

export default function BottomNav({ pendingCount = 0 }) {
  const { t } = useTranslation()
  const location = useLocation()

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-surface border-t border-border z-50 flex items-stretch"
      style={{ height: 'calc(60px + env(safe-area-inset-bottom, 0px))' }}
    >
      {TABS.map(({ path, iconKey, Icon }) => {
        const active = location.pathname === path
        const badge = iconKey === 'review' && pendingCount > 0 ? pendingCount : null

        return (
          <Link
            key={path}
            to={path}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 pb-[env(safe-area-inset-bottom,0px)] transition-colors ${
              active ? 'text-primary' : 'text-muted'
            }`}
          >
            <div className="relative">
              <Icon size={22} strokeWidth={active ? 2.5 : 1.8} />
              {badge && (
                <span className="absolute -top-1.5 -right-2.5 bg-accent text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-0.5">
                  {badge > 99 ? '99+' : badge}
                </span>
              )}
            </div>
            <span className={`text-[10px] ${active ? 'font-semibold' : 'font-normal'}`}>
              {t(`nav.${iconKey}`)}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
