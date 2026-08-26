'use client'

import { useRef } from 'react'
import type { Slot } from '@/lib/composite'

type Props = {
  frameUrl: string | null
  frameW: number
  frameH: number
  slots: Slot[]
  onChange: (slots: Slot[]) => void
}

type Drag = {
  index: number
  mode: 'move' | 'resize'
  startX: number
  startY: number
  origin: Slot
}

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi)
const MIN = 0.03

/**
 * Positions photo slots directly on the frame. Coordinates are fractions of the
 * frame, so the layout survives any display size and any capture resolution.
 */
export default function SlotAligner({
  frameUrl,
  frameW,
  frameH,
  slots,
  onChange,
}: Props) {
  const boxRef = useRef<HTMLDivElement>(null)
  // A ref, not state: drag bookkeeping must be readable by the very next
  // pointermove, which can arrive before a state update would have committed.
  const dragRef = useRef<Drag | null>(null)

  function start(e: React.PointerEvent, index: number, mode: Drag['mode']) {
    e.preventDefault()
    e.stopPropagation()
    // Not all browsers allow capturing every pointer; dragging still works without it.
    try {
      ;(e.target as Element).setPointerCapture(e.pointerId)
    } catch {}
    dragRef.current = {
      index,
      mode,
      startX: e.clientX,
      startY: e.clientY,
      origin: slots[index],
    }
  }

  function move(e: React.PointerEvent) {
    const drag = dragRef.current
    const box = boxRef.current
    if (!drag || !box) return
    const rect = box.getBoundingClientRect()
    const dx = (e.clientX - drag.startX) / rect.width
    const dy = (e.clientY - drag.startY) / rect.height
    const o = drag.origin

    const next =
      drag.mode === 'move'
        ? {
            ...o,
            x: clamp(o.x + dx, 0, 1 - o.w),
            y: clamp(o.y + dy, 0, 1 - o.h),
          }
        : {
            ...o,
            w: clamp(o.w + dx, MIN, 1 - o.x),
            h: clamp(o.h + dy, MIN, 1 - o.y),
          }

    onChange(slots.map((s, i) => (i === drag.index ? next : s)))
  }

  const stop = () => {
    dragRef.current = null
  }

  if (!frameUrl) {
    return <p className="muted">Upload a frame to position the photo slots.</p>
  }

  return (
    <>
      <div
        ref={boxRef}
        className="aligner"
        style={{
          // Frames can be any size, including very tall strips: cap the displayed
          // height so the whole frame stays on screen while positioning slots.
          // The max() floor keeps a tall frame usable on a short viewport, where
          // the vh term alone would shrink the aligner to nothing.
          width: `max(200px, min(${frameW}px, 100%, ${((frameW / frameH) * 70).toFixed(2)}vh))`,
          aspectRatio: `${frameW} / ${frameH}`,
        }}
        onPointerMove={move}
        onPointerUp={stop}
        onPointerCancel={stop}
      >
        {slots.map((slot, i) => (
          <div
            key={i}
            className="slot"
            style={{
              left: `${slot.x * 100}%`,
              top: `${slot.y * 100}%`,
              width: `${slot.w * 100}%`,
              height: `${slot.h * 100}%`,
            }}
            onPointerDown={(e) => start(e, i, 'move')}
          >
            {i + 1}
            <span className="handle" onPointerDown={(e) => start(e, i, 'resize')} />
          </div>
        ))}
        {/* Frame sits on top so slots preview exactly how photos will be covered. */}
        <img src={frameUrl} alt="" />
      </div>
      <p className="muted" style={{ marginTop: '0.6rem' }}>
        Drag a numbered box to move it, drag its corner to resize. Photo 1 goes in box
        1. Frame is {frameW}×{frameH}.
      </p>
    </>
  )
}
