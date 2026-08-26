'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  canvasToBlob,
  compositeStrip,
  loadImage,
  type Photo,
  type Slot,
} from '@/lib/composite'
import { AlertIcon, CameraIcon, CheckIcon, MailIcon } from '@/components/icons'

type Props = {
  id: string
  name: string
  shotCount: number
  hasFrame: boolean
  frameW: number
  frameH: number
  slots: Slot[]
}

type Stage = 'start' | 'capturing' | 'retaking' | 'preview' | 'sending' | 'sent'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

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
  const photosRef = useRef<Photo[]>([])

  const [stage, setStage] = useState<Stage>('start')
  const [cameraError, setCameraError] = useState('')
  const [countdown, setCountdown] = useState<number | null>(null)
  const [flash, setFlash] = useState(0)
  const [taken, setTaken] = useState(0)
  const [retakeIndex, setRetakeIndex] = useState<number | null>(null)
  const [thumbs, setThumbs] = useState<string[]>([])
  const [stripUrl, setStripUrl] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function startCamera() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError(
          'This browser cannot use the camera. Try Safari on iPhone or Chrome on Android.'
        )
        return
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        applyMaxResolution(stream)
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play().catch(() => {})
        }
      } catch (err) {
        const name = err instanceof DOMException ? err.name : ''
        setCameraError(
          name === 'NotAllowedError'
            ? 'Camera access was blocked. Allow camera for this site in your browser settings, then reload.'
            : name === 'NotFoundError'
              ? 'No camera found on this device.'
              : 'Could not start the camera. Reload and try again.'
        )
      }
    }

    startCamera()
    return () => {
      cancelled = true
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

  /** Small jpeg thumbnail for the per-photo retake picker. */
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
  const buildStrip = useCallback(async (photos: Photo[]) => {
    const frame = hasFrame ? await loadImage(`/api/frame/${id}`) : null
    const canvas = compositeStrip(photos, frame, frameW, frameH, slots)
    const blob = await canvasToBlob(canvas)
    blobRef.current = blob
    setStripUrl((old) => {
      if (old) URL.revokeObjectURL(old)
      return URL.createObjectURL(blob)
    })
    setThumbs(photos.map(thumbUrl))
  }, [hasFrame, id, frameW, frameH, slots, thumbUrl])

  async function capturePhoto() {
    for (let n = 3; n > 0; n--) {
      setCountdown(n)
      await sleep(1000)
    }
    setCountdown(null)
    const photo = grabFrame()
    if (!photo) {
      setCameraError('The camera stopped unexpectedly. Reload and try again.')
      setStage('start')
      return null
    }
    setFlash((f) => f + 1)
    await sleep(600)
    return toLandscape(photo)
  }

  async function runCapture() {
    setStage('capturing')
    setError('')
    setTaken(0)
    photosRef.current = []

    for (let i = 0; i < shotCount; i++) {
      const photo = await capturePhoto()
      if (!photo) return
      photosRef.current.push(photo)
      setTaken(i + 1)
    }

    try {
      await buildStrip(photosRef.current)
      setStage('preview')
    } catch {
      setError('Could not build your photo strip. Please try again.')
      setStage('start')
    }
  }

  /** Re-shoot just one photo, keeping the others. */
  async function retakeOne(index: number) {
    setStage('retaking')
    setRetakeIndex(index)
    setError('')
    const photo = await capturePhoto()
    if (!photo) return
    photosRef.current[index] = photo
    try {
      await buildStrip(photosRef.current)
      setRetakeIndex(null)
      setStage('preview')
    } catch {
      setError('Could not build your photo strip. Please try again.')
      setRetakeIndex(null)
      setStage('preview')
    }
  }

  function retake() {
    if (stripUrl) URL.revokeObjectURL(stripUrl)
    photosRef.current = []
    setThumbs([])
    setStripUrl('')
    blobRef.current = null
    setError('')
    setStage('start')
  }

  async function send(e: React.FormEvent) {
    e.preventDefault()
    if (!blobRef.current) return
    setStage('sending')
    setError('')

    const body = new FormData()
    body.append('workspaceId', id)
    body.append('email', email)
    body.append('image', blobRef.current, 'photostrip.png')
    for (const photo of photosRef.current) {
      const source = photo.source as HTMLCanvasElement
      const blob = await new Promise<Blob | null>((resolve) =>
        source.toBlob(resolve, 'image/png')
      )
      if (blob) body.append('photo', blob, `photo.png`)
    }

    try {
      const res = await fetch('/api/send', { method: 'POST', body })
      if (res.ok) {
        setStage('sent')
        streamRef.current?.getTracks().forEach((t) => t.stop())
      } else {
        setError((await res.json()).error ?? 'Could not send. Please try again.')
        setStage('preview')
      }
    } catch {
      setError('Network problem. Check the connection and try again.')
      setStage('preview')
    }
  }

  if (cameraError) {
    return (
      <div className="booth">
        <span className="step-n" style={{ width: 64, height: 64, background: 'rgba(178,58,76,.14)', color: 'var(--err)' }}>
          <AlertIcon size={32} />
        </span>
        <h1 className="booth-title">{name}</h1>
        <p className="err" role="alert" style={{ maxWidth: 400 }}>
          {cameraError}
        </p>
        <button className="secondary" onClick={() => window.location.reload()}>
          Reload
        </button>
      </div>
    )
  }

  if (stage === 'sent') {
    return (
      <div className="booth">
        <span
          className="step-n rise"
          style={{ width: 64, height: 64, background: 'rgba(63,127,99,.16)', color: 'var(--ok)' }}
        >
          <CheckIcon size={34} />
        </span>
        <h1 className="booth-title">On its way</h1>
        <p className="muted">Your photos are heading to {email}.</p>
        {stripUrl && (
          <div className="stage is-preview rise">
            <img src={stripUrl} alt="Your finished photo strip" />
          </div>
        )}
        <button className="primary" onClick={() => window.location.reload()}>
          Start over
        </button>
      </div>
    )
  }

  const showPreview = stage === 'preview' || stage === 'sending'
  const retaking = stage === 'retaking'

  return (
    <div className="booth">
      <h1 className="booth-title">{name}</h1>

      {stage === 'start' && (
        <p className="muted">
          {shotCount} photo{shotCount === 1 ? '' : 's'}, taken back to back with a
          countdown.
        </p>
      )}

      <div className={`stage ${showPreview ? 'is-preview' : ''}`}>
        {/* The video element stays mounted so the stream survives a retake. */}
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          style={{ display: showPreview ? 'none' : 'block' }}
        />
        {showPreview && stripUrl && <img src={stripUrl} alt="Your finished photo strip" />}
        {countdown !== null && (
          <div className="countdown" aria-live="assertive">
            <span key={countdown}>{countdown}</span>
          </div>
        )}
        {flash > 0 && !showPreview && countdown === null && (
          <div key={flash} className="flash" />
        )}
      </div>

      {(stage === 'capturing' || retaking) && (
        <>
          <div className="shots" aria-hidden="true">
            {Array.from({ length: shotCount }, (_, i) => (
              <span key={i} className={`pip ${retaking ? 'done' : i < taken ? 'done' : ''}`} />
            ))}
          </div>
          <p className="muted" aria-live="polite">
            {retaking
              ? `Retaking photo ${(retakeIndex ?? 0) + 1} of ${shotCount}`
              : `Photo ${Math.min(taken + 1, shotCount)} of ${shotCount} — get ready`}
          </p>
        </>
      )}

      {stage === 'start' && (
        <>
          {error && (
            <p className="err" role="alert">
              {error}
            </p>
          )}
          <button className="primary row" style={{ gap: 8 }} onClick={runCapture}>
            <CameraIcon size={20} />
            Start
          </button>
        </>
      )}

      {showPreview && (
        <form onSubmit={send}>
          {thumbs.length > 1 && (
            <div className="thumb-picker" aria-label="Retake a single photo">
              {thumbs.map((src, i) => (
                <button
                  key={i}
                  type="button"
                  className="thumb"
                  title={`Retake photo ${i + 1}`}
                  onClick={() => retakeOne(i)}
                  disabled={stage === 'sending'}
                >
                  <img src={src} alt={`Photo ${i + 1}`} />
                  <span className="thumb-overlay">Retake {i + 1}</span>
                </button>
              ))}
            </div>
          )}
          <div className="field">
            <label htmlFor="email">Where should we send it?</label>
            <input
              id="email"
              type="email"
              required
              placeholder="you@example.com"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={stage === 'sending'}
              aria-describedby={error ? 'send-error' : undefined}
            />
            {error && (
              <p id="send-error" className="err" role="alert" style={{ marginBottom: 0 }}>
                {error}
              </p>
            )}
          </div>
          <div className="row">
            <button
              type="button"
              className="secondary"
              onClick={retake}
              disabled={stage === 'sending'}
            >
              Retake
            </button>
            <button className="primary row" style={{ gap: 8 }} disabled={stage === 'sending' || !email}>
              <MailIcon size={18} />
              {stage === 'sending' ? 'Sending…' : 'Send it to me'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
