import assert from 'node:assert/strict'
import { test } from 'node:test'

type DrawCall = {
  sx: number
  sy: number
  sw: number
  sh: number
  dx: number
  dy: number
  dw: number
  dh: number
}

const calls: DrawCall[] = []
let canvasSize = { width: 0, height: 0 }

/**
 * Minimal canvas stub that records draw geometry, so the real compositing code
 * can be checked numerically without a browser.
 */
function installCanvasStub() {
  calls.length = 0
  const ctx = {
    fillStyle: '',
    fillRect() {},
    drawImage(...args: number[]) {
      if (args.length === 9) {
        const [, sx, sy, sw, sh, dx, dy, dw, dh] = args as unknown as [
          unknown,
          ...number[],
        ]
        calls.push({ sx, sy, sw, sh, dx, dy, dw, dh })
      } else {
        // 5-arg form is the frame overlay: drawImage(frame, 0, 0, w, h)
        const [, dx, dy, dw, dh] = args as unknown as [unknown, ...number[]]
        calls.push({ sx: -1, sy: -1, sw: -1, sh: -1, dx, dy, dw, dh })
      }
    },
  }
  ;(globalThis as Record<string, unknown>).document = {
    createElement() {
      const canvas = {
        width: 0,
        height: 0,
        getContext: () => ctx,
      }
      Object.defineProperty(canvas, 'width', {
        get: () => canvasSize.width,
        set: (v: number) => (canvasSize.width = v),
      })
      Object.defineProperty(canvas, 'height', {
        get: () => canvasSize.height,
        set: (v: number) => (canvasSize.height = v),
      })
      return canvas
    },
  }
}

installCanvasStub()
const { compositeStrip, defaultSlots } = await import('../src/lib/composite.ts')

const photo = (w: number, h: number) => ({
  source: {} as CanvasImageSource,
  width: w,
  height: h,
})

test('composites at the frame native size, whatever that size is', () => {
  for (const [w, h] of [
    [600, 1800], // tall strip
    [1080, 1080], // square
    [2480, 3508], // A4 at 300dpi
    [1920, 640], // wide
  ]) {
    installCanvasStub()
    compositeStrip([photo(1280, 720)], null, w, h, defaultSlots(1))
    assert.deepEqual(
      canvasSize,
      { width: w, height: h },
      `canvas must match the ${w}x${h} frame`
    )
  }
})

test('each photo lands exactly on its slot rectangle', () => {
  installCanvasStub()
  const frameW = 600
  const frameH = 1800
  // The three window cut-outs of the test frame, as fractions.
  const slots = [
    { x: 40 / 600, y: 40 / 1800, w: 520 / 600, h: 497 / 1800 },
    { x: 40 / 600, y: 561 / 1800, w: 520 / 600, h: 497 / 1800 },
    { x: 40 / 600, y: 1082 / 1800, w: 520 / 600, h: 497 / 1800 },
  ]
  compositeStrip(
    [photo(1280, 720), photo(1280, 720), photo(1280, 720)],
    null,
    frameW,
    frameH,
    slots
  )

  assert.equal(calls.length, 3, 'one draw per photo, no frame overlay passed')
  const expected = [
    { dx: 40, dy: 40, dw: 520, dh: 497 },
    { dx: 40, dy: 561, dw: 520, dh: 497 },
    { dx: 40, dy: 1082, dw: 520, dh: 497 },
  ]
  calls.forEach((c, i) => {
    for (const key of ['dx', 'dy', 'dw', 'dh'] as const) {
      assert.ok(
        Math.abs(c[key] - expected[i][key]) < 0.001,
        `photo ${i + 1} ${key}: got ${c[key]}, want ${expected[i][key]}`
      )
    }
  })
})

test('photos are cropped to fill the slot without distortion', () => {
  installCanvasStub()
  // 1280x720 landscape photo into a 520x497 near-square slot: crop the sides.
  compositeStrip(
    [photo(1280, 720)],
    null,
    600,
    1800,
    [{ x: 40 / 600, y: 40 / 1800, w: 520 / 600, h: 497 / 1800 }]
  )
  const c = calls[0]

  // Source aspect of the crop must equal the destination aspect (no squashing).
  assert.ok(
    Math.abs(c.sw / c.sh - c.dw / c.dh) < 0.001,
    `crop aspect ${c.sw / c.sh} must equal slot aspect ${c.dw / c.dh}`
  )
  // Crop stays inside the photo, and is centred.
  assert.ok(c.sx >= 0 && c.sy >= 0, 'crop origin inside source')
  assert.ok(c.sx + c.sw <= 1280.001 && c.sy + c.sh <= 720.001, 'crop inside source')
  assert.ok(Math.abs(c.sx - (1280 - c.sw) / 2) < 0.001, 'crop centred horizontally')
  assert.equal(c.sh, 720, 'full height used; the wider axis is what gets cropped')
})

test('a photo offset shifts the crop window instead of centering it', () => {
  installCanvasStub()
  // Same 1280x720-into-520x497 setup as the centred-crop test above.
  const frameW = 600
  const frameH = 1800
  const slot = { x: 40 / 600, y: 40 / 1800, w: 520 / 600, h: 497 / 1800 }

  installCanvasStub()
  compositeStrip([{ ...photo(1280, 720), offset: { x: 0, y: 0.5 } }], null, frameW, frameH, [
    slot,
  ])
  assert.ok(Math.abs(calls[0].sx - 0) < 0.001, 'offset 0 pins the crop to the left edge')

  installCanvasStub()
  compositeStrip([{ ...photo(1280, 720), offset: { x: 1, y: 0.5 } }], null, frameW, frameH, [
    slot,
  ])
  const maxSx = 1280 - calls[0].sw
  assert.ok(Math.abs(calls[0].sx - maxSx) < 0.001, 'offset 1 pins the crop to the right edge')

  installCanvasStub()
  compositeStrip([{ ...photo(1280, 720), offset: { x: -5, y: 5 } }], null, frameW, frameH, [
    slot,
  ])
  assert.ok(calls[0].sx >= 0 && calls[0].sy >= 0, 'out-of-range offsets clamp into the source')
})

test('the frame is drawn last so it overlays the photos', () => {
  installCanvasStub()
  const frame = {} as HTMLImageElement
  compositeStrip([photo(640, 480), photo(640, 480)], frame, 600, 1800, defaultSlots(2))

  assert.equal(calls.length, 3, '2 photos + 1 frame overlay')
  const overlay = calls[calls.length - 1]
  assert.deepEqual(
    { dx: overlay.dx, dy: overlay.dy, dw: overlay.dw, dh: overlay.dh },
    { dx: 0, dy: 0, dw: 600, dh: 1800 },
    'frame must cover the whole canvas, drawn after the photos'
  )
})

test('extra photos beyond the slot count are ignored, not stacked', () => {
  installCanvasStub()
  compositeStrip(
    [photo(640, 480), photo(640, 480), photo(640, 480)],
    null,
    600,
    1800,
    defaultSlots(2)
  )
  assert.equal(calls.length, 2, 'only draws as many photos as there are slots')
})
