import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'

interface SwipeableProps {
  children: ReactNode
  onDelete: () => void
}

const OPEN_THRESHOLD = 36
const LOCK_PX = 8
const DEFAULT_DELETE_WIDTH = 72

function getDeleteWidth(root: HTMLElement): number {
  const raw = getComputedStyle(root).getPropertyValue('--swipe-delete-width').trim()
  const parsed = parseFloat(raw)
  return Number.isFinite(parsed) ? parsed : DEFAULT_DELETE_WIDTH
}

type GestureLock = 'pending' | 'horizontal' | 'vertical'

function findScrollParent(node: HTMLElement | null): HTMLElement | null {
  let current = node?.parentElement ?? null
  while (current) {
    const { overflowY } = getComputedStyle(current)
    if (overflowY === 'auto' || overflowY === 'scroll') return current
    current = current.parentElement
  }
  return null
}

function resolveGestureLock(deltaX: number, deltaY: number, isOpen: boolean): GestureLock {
  const absX = Math.abs(deltaX)
  const absY = Math.abs(deltaY)

  if (absX < LOCK_PX && absY < LOCK_PX) return 'pending'

  if (!isOpen && deltaX <= -LOCK_PX && absX >= absY) return 'horizontal'
  if (isOpen && absX >= absY) return 'horizontal'

  if (absY > absX) return 'vertical'
  if (!isOpen && deltaX > 0) return 'vertical'

  return 'horizontal'
}

export function Swipeable({ children, onDelete }: SwipeableProps) {
  const [offset, setOffset] = useState(0)
  const [open, setOpen] = useState(false)
  const [dragging, setDragging] = useState(false)

  const rootRef = useRef<HTMLDivElement>(null)
  const deleteWidthRef = useRef(DEFAULT_DELETE_WIDTH)
  const startX = useRef(0)
  const startY = useRef(0)
  const startOffset = useRef(0)
  const lockRef = useRef<GestureLock>('pending')
  const openRef = useRef(open)
  const offsetRef = useRef(offset)

  openRef.current = open
  offsetRef.current = offset

  const snap = (value: number, isOpen: boolean) => {
    setOffset(value)
    setOpen(isOpen)
    setDragging(false)
    offsetRef.current = value
    openRef.current = isOpen
  }

  const close = () => snap(0, false)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const scrollParent = findScrollParent(root)

    const onScroll = () => {
      if (lockRef.current === 'horizontal') return
      if (offsetRef.current !== 0 || openRef.current) {
        snap(0, false)
        lockRef.current = 'pending'
      }
    }

    const onTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0]
      if (!touch) return

      deleteWidthRef.current = getDeleteWidth(root)
      startX.current = touch.clientX
      startY.current = touch.clientY
      startOffset.current = openRef.current ? -deleteWidthRef.current : 0
      lockRef.current = 'pending'
    }

    const onTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0]
      if (!touch) return

      const deltaX = touch.clientX - startX.current
      const deltaY = touch.clientY - startY.current

      if (lockRef.current === 'pending') {
        const nextLock = resolveGestureLock(deltaX, deltaY, openRef.current)
        if (nextLock === 'pending') return

        lockRef.current = nextLock
        if (nextLock === 'vertical') {
          if (offsetRef.current !== 0 || openRef.current) snap(0, false)
          return
        }

        setDragging(true)
      }

      if (lockRef.current === 'vertical') return

      e.preventDefault()
      const deleteWidth = deleteWidthRef.current
      const next = Math.min(0, Math.max(-deleteWidth, startOffset.current + deltaX))
      offsetRef.current = next
      setOffset(next)
    }

    const onTouchEnd = () => {
      if (lockRef.current === 'vertical') {
        if (offsetRef.current !== 0) snap(0, false)
        lockRef.current = 'pending'
        return
      }

      if (lockRef.current === 'horizontal') {
        const current = offsetRef.current
        const deleteWidth = deleteWidthRef.current
        if (current < -OPEN_THRESHOLD) {
          snap(-deleteWidth, true)
        } else {
          snap(0, false)
        }
      }

      lockRef.current = 'pending'
    }

    const onTouchCancel = () => {
      const deleteWidth = deleteWidthRef.current
      snap(openRef.current ? -deleteWidth : 0, openRef.current)
      lockRef.current = 'pending'
    }

    scrollParent?.addEventListener('scroll', onScroll, { passive: true })
    root.addEventListener('touchstart', onTouchStart, { passive: true })
    root.addEventListener('touchmove', onTouchMove, { passive: false })
    root.addEventListener('touchend', onTouchEnd, { passive: true })
    root.addEventListener('touchcancel', onTouchCancel, { passive: true })

    return () => {
      scrollParent?.removeEventListener('scroll', onScroll)
      root.removeEventListener('touchstart', onTouchStart)
      root.removeEventListener('touchmove', onTouchMove)
      root.removeEventListener('touchend', onTouchEnd)
      root.removeEventListener('touchcancel', onTouchCancel)
    }
  }, [])

  const handleDelete = () => {
    close()
    onDelete()
  }

  const deleteWidth =
    deleteWidthRef.current > 0 ? deleteWidthRef.current : DEFAULT_DELETE_WIDTH
  const revealProgress = Math.min(1, Math.abs(offset) / deleteWidth)
  const actionsInteractive = open || revealProgress >= 0.95

  return (
    <div
      ref={rootRef}
      className={`swipeable${dragging ? ' swipeable--dragging' : ''}${open ? ' swipeable--open' : ''}`}
      style={
        {
          '--swipe-offset': `${offset}px`,
          '--swipe-progress': `${revealProgress}`,
        } as CSSProperties
      }
    >
      <div
        className="swipeable__actions"
        aria-hidden={!actionsInteractive}
        style={{ pointerEvents: actionsInteractive ? 'auto' : 'none' }}
      >
        <button
          type="button"
          className="swipeable__delete"
          onClick={handleDelete}
          aria-label="删除笔记"
          tabIndex={actionsInteractive ? 0 : -1}
        >
          删除
        </button>
      </div>
      <div
        className={`swipeable__content${actionsInteractive ? ' swipeable__content--revealed' : ''}`}
      >
        {children}
      </div>
    </div>
  )
}
