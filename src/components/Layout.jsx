import { Outlet } from 'react-router-dom'
import { useEffect, useState, useMemo } from 'react'
import BottomNav from './BottomNav'
import TopNav from './TopNav'
import MobileHeader from './MobileHeader'
import ShareInviteModal from './ShareInviteModal'
import { useReceipts } from '../hooks/useReceipts'
import { useShares } from '../hooks/useShares'

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= 768)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const handler = (e) => setIsDesktop(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  return isDesktop
}

export default function Layout() {
  const isDesktop = useIsDesktop()
  const { pendingCount } = useReceipts()
  const { received } = useShares()

  // Show modal for pending (unaccepted) invitations
  const pendingInvites = useMemo(
    () => received.filter(s => s.status === 'pending'),
    [received]
  )

  const [showShareModal, setShowShareModal] = useState(false)

  useEffect(() => {
    if (pendingInvites.length > 0) setShowShareModal(true)
  }, [pendingInvites.length])

  return (
    <div className="min-h-screen bg-background">
      {isDesktop ? <TopNav /> : <MobileHeader />}
      <main
        className={
          isDesktop
            ? 'pt-16'
            : 'pt-[calc(52px+env(safe-area-inset-top,0px))] pb-[calc(60px+env(safe-area-inset-bottom,0px))]'
        }
      >
        <Outlet />
      </main>
      {!isDesktop && <BottomNav pendingCount={pendingCount} sharesCount={pendingInvites.length} />}
      {showShareModal && (
        <ShareInviteModal
          shares={pendingInvites}
          onDone={() => setShowShareModal(false)}
        />
      )}
    </div>
  )
}
