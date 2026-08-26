'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toDataURL as toQrDataUrl } from 'qrcode'
import {
  canvasToBlob,
  compositeStrip,
  loadImage,
  type Photo,
  type Slot,
} from '@/lib/composite'
import {
  AlertIcon,
  ArrowLeftIcon,
  CameraIcon,
  CheckIcon,
  MailIcon,
  MoveIcon,
  ShareIcon,
} from '@/components/icons'

type Props = {
  id: string
  name: string
  shotCount: number
  hasFrame: boolean
  frameW: number
  frameH: number
  slots: Slot[]
}

/** A captured photo plus a small jpeg thumbnail, so the strip can show it while shooting. */
type Shot = { photo: Photo; thumb: string }

type Stage = 'attract' | 'capturing' | 'preview' | 'email' | 'sent'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi)
const RESET_SECONDS = 12
const allIndices = (n: number) => Array.from({ length: n }, (_, i) => i)
type Offset = { x: number; y: number }
const CENTERED: Offset = { x: 0.5, y: 0.5 }

export default function Booth({
  id,
  name,
  shotCount,
  hasFrame,
  frameW,
  frameH,
  slots,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const blobRef = useRef<Blob | null>(null)
  const frameRef = useRef<HTMLImageElement | null>(null)
  const shotsRef = useRef<(Shot | null)[]>(Array(shotCount).fill(null))
  // Checked inside the capture loop so "Keep the old one" can bail out mid-countdown.
  const abortRef = useRef(false)

  const [stage, setStage] = useState<Stage>('attract')
  const [shots, setShots] = useState<(Shot | null)[]>(() => Array(shotCount).fill(null))
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const [retakeIndex, setRetakeIndex] = useState<number | null>(null)
  const [cameraError, setCameraError] = useState('')
  const [countdown, setCountdown] = useState<number | null>(null)
  const [flash, setFlash] = useState(0)
  const [stripUrl, setStripUrl] = useState('')
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [resetIn, setResetIn] = useState(RESET_SECONDS)

  // Scan-to-download: a public URL for the finished strip (via Vercel Blob)
  // plus its QR code. Optional — stays empty if BLOB_READ_WRITE_TOKEN isn't set.
  const [downloadUrl, setDownloadUrl] = useState('')
  const [qrSrc, setQrSrc] = useState('')
  // Native share sheet (AirDrop on iOS, Nearby Share on Android, etc.) — only
  // some browsers can share actual files, so this is feature-detected rather
  // than assumed. Falls back to the plain download link where unsupported.
  const [canShareFiles, setCanShareFiles] = useState(false)

  // Repositioning one photo's crop within its slot — only ever one at a time,
  // and only reachable from the preview stage.
  const [repositionIndex, setRepositionIndex] = useState<number | null>(null)
  const [repositionSrc, setRepositionSrc] = useState('')
  const [repositionOffset, setRepositionOffset] = useState<Offset>(CENTERED)
  const dragRef = useRef<{ startX: number; startY: number; origin: Offset } | null>(null)

  // Never leave a camera running after the booth unmounts.
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  /** Push the camera to its real hardware ceiling, not a guessed 4096. */
  const applyMaxResolution = useCallback(async (stream: MediaStream) => {
    for (const track of stream.getVideoTracks()) {
      const caps = track.getCapabilities?.()
      if (!caps) continue
      const res: MediaTrackConstraints = {}
      if (typeof caps.width?.max === 'number') res.width = caps.width.max
      if (typeof caps.height?.max === 'number') res.height = caps.height.max
      // Max width + height + frame rate together is often unsupported, so apply
      // resolution first and frame rate separately.
      if (Object.keys(res).length) {
        await track.applyConstraints(res).catch(() => {})
      }
      if (typeof caps.frameRate?.max === 'number') {
        await track.applyConstraints({ frameRate: caps.frameRate.max }).catch(() => {})
      }
    }
  }, [])

  /** The design asks for the camera only once the guest commits, not on page load. */
  const ensureCamera = useCallback(async (): Promise<boolean> => {
    if (streamRef.current) return true
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError(
        'This browser cannot use the camera. Try Safari on iPhone or Chrome on Android.'
      )
      return false
    }
    try {
      // Ask for 16:9 at the highest resolution up front — `ideal` never fails
      // the request, it just steers the browser's mode pick. Landing on 16:9
      // natively also means toLandscape below has nothing left to crop, so no
      // sensor pixels are thrown away chasing the aspect ratio afterward.
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          aspectRatio: { ideal: 16 / 9 },
          width: { ideal: 3840 },
          height: { ideal: 2160 },
        },
        audio: false,
      })
      streamRef.current = stream
      // Renegotiate again against the track's own reported ceiling: some
      // browsers (notably iOS Safari) grant a low-res stream on the first
      // request regardless of `ideal` and only expose their true max via
      // getCapabilities() once the track already exists.
      await applyMaxResolution(stream)
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play().catch(() => {})
      }
      return true
    } catch (err) {
      const errName = err instanceof DOMException ? err.name : ''
      setCameraError(
        errName === 'NotAllowedError'
          ? 'Your browser blocked camera access. Allow the camera for this page, then reload.'
          : errName === 'NotFoundError'
            ? 'No camera found on this device.'
            : 'Could not start the camera. Reload and try again.'
      )
      return false
    }
  }, [applyMaxResolution])

  /** Grab the current video frame, mirrored to match the preview the guest posed against. */
  const grabFrame = useCallback((): Photo | null => {
    const video = videoRef.current
    if (!video?.videoWidth) return null
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.translate(canvas.width, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(video, 0, 0)
    return { source: canvas, width: canvas.width, height: canvas.height }
  }, [])

  /** Crop the captured frame to 16:9 landscape, centre-cropping a portrait feed. */
  const toLandscape = useCallback((photo: Photo): Photo => {
    const target = 16 / 9
    const w = photo.width
    const h = photo.height
    const current = w / h
    if (Math.abs(current - target) < 0.01) return photo
    const out = document.createElement('canvas')
    if (current > target) {
      out.width = Math.round(h * target)
      out.height = h
    } else {
      out.width = w
      out.height = Math.round(w / target)
    }
    const ctx = out.getContext('2d')
    if (!ctx) return photo
    const sw = Math.min(w, h * target)
    const sh = Math.min(h, w / target)
    ctx.drawImage(
      photo.source,
      (w - sw) / 2,
      (h - sh) / 2,
      sw,
      sh,
      0,
      0,
      out.width,
      out.height
    )
    return { source: out, width: out.width, height: out.height }
  }, [])

  /** Small jpeg thumbnail — a data URL, so there is no object URL to revoke later. */
  const thumbUrl = useCallback((photo: Photo): string => {
    const max = 200
    const scale = Math.min(1, max / Math.max(photo.width, photo.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(photo.width * scale))
    canvas.height = Math.max(1, Math.round(photo.height * scale))
    const ctx = canvas.getContext('2d')
    if (!ctx) return ''
    ctx.drawImage(photo.source, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', 0.6)
  }, [])

  /** Re-composite the current set of photos into the finished strip. */
  const buildStrip = useCallback(
    async (all: Shot[]) => {
      if (hasFrame && !frameRef.current) {
        frameRef.current = await loadImage(`/api/frame/${id}`)
      }
      const canvas = compositeStrip(
        all.map((s) => s.photo),
        frameRef.current,
        frameW,
        frameH,
        slots
      )
      const blob = await canvasToBlob(canvas)
      blobRef.current = blob
      setStripUrl((old) => {
        if (old) URL.revokeObjectURL(old)
        return URL.createObjectURL(blob)
      })
    },
    [hasFrame, id, frameW, frameH, slots]
  )

  /** Shoots the given slots in order: one index for a single retake, all for a full run. */
  async function runCapture(indices: number[]) {
    if (!(await ensureCamera())) return
    abortRef.current = false
    setError('')
    setStage('capturing')

    const next = [...shotsRef.current]
    for (const i of indices) {
      setActiveIndex(i)
      for (let n = 3; n > 0; n--) {
        if (abortRef.current) return
        setCountdown(n)
        await sleep(1000)
      }
      if (abortRef.current) return
      setCountdown(null)

      const raw = grabFrame()
      if (!raw) {
        setCameraError('The camera stopped unexpectedly. Reload and try again.')
        return
      }
      const photo = toLandscape(raw)
      // Shutter flash: the only feedback the shot landed, since there is no sound.
      setFlash((f) => f + 1)
      next[i] = { photo, thumb: thumbUrl(photo) }
      shotsRef.current = [...next]
      setShots([...next])
      await sleep(600)
    }

    setActiveIndex(null)
    setRetakeIndex(null)

    if (next.every((s): s is Shot => s !== null)) {
      try {
        await buildStrip(next)
        setStage('preview')
      } catch {
        setError('Could not build your photo strip. Please try again.')
        setStage('attract')
      }
    }
  }

  function cancelRetake() {
    abortRef.current = true
    setCountdown(null)
    setActiveIndex(null)
    setRetakeIndex(null)
    setStage('preview')
  }

  /** Opens the drag-to-reposition overlay for one photo, seeded from its current crop. */
  function openReposition(i: number) {
    const shot = shotsRef.current[i]
    if (!shot) return
    setRepositionOffset(shot.photo.offset ?? CENTERED)
    // A one-off snapshot for the interactive layer — cheap since this only
    // happens on open, not per drag frame.
    setRepositionSrc((shot.photo.source as HTMLCanvasElement).toDataURL('image/jpeg', 0.85))
    setRepositionIndex(i)
  }

  function cancelReposition() {
    setRepositionIndex(null)
    setRepositionSrc('')
  }

  /** Commits the dragged offset onto that one photo and recomposites the strip. */
  async function commitReposition() {
    const i = repositionIndex
    if (i === null) return
    const shot = shotsRef.current[i]
    if (!shot) return cancelReposition()

    const next = [...shotsRef.current]
    next[i] = { ...shot, photo: { ...shot.photo, offset: repositionOffset } }
    shotsRef.current = next
    setShots(next)
    cancelReposition()

    if (next.every((s): s is Shot => s !== null)) {
      try {
        await buildStrip(next)
      } catch {
        setError('Could not update your photo strip. Please try again.')
      }
    }
  }

  function dragStart(e: React.PointerEvent) {
    e.preventDefault()
    try {
      ;(e.target as Element).setPointerCapture(e.pointerId)
    } catch {}
    dragRef.current = { startX: e.clientX, startY: e.clientY, origin: repositionOffset }
  }

  function dragMove(e: React.PointerEvent) {
    const drag = dragRef.current
    if (!drag) return
    const box = e.currentTarget.getBoundingClientRect()
    // Natural "grab and move": dragging the photo right slides it right under a
    // fixed window, which reveals more of its LEFT side — so the stored crop
    // fraction moves opposite the pointer, same as Facebook/Instagram's
    // photo-reposition drag.
    const dx = (e.clientX - drag.startX) / box.width
    const dy = (e.clientY - drag.startY) / box.height
    setRepositionOffset({
      x: clamp(drag.origin.x - dx, 0, 1),
      y: clamp(drag.origin.y - dy, 0, 1),
    })
  }

  function dragEnd() {
    dragRef.current = null
  }

  function startOver() {
    shotsRef.current = Array(shotCount).fill(null)
    setShots(Array(shotCount).fill(null))
    cancelReposition()
    runCapture(allIndices(shotCount))
  }

  function reset() {
    if (stripUrl) URL.revokeObjectURL(stripUrl)
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    // Detach the dead stream too, so the next guest's camera attaches to a clean
    // element rather than one still holding ended tracks.
    if (videoRef.current) videoRef.current.srcObject = null
    blobRef.current = null
    shotsRef.current = Array(shotCount).fill(null)
    setShots(Array(shotCount).fill(null))
    setStripUrl('')
    setEmail('')
    setError('')
    setResetIn(RESET_SECONDS)
    setDownloadUrl('')
    setQrSrc('')
    setCanShareFiles(false)
    cancelReposition()
    setStage('attract')
  }

  async function send(e: React.FormEvent) {
    e.preventDefault()
    if (!blobRef.current) return
    setSending(true)
    setError('')

    const body = new FormData()
    body.append('workspaceId', id)
    body.append('email', email)
    body.append('image', blobRef.current, 'photostrip.png')
    // The strip plus every raw photo — the server attaches each one separately.
    for (const shot of shotsRef.current) {
      if (!shot) continue
      const source = shot.photo.source as HTMLCanvasElement
      const raw = await new Promise<Blob | null>((resolve) =>
        source.toBlob(resolve, 'image/png')
      )
      if (raw) body.append('photo', raw, 'photo.png')
    }

    try {
      const res = await fetch('/api/send', { method: 'POST', body })
      if (res.ok) {
        streamRef.current?.getTracks().forEach((t) => t.stop())
        streamRef.current = null
        setStage('sent')
      } else {
        setError((await res.json()).error ?? 'Could not send. Please try again.')
      }
    } catch {
      setError('Network problem. Check the connection and try again.')
    } finally {
      setSending(false)
    }
  }

  // The booth resets itself so the next guest walks up to a clean attract screen.
  useEffect(() => {
    if (stage !== 'sent') return
    const timer = setInterval(() => setResetIn((s) => s - 1), 1000)
    return () => clearInterval(timer)
  }, [stage])

  useEffect(() => {
    if (stage === 'sent' && resetIn <= 0) reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, resetIn])

  // Uploads the finished strip so it has a real URL a phone can scan and fetch —
  // a blob: URL only exists inside this one browser tab, so it can't be shared.
  // Keyed on stripUrl (not stage) so this is available the moment a strip
  // exists — in preview, as an alternative to email, not gated behind sending
  // one — and re-runs if a retake or reposition changes the strip afterward.
  // Optional feature: fails quiet if no Blob token is configured server-side.
  useEffect(() => {
    if (!stripUrl || !blobRef.current) return
    let cancelled = false

    async function createDownloadLink() {
      try {
        const body = new FormData()
        body.append('workspaceId', id)
        body.append('image', blobRef.current!, 'photostrip.png')
        const res = await fetch('/api/strip', { method: 'POST', body })
        if (!res.ok) throw new Error((await res.json()).error ?? 'upload failed')
        const { url } = await res.json()
        if (cancelled) return
        setDownloadUrl(url)
        setQrSrc(await toQrDataUrl(url, { margin: 1, width: 240 }))
      } catch (err) {
        console.warn('Scan-to-download link unavailable:', err)
      }
    }

    createDownloadLink()
    return () => {
      cancelled = true
    }
  }, [stripUrl, id])

  // Feature-detect the native share sheet (AirDrop on iOS, Nearby Share on
  // Android, etc.) — not every browser can share actual files, only some can,
  // so this must be checked against the real file rather than assumed from
  // the API's mere presence. Same stripUrl-keyed availability as above.
  useEffect(() => {
    if (!stripUrl || !blobRef.current) {
      setCanShareFiles(false)
      return
    }
    const file = new File([blobRef.current], 'photostrip.png', { type: 'image/png' })
    setCanShareFiles(Boolean(navigator.canShare?.({ files: [file] })))
  }, [stripUrl])

  async function shareStrip() {
    if (!blobRef.current) return
    const file = new File([blobRef.current], 'photostrip.png', { type: 'image/png' })
    try {
      await navigator.share({ files: [file], title: name })
    } catch (err) {
      // AbortError just means the guest closed the share sheet — not a failure.
      if (err instanceof Error && err.name !== 'AbortError') {
        setError('Could not open the share sheet. Try the download link instead.')
      }
    }
  }

  const frameUrl = hasFrame ? `/api/frame/${id}` : null
  const stripProps = { slots, frameUrl, frameW, frameH, shots, activeIndex }
  // Preview/email/sent show the real composited PNG, not the low-res thumbnails
  // used for live progress — those are 200px/q0.6 and look blurry scaled up to
  // hero size, even though the emailed file (built from the full-res photos) is fine.
  const finishedProps = { ...stripProps, finalSrc: stripUrl }

  if (cameraError) {
    return (
      <div className="booth-root">
        <div className="booth-glow is-err" />
        <div className="booth-center">
          <span className="booth-badge is-err">
            <AlertIcon size={38} />
          </span>
          <h1 className="booth-display is-sm">No camera yet</h1>
          <p className="booth-lede" style={{ maxWidth: '46ch' }}>
            {cameraError}
          </p>
          <button className="btn-booth" onClick={() => window.location.reload()}>
            Reload and try again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="booth-root" data-stage={stage}>
      {/* The feed stays mounted across stages so the stream survives a retake. */}
      <video ref={videoRef} className="booth-feed" playsInline muted autoPlay />
      <div className={stage === 'capturing' ? 'booth-vignette' : 'booth-glow'} />

      {stage === 'attract' && (
        <div className="booth-split">
          <div className="booth-copy">
            <h1 className="booth-display">{name}</h1>
            {error && (
              <p className="booth-err" role="alert">
                {error}
              </p>
            )}
            <div className="booth-cta-row">
              <button className="btn-booth is-lg" onClick={startOver}>
                <CameraIcon size={24} />
                Start my strip
              </button>
            </div>
          </div>
          <div className="booth-strip-hero is-tilted">
            <Strip {...stripProps} />
          </div>
        </div>
      )}

      {stage === 'capturing' && (
        <div className="booth-stage">
          <div className="booth-stage-top">
            <div className="booth-chip">
              <span className="booth-dot" />
              {retakeIndex === null ? name : `redoing shot ${retakeIndex + 1} only`}
            </div>
            <div className="booth-panel">
              <div className="booth-panel-label">your strip</div>
              <Strip {...stripProps} />
              {retakeIndex !== null && (
                <div className="booth-panel-note">the others are kept</div>
              )}
            </div>
          </div>

          <div className="booth-count" aria-live="assertive">
            {countdown !== null && (
              <>
                <span key={countdown} className="booth-count-n">
                  {countdown}
                </span>
                <span className="booth-count-label">
                  {retakeIndex === null ? 'hold it' : 'one shot only'}
                </span>
              </>
            )}
          </div>

          <div className="booth-stage-bottom">
            <div className="booth-bars" aria-hidden="true">
              {shots.map((s, i) => (
                <span
                  key={i}
                  className={`booth-bar ${i === activeIndex ? 'is-now' : s ? 'is-done' : ''}`}
                />
              ))}
            </div>
            <div className="booth-status">
              {retakeIndex === null
                ? `Shot ${Math.min((activeIndex ?? 0) + 1, shotCount)} of ${shotCount}`
                : `Replacing photo ${retakeIndex + 1}`}
            </div>
            {retakeIndex !== null && (
              <button className="btn-booth-ghost" onClick={cancelRetake}>
                Keep the old one
              </button>
            )}
            {/* Narrow screens have no room for the side panel, so the strip lives here. */}
            <div className="booth-thumbrow" aria-hidden="true">
              {shots.map((s, i) => (
                <span key={i} className={`booth-thumb ${i === activeIndex ? 'is-now' : ''}`}>
                  {s && <img src={s.thumb} alt="" />}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {stage === 'preview' && (
        <div className="booth-split is-preview">
          <div className="booth-strip-hero is-tilted">
            <Strip
              {...finishedProps}
              onSlotClick={
                repositionIndex === null
                  ? (i) => {
                      setRetakeIndex(i)
                      runCapture([i])
                    }
                  : undefined
              }
              onReposition={repositionIndex === null ? openReposition : undefined}
              active={
                repositionIndex === null
                  ? undefined
                  : {
                      index: repositionIndex,
                      src: repositionSrc,
                      offset: repositionOffset,
                      onPointerDown: dragStart,
                      onPointerMove: dragMove,
                      onPointerUp: dragEnd,
                    }
              }
            />
          </div>
          <div className="booth-copy">
            {repositionIndex === null ? (
              <>
                <h1 className="booth-display is-sm">Keep it?</h1>
                {error && (
                  <p className="booth-err" role="alert">
                    {error}
                  </p>
                )}
                <div className="booth-actions">
                  <button className="btn-booth is-lg" onClick={() => setStage('email')}>
                    <MailIcon size={22} />
                    Email it to me
                  </button>
                  {canShareFiles && (
                    <button type="button" className="btn-booth-ghost" onClick={shareStrip}>
                      <ShareIcon size={16} />
                      Share / AirDrop
                    </button>
                  )}
                  <button className="btn-booth-ghost" onClick={startOver}>
                    Start over
                  </button>
                </div>
                {qrSrc && (
                  <div className="booth-qr">
                    <img src={qrSrc} alt="QR code that links to your photo strip" />
                    <div>
                      <p className="booth-lede" style={{ margin: 0 }}>
                        Or scan to download on your phone
                      </p>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                <h1 className="booth-display is-sm">Photo {repositionIndex + 1}</h1>
                <p className="booth-lede">Drag the photo to move it inside the frame.</p>
                <div className="booth-actions">
                  <button className="btn-booth is-lg" onClick={commitReposition}>
                    <CheckIcon size={22} />
                    Done
                  </button>
                  <button className="btn-booth-ghost" onClick={() => setRepositionOffset(CENTERED)}>
                    Center it
                  </button>
                  <button className="btn-booth-ghost" onClick={cancelReposition}>
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {stage === 'email' && (
        <div className="booth-email">
          <button className="btn-booth-ghost is-back" onClick={() => setStage('preview')}>
            <ArrowLeftIcon size={17} />
            Back to strip
          </button>
          <div className="booth-split is-email">
            <div className="booth-strip-hero is-sm">
              <Strip {...finishedProps} />
            </div>
            <div className="booth-copy">
              <h1 className="booth-display is-sm">Where do we send it?</h1>
              <form onSubmit={send} className="booth-form">
                <label className="booth-label" htmlFor="email">
                  your email
                </label>
                <div className="booth-send-row">
                  <input
                    id="email"
                    className="booth-input"
                    type="email"
                    required
                    autoFocus
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={sending}
                    aria-describedby={error ? 'send-error' : undefined}
                  />
                  <button className="btn-booth is-lg" disabled={sending || !email}>
                    {sending ? 'Sending…' : 'Send it'}
                  </button>
                </div>
                {error ? (
                  <p id="send-error" className="booth-err" role="alert">
                    {error}
                  </p>
                ) : (
                  <p className="booth-hint is-flat">press enter to send</p>
                )}
              </form>
            </div>
          </div>
        </div>
      )}

      {stage === 'sent' && (
        <div className="booth-split is-sent">
          <div className="booth-copy">
            <span className="booth-badge is-ok">
              <CheckIcon size={38} />
            </span>
            <h1 className="booth-display is-sm">On its way</h1>
            <p className="booth-lede">
              Sending to <strong>{email}</strong>. Check spam if it hides.
            </p>
            <div className="booth-actions is-row">
              <button className="btn-booth is-lg" onClick={reset}>
                Next guest
              </button>
              {canShareFiles ? (
                <button type="button" className="btn-booth-ghost" onClick={shareStrip}>
                  <ShareIcon size={16} />
                  Share / AirDrop
                </button>
              ) : (
                <a className="btn-booth-ghost" href={stripUrl} download="photostrip.png">
                  Download the file
                </a>
              )}
            </div>
            {qrSrc && (
              <div className="booth-qr">
                <img src={qrSrc} alt="QR code that links to your photo strip" />
                <div>
                  <p className="booth-lede" style={{ margin: 0 }}>
                    Scan to download on your own phone
                  </p>
                  <a className="booth-qr-link" href={downloadUrl} target="_blank" rel="noreferrer">
                    {downloadUrl}
                  </a>
                </div>
              </div>
            )}
            <p className="booth-hint is-flat">resetting in {Math.max(resetIn, 0)}s</p>
          </div>
          <div className="booth-strip-hero is-tilted-2">
            <Strip {...finishedProps} />
          </div>
        </div>
      )}

      {flash > 0 && stage === 'capturing' && countdown === null && (
        <div key={flash} className="booth-flash" />
      )}
    </div>
  )
}

/**
 * The strip itself: photos in their slots, the frame PNG on top, and — in preview —
 * a hover overlay per slot with up to two actions (reposition, retake), plus the
 * live drag layer for whichever one photo is currently being repositioned.
 */
function Strip({
  slots,
  frameUrl,
  frameW,
  frameH,
  shots,
  activeIndex,
  finalSrc,
  onSlotClick,
  onReposition,
  active,
}: {
  slots: Slot[]
  frameUrl: string | null
  frameW: number
  frameH: number
  shots: (Shot | null)[]
  activeIndex: number | null
  /** The real composited PNG (full-res photos + frame baked in). When set, this
   * replaces the per-slot thumbnail mockup below — those are 200px/q0.6 jpegs,
   * fine for live progress during capture, but visibly soft once the strip is
   * actually finished and shown at hero size. */
  finalSrc?: string
  onSlotClick?: (index: number) => void
  onReposition?: (index: number) => void
  /** The one slot currently being dragged, if any — drawn on top of `finalSrc`
   * at that slot's exact rect, so it lines up with what's already baked in. */
  active?: {
    index: number
    src: string
    offset: { x: number; y: number }
    onPointerDown: (e: React.PointerEvent) => void
    onPointerMove: (e: React.PointerEvent) => void
    onPointerUp: () => void
  }
}) {
  const pct = (s: Slot) => ({
    left: `${s.x * 100}%`,
    top: `${s.y * 100}%`,
    width: `${s.w * 100}%`,
    height: `${s.h * 100}%`,
  })

  return (
    <div className="strip" style={{ aspectRatio: `${frameW} / ${frameH}` }}>
      {finalSrc ? (
        <img className="strip-final" src={finalSrc} alt="Your finished photo strip" />
      ) : (
        <>
          {slots.map((slot, i) => {
            const shot = shots[i]
            return (
              <div
                key={i}
                className={`strip-slot ${shot ? 'is-filled' : ''} ${i === activeIndex ? 'is-now' : ''}`}
                style={pct(slot)}
              >
                {shot && <img src={shot.thumb} alt="" />}
                {i === activeIndex && <span className="strip-now">now</span>}
              </div>
            )
          })}

          {frameUrl && <img className="strip-frame" src={frameUrl} alt="" />}
        </>
      )}

      {active && slots[active.index] && (
        <div className="strip-reposition" style={pct(slots[active.index])}>
          <img
            src={active.src}
            alt=""
            draggable={false}
            style={{
              objectPosition: `${active.offset.x * 100}% ${active.offset.y * 100}%`,
            }}
            onPointerDown={active.onPointerDown}
            onPointerMove={active.onPointerMove}
            onPointerUp={active.onPointerUp}
            onPointerCancel={active.onPointerUp}
          />
        </div>
      )}

      {(onSlotClick || onReposition) &&
        slots.map((slot, i) => (
          <div key={i} className="strip-hit" style={pct(slot)}>
            {onReposition && (
              <button
                type="button"
                className="strip-pill is-move"
                onClick={() => onReposition(i)}
                aria-label={`Reposition photo ${i + 1}`}
              >
                <MoveIcon size={14} />
                Reposition
              </button>
            )}
            {onSlotClick && (
              <button
                type="button"
                className="strip-pill"
                onClick={() => onSlotClick(i)}
                aria-label={`Retake photo ${i + 1}`}
              >
                <CameraIcon size={14} />
                Redo this one
              </button>
            )}
          </div>
        ))}
    </div>
  )
}
