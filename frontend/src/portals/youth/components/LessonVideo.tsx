import { useEffect, useRef, useState } from 'react'
import { PlayCircle, ExternalLink, VideoOff } from 'lucide-react'
import apiClient from '@/api/client'

export type VideoKind = 'none' | 'file' | 'youtube' | 'direct' | 'other'

const YT_RE = /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/
const VIMEO_RE = /vimeo\.com\/(?:video\/)?(\d+)/

export function youtubeId(url: string): string | null {
  return url.match(YT_RE)?.[1] ?? null
}

// ── YouTube IFrame API (loaded once) ─────────────────────────────────────────
declare global {
  interface Window {
    YT?: any
    onYouTubeIframeAPIReady?: () => void
  }
}
let ytReady: Promise<void> | null = null
function loadYouTube(): Promise<void> {
  if (window.YT?.Player) return Promise.resolve()
  if (!ytReady) {
    ytReady = new Promise<void>(resolve => {
      const previous = window.onYouTubeIframeAPIReady
      window.onYouTubeIframeAPIReady = () => { previous?.(); resolve() }
      const tag = document.createElement('script')
      tag.src = 'https://www.youtube.com/iframe_api'
      document.head.appendChild(tag)
    })
  }
  return ytReady
}

export interface VideoReport { percent: number; watched: boolean }

/**
 * Plays the lesson video and reports playback to the server every few seconds. The server does the counting
 * (it only credits real playing time), so nothing here can mark a lesson as watched by itself.
 */
export default function LessonVideo({
  lessonId, title, durationMinutes, kind, source, requiredPercent, onReport, track = true,
}: {
  lessonId: number
  title: string
  durationMinutes: number | null
  kind: VideoKind
  source: string
  requiredPercent: number
  onReport: (r: VideoReport) => void
  /** false when reviewing a finished course: playing the video then reports nothing to the server */
  track?: boolean
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const lastSent = useRef(0)
  const [ytError, setYtError] = useState(false)

  const send = (position: number, duration: number) => {
    if (!track || !duration || !isFinite(duration)) return
    apiClient
      .post(`/courses/lessons/${lessonId}/video-progress/`, { position, duration })
      .then(r => onReport({ percent: r.data.video_percent, watched: r.data.video_watched }))
      .catch(() => undefined)
  }

  // YouTube
  useEffect(() => {
    if (kind !== 'youtube') return
    const id = youtubeId(source)
    if (!id || !hostRef.current) return
    let player: any
    let timer: number | undefined
    let cancelled = false
    loadYouTube()
      .then(() => {
        if (cancelled || !hostRef.current) return
        const mount = document.createElement('div')
        hostRef.current.innerHTML = ''
        hostRef.current.appendChild(mount)
        player = new window.YT.Player(mount, {
          videoId: id,
          width: '100%',
          height: '100%',
          playerVars: { rel: 0, modestbranding: 1, playsinline: 1 },
          events: {
            onStateChange: (e: any) => {
              const S = window.YT.PlayerState
              if (e.data === S.PLAYING) {
                window.clearInterval(timer)
                timer = window.setInterval(() => send(player.getCurrentTime(), player.getDuration()), 5000)
                send(player.getCurrentTime(), player.getDuration())
              } else if (e.data === S.PAUSED || e.data === S.ENDED) {
                window.clearInterval(timer)
                send(player.getCurrentTime(), player.getDuration())
              }
            },
            onError: () => setYtError(true),
          },
        })
      })
      .catch(() => setYtError(true))
    return () => {
      cancelled = true
      window.clearInterval(timer)
      try { player?.destroy() } catch { /* the page is leaving */ }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, source, lessonId])

  if (kind === 'none') {
    return (
      <div className="relative w-full rounded-2xl overflow-hidden bg-ink-50 border border-dashed border-ink-200 flex flex-col items-center justify-center text-center gap-2 px-6 py-12" style={{ aspectRatio: '16/9' }}>
        <VideoOff size={40} className="text-ink-300" />
        <p className="font-semibold text-ink-700">No video has been added to this lesson yet</p>
        <p className="text-xs text-ink-500 max-w-sm">
          Lesson: {title}{durationMinutes ? ` (about ${durationMinutes} min)` : ''}. The LYDO administrator will add the video here.
          For now, read the lesson notes below.
        </p>
      </div>
    )
  }

  if (kind === 'file' || kind === 'direct') {
    return (
      <div className="w-full rounded-2xl overflow-hidden bg-black shadow-lg">
        <video
          ref={videoRef}
          src={source}
          controls
          playsInline
          preload="metadata"
          className="w-full max-h-[70vh]"
          onPlay={() => { lastSent.current = Date.now() }}
          onTimeUpdate={e => {
            const v = e.currentTarget
            if (!v.paused && Date.now() - lastSent.current >= 5000) {
              lastSent.current = Date.now()
              send(v.currentTime, v.duration)
            }
          }}
          onPause={e => send(e.currentTarget.currentTime, e.currentTarget.duration)}
          onEnded={e => send(e.currentTarget.currentTime, e.currentTarget.duration)}
        >
          Your browser cannot play this video.
        </video>
      </div>
    )
  }

  if (kind === 'youtube') {
    return (
      <div>
        <div className="relative w-full rounded-2xl overflow-hidden bg-black shadow-lg" style={{ aspectRatio: '16/9' }}>
          <div ref={hostRef} className="absolute inset-0 [&>iframe]:h-full [&>iframe]:w-full" />
        </div>
        {ytError && (
          <p className="mt-2 text-xs text-amber-700">
            The video could not load here. <a className="underline" href={source} target="_blank" rel="noopener noreferrer">Open it on YouTube</a>
            {' '}and come back. Progress is only counted while it plays on this page.
          </p>
        )}
        <p className="mt-2 text-xs text-ink-500">
          Play at least {requiredPercent}% of the video to unlock the assessment.{' '}
          <a href={source} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary-700 underline">Open it on YouTube</a>
        </p>
      </div>
    )
  }

  // other links: an embed for Vimeo, otherwise a link. The learner confirms manually.
  const vimeo = source.match(VIMEO_RE)?.[1]
  return (
    <div className="space-y-3">
      {vimeo ? (
        <div className="relative w-full rounded-2xl overflow-hidden bg-black shadow-lg" style={{ aspectRatio: '16/9' }}>
          <iframe className="absolute inset-0 h-full w-full" src={`https://player.vimeo.com/video/${vimeo}`} title={title}
            allow="autoplay; fullscreen; picture-in-picture" allowFullScreen />
        </div>
      ) : (
        <div className="rounded-2xl bg-ink-50 border border-ink-100 px-6 py-10 text-center space-y-3">
          <PlayCircle size={40} className="mx-auto text-primary-500" />
          <p className="text-sm text-ink-700">This lesson video is hosted on another website.</p>
          <a href={source} target="_blank" rel="noopener noreferrer" className="btn-primary btn-sm inline-flex gap-1.5">
            <ExternalLink size={14} /> Open the video
          </a>
        </div>
      )}
      <p className="text-xs text-ink-500">This video cannot be tracked automatically. After you watch it, confirm below.</p>
    </div>
  )
}
