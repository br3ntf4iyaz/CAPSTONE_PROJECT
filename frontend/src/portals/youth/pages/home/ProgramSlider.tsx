import { useState, useEffect, useCallback, useRef } from 'react'
import { ArrowRight, ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react'
import { cn } from '@/utils'
import type { Slide } from './types'

export function ProgramSlider({
  slides,
  current,
  setCurrent,
}: {
  slides: Slide[]
  current: number
  setCurrent: (i: number) => void
}) {
  const [paused, setPaused] = useState(false)
  const [imgErrors, setImgErrors] = useState<Record<number, boolean>>({})
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const total = slides.length

  const next = useCallback(() => setCurrent((current + 1) % total), [current, total, setCurrent])
  const prev = useCallback(() => setCurrent((current - 1 + total) % total), [current, total, setCurrent])

  // Auto-advance
  useEffect(() => {
    if (paused) return
    timerRef.current = setInterval(next, 5000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [paused, next])

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') prev()
      if (e.key === 'ArrowRight') next()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [next, prev])

  const slide = slides[current]

  return (
    <div
      className="relative w-full overflow-hidden rounded-3xl shadow-xl"
      style={{ height: 'clamp(340px, 55vw, 620px)' }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Slides */}
      {slides.map((s, i) => (
        <div
          key={s.id}
          aria-hidden={i !== current}
          className={cn(
            'absolute inset-0 transition-opacity duration-700',
            i === current ? 'opacity-100 z-10' : 'opacity-0 z-0'
          )}
        >
          {/* Background image or gradient fallback */}
          {!imgErrors[s.id] ? (
            <img
              src={s.image}
              alt={s.title}
              className="absolute inset-0 w-full h-full object-cover"
              onError={() => setImgErrors(prev => ({ ...prev, [s.id]: true }))}
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-primary-700 via-primary-800 to-primary-900" />
          )}

          {/* Gradient overlay &mdash; bottom heavy so text is readable */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/40 to-transparent" />
        </div>
      ))}

      {/* Text content */}
      <div className="absolute bottom-0 left-0 right-0 z-20 px-6 sm:px-10 pb-8 sm:pb-10 max-w-2xl">
        <span className={cn('inline-block text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full mb-3', slide.tagColor)}>
          {slide.tag}
        </span>
        <h3 className="text-white font-display font-extrabold text-2xl sm:text-3xl lg:text-4xl leading-tight mb-2 drop-shadow-md">
          {slide.title}
        </h3>
        <p className="text-white/80 text-sm sm:text-base leading-relaxed line-clamp-2 sm:line-clamp-3 mb-3 drop-shadow">
          {slide.description}
        </p>
        <p className="text-white/60 text-xs font-semibold uppercase tracking-wider">
          {slide.organizer}
        </p>
      </div>

      {/* Prev / Next buttons */}
      <button
        onClick={prev}
        aria-label="Previous slide"
        className="absolute left-4 top-1/2 -translate-y-1/2 z-30 w-10 h-10 rounded-full bg-black/30 hover:bg-black/50 backdrop-blur-sm flex items-center justify-center text-white transition-all hover:scale-110"
      >
        <ChevronLeft size={20} />
      </button>
      <button
        onClick={next}
        aria-label="Next slide"
        className="absolute right-4 top-1/2 -translate-y-1/2 z-30 w-10 h-10 rounded-full bg-black/30 hover:bg-black/50 backdrop-blur-sm flex items-center justify-center text-white transition-all hover:scale-110"
      >
        <ChevronRight size={20} />
      </button>

      {/* Pause / Play */}
      <button
        onClick={() => setPaused(p => !p)}
        aria-label={paused ? 'Resume slideshow' : 'Pause slideshow'}
        className="absolute top-4 right-4 z-30 w-8 h-8 rounded-full bg-black/30 hover:bg-black/50 backdrop-blur-sm flex items-center justify-center text-white/80 transition-all"
      >
        {paused ? <Play size={13} fill="currentColor" /> : <Pause size={13} />}
      </button>

      {/* Dot indicators */}
      <div className="absolute bottom-4 right-6 z-30 flex items-center gap-1.5">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            aria-label={`Go to slide ${i + 1}`}
            className={cn(
              'rounded-full transition-all duration-300',
              i === current
                ? 'w-6 h-2 bg-white'
                : 'w-2 h-2 bg-white/50 hover:bg-white/70'
            )}
          />
        ))}
      </div>

      {/* Slide counter */}
      <div className="absolute top-4 left-4 z-30 text-white/70 text-xs font-bold tabular-nums">
        {String(current + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
      </div>

      {/* Progress bar */}
      {!paused && (
        <div className="absolute bottom-0 left-0 right-0 z-30 h-0.5 bg-white/20">
          <div
            key={current}
            className="h-full bg-white origin-left"
            style={{ animation: 'slideProgress 5s linear forwards' }}
          />
        </div>
      )}

      <style>{`
        @keyframes slideProgress {
          from { width: 0% }
          to   { width: 100% }
        }
      `}</style>
    </div>
  )
}
