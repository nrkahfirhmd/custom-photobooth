import type { Slot } from './validate'

export type { Slot }

/**
 * Slots are fractions of the frame, so a layout set once in the admin aligner
 * composites identically no matter what resolution the guest's camera captures at.
 */
export function defaultSlots(count: number): Slot[] {
  const pad = 0.06
  const gap = 0.02
  const usable = 1 - pad * 2 - gap * (count - 1)
  const h = usable / count
  return Array.from({ length: count }, (_, i) => ({
    x: pad,
    y: pad + i * (h + gap),
    w: 1 - pad * 2,
    h,
  }))
}

export function slotsFor(slots: Slot[] | undefined, shotCount: number): Slot[] {
  return slots && slots.length === shotCount ? slots : defaultSlots(shotCount)
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Could not load image: ${src}`))
    img.src = src
  })
}

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi)

/**
 * Draw `src` into the rect, cropping to fill it without distorting (CSS `object-fit: cover`).
 * `offsetX`/`offsetY` place the crop window within the source, using the same
 * convention as CSS `object-position`: 0 = align the crop to that edge (showing
 * the opposite side), 1 = the other edge, 0.5 (the default) = centered.
 */
export function drawCover(
  ctx: CanvasRenderingContext2D,
  src: CanvasImageSource,
  sw: number,
  sh: number,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
  offsetX = 0.5,
  offsetY = 0.5
) {
  const scale = Math.max(dw / sw, dh / sh)
  const cw = dw / scale
  const ch = dh / scale
  const sx = clamp((sw - cw) * offsetX, 0, sw - cw)
  const sy = clamp((sh - ch) * offsetY, 0, sh - ch)
  ctx.drawImage(src, sx, sy, cw, ch, dx, dy, dw, dh)
}

export type Photo = {
  source: CanvasImageSource
  width: number
  height: number
  /** Crop focal point as object-position fractions; defaults to centered. */
  offset?: { x: number; y: number }
}

/**
 * Composites the captured photos into the frame at the frame's own native size —
 * frames can be any dimensions, so nothing here assumes a fixed canvas.
 */
export function compositeStrip(
  photos: Photo[],
  frame: HTMLImageElement | null,
  frameW: number,
  frameH: number,
  slots: Slot[]
): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = frameW
  canvas.height = frameH
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas is not supported in this browser')

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, frameW, frameH)

  photos.forEach((photo, i) => {
    const slot = slots[i]
    if (!slot) return
    const offset = photo.offset ?? { x: 0.5, y: 0.5 }
    drawCover(
      ctx,
      photo.source,
      photo.width,
      photo.height,
      slot.x * frameW,
      slot.y * frameH,
      slot.w * frameW,
      slot.h * frameH,
      offset.x,
      offset.y
    )
  })

  // Frame goes on top: it is a transparent PNG overlay.
  if (frame) ctx.drawImage(frame, 0, 0, frameW, frameH)
  return canvas
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not render image'))),
      'image/png'
    )
  )
}
