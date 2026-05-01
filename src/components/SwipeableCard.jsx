import { useRef, useState } from 'react'
import { Check, X } from 'lucide-react'

const THRESHOLD = 80

export default function SwipeableCard({ onSwipeRight, onSwipeLeft, disabled, children }) {
  const startXRef = useRef(null)
  const [deltaX, setDeltaX] = useState(0)
  const [swiping, setSwiping] = useState(false)
  const [flash, setFlash] = useState(null) // 'confirm' | 'skip'

  const onPointerDown = (e) => {
    if (disabled) return
    startXRef.current = e.clientX
    setSwiping(true)
  }

  const onPointerMove = (e) => {
    if (!swiping || startXRef.current === null) return
    setDeltaX(e.clientX - startXRef.current)
  }

  const onPointerUp = () => {
    if (!swiping) return
    const dx = deltaX

    if (dx > THRESHOLD) {
      setFlash('confirm')
      setTimeout(() => {
        setFlash(null)
        setDeltaX(0)
        setSwiping(false)
        onSwipeRight?.()
      }, 300)
    } else if (dx < -THRESHOLD) {
      setFlash('skip')
      setTimeout(() => {
        setFlash(null)
        setDeltaX(0)
        setSwiping(false)
        onSwipeLeft?.()
      }, 200)
    } else {
      setDeltaX(0)
      setSwiping(false)
    }
  }

  const clampedDelta = Math.max(-120, Math.min(120, deltaX))
  const opacity = Math.abs(clampedDelta) / 120

  return (
    <div className="relative overflow-hidden rounded-[8px]">
      {/* Swipe hint backgrounds */}
      {clampedDelta > 0 && (
        <div
          className="absolute inset-0 bg-success rounded-[8px] flex items-center pl-4"
          style={{ opacity: opacity * 0.8 }}
        >
          <Check size={24} className="text-white" />
        </div>
      )}
      {clampedDelta < 0 && (
        <div
          className="absolute inset-0 bg-muted rounded-[8px] flex items-center justify-end pr-4"
          style={{ opacity: opacity * 0.6 }}
        >
          <X size={24} className="text-white" />
        </div>
      )}

      {/* Flash overlay */}
      {flash === 'confirm' && (
        <div className="absolute inset-0 bg-success/40 rounded-[8px] pointer-events-none z-10 animate-pulse" />
      )}

      <div
        className={`relative touch-pan-y select-none ${swiping ? 'transition-none' : 'transition-transform duration-200'}`}
        style={{ transform: `translateX(${clampedDelta}px)` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        {children}
      </div>
    </div>
  )
}
