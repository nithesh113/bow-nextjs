import { useRef } from 'react'

interface SwipeOptions {
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
  minXDistance?: number
  maxYDistance?: number
}

export function useSwipeGesture({ onSwipeLeft, onSwipeRight, minXDistance = 60, maxYDistance = 40 }: SwipeOptions) {
  const startX = useRef(0)
  const startY = useRef(0)

  const onTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX
    startY.current = e.touches[0].clientY
  }

  const onTouchEnd = (e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - startX.current
    const dy = Math.abs(e.changedTouches[0].clientY - startY.current)
    if (dy > maxYDistance) return
    if (dx > minXDistance && onSwipeRight) onSwipeRight()
    else if (dx < -minXDistance && onSwipeLeft) onSwipeLeft()
  }

  return { onTouchStart, onTouchEnd }
}
