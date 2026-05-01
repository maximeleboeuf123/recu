import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import LanguageToggle from './LanguageToggle'
import { useAuth } from '../hooks/useAuth'
import { useReceipts } from '../hooks/useReceipts'

export default function MobileHeader() {
  const { session } = useAuth()
  const { refresh } = useReceipts()
  const [spinning, setSpinning] = useState(false)

  const handleRefresh = () => {
    refresh()
    setSpinning(true)
    setTimeout(() => setSpinning(false), 800)
  }

  return (
    <header
      className="fixed top-0 left-0 right-0 bg-surface border-b border-border z-50 flex items-center justify-between px-4"
      style={{ height: 'calc(52px + env(safe-area-inset-top, 0px))', paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      <span className="text-primary font-bold text-lg font-serif tracking-tight">
        Récu
      </span>
      <div className="flex items-center gap-3">
        <button
          onClick={handleRefresh}
          className="text-muted hover:text-primary transition-colors p-1"
          aria-label="Rafraîchir"
        >
          <RefreshCw size={17} className={spinning ? 'animate-spin' : ''} />
        </button>
        <LanguageToggle session={session} />
      </div>
    </header>
  )
}
