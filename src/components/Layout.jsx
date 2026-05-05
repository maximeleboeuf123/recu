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

function getAckedIds() {
  try { return new Set(JSON.parse(localStorage.getItem('recu_acked_shares') || '[]')) }
  catch { return new Set() }
}

export default function Layout() {
  const isDesktop = useIsDesktop()
  const { pendingCount } = useReceipts()
  const { received } = useShares()

  const [ackedIds, setAckedIds] = useState(() => getAckedIds())
  const [showShareModal, setShowShareModal] = useState(false)

  const unacknowledged = useMemo(
    () => received.filter(s => !ackedIds.has(s.id)),
    [received, ackedIds]
  )

  useEffect(() => {
    if (unacknowledged.length > 0) setShowShareModal(true)
  }, [unacknowledged.length])

  const handleDismiss = () => {
    const newAcked = new Set([...ackedIds, ...received.map(s => s.id)])
    localStorage.setItem('recu_acked_shares', JSON.stringify([...newAcked]))
    setAckedIds(newAcked)
    setShowShareModal(false)
  }

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
      {!isDesktop && <BottomNav pendingCount={pendingCount} sharesCount={unacknowledged.length} />}
      {showShareModal && <ShareInviteModal shares={unacknowledged} onDismiss={handleDismiss} />}
    </div>
  )
}
