import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ThumbsUp } from 'lucide-react'
import { cn } from '@/utils'

/**
 * Facebook-style reactions for the Community Feed.
 *
 *  - Desktop (mouse): hovering the Like button opens the picker; move onto an emoji and click it.
 *  - Phones and tablets (touch/pen): press and hold the Like button, slide a finger over the emojis,
 *    release on one to choose it; releasing anywhere else cancels.
 *  - A plain click or tap on Like toggles a "like" (or removes the reaction you already have).
 */

export type ReactionKey = 'like' | 'love' | 'care' | 'haha' | 'wow' | 'sad' | 'angry'

export const REACTIONS: { key: ReactionKey; emoji: string; label: string; text: string }[] = [
  { key: 'like',  emoji: '👍', label: 'Like',  text: 'text-primary-600' },
  { key: 'love',  emoji: '❤️', label: 'Love',  text: 'text-red-500' },
  { key: 'care',  emoji: '🥰', label: 'Care',  text: 'text-amber-600' },
  { key: 'haha',  emoji: '😆', label: 'Haha',  text: 'text-amber-600' },
  { key: 'wow',   emoji: '😮', label: 'Wow',   text: 'text-amber-600' },
  { key: 'sad',   emoji: '😢', label: 'Sad',   text: 'text-amber-600' },
  { key: 'angry', emoji: '😡', label: 'Angry', text: 'text-orange-600' },
]

export const REACTION_BY_KEY = Object.fromEntries(REACTIONS.map(r => [r.key, r])) as Record<string, (typeof REACTIONS)[number]>

const OPEN_DELAY = 350   // mouse: hover time before the picker opens
const CLOSE_DELAY = 300  // mouse: grace time to move from the button into the picker
const LONG_PRESS = 400   // touch: press time before the picker opens

export function LikeButton({ value, onPick, disabled }: {
  value: string | null | undefined
  onPick: (r: ReactionKey) => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState<ReactionKey | null>(null) // emoji under the pointer / finger
  const [shift, setShift] = useState(0)                           // keeps the picker inside the screen
  const wrapRef = useRef<HTMLDivElement>(null)
  const pickerRef = useRef<HTMLDivElement>(null)
  const timer = useRef<number | undefined>(undefined)
  const touching = useRef(false)
  const longPressed = useRef(false)

  const clear = () => { window.clearTimeout(timer.current); timer.current = undefined }
  const close = useCallback(() => { clear(); setOpen(false); setActive(null); setShift(0) }, [])
  useEffect(() => clear, [])

  // never let the picker run off the left or right edge of the screen
  useLayoutEffect(() => {
    if (!open || !pickerRef.current) return
    const r = pickerRef.current.getBoundingClientRect()
    const margin = 8
    let dx = 0
    if (r.left < margin) dx = margin - r.left
    else if (r.right > window.innerWidth - margin) dx = window.innerWidth - margin - r.right
    if (Math.abs(dx) > 0.5) setShift(s => s + dx)
  }, [open, shift])

  // tapping somewhere else closes it
  useEffect(() => {
    if (!open) return
    const away = (e: PointerEvent) => { if (!wrapRef.current?.contains(e.target as Node)) close() }
    document.addEventListener('pointerdown', away)
    return () => document.removeEventListener('pointerdown', away)
  }, [open, close])

  const choose = (r: ReactionKey) => { close(); onPick(r) }

  const reactionAt = (x: number, y: number): ReactionKey | null => {
    const el = document.elementFromPoint(x, y) as HTMLElement | null
    return (el?.closest('[data-reaction]') as HTMLElement | null)?.dataset.reaction as ReactionKey | null ?? null
  }

  const current = value ? REACTION_BY_KEY[value] : null

  return (
    <div
      ref={wrapRef}
      className="relative"
      onPointerLeave={e => { if (e.pointerType === 'mouse' && open) { clear(); timer.current = window.setTimeout(close, CLOSE_DELAY) } }}
      onPointerEnter={e => { if (e.pointerType === 'mouse') clear() }}
      onKeyDown={e => {
        if (e.key === 'Escape') { close(); wrapRef.current?.querySelector<HTMLElement>('[data-like]')?.focus() }
        if (!open) return
        const items = Array.from(wrapRef.current?.querySelectorAll<HTMLElement>('[data-reaction]') ?? [])
        const i = items.indexOf(document.activeElement as HTMLElement)
        if (e.key === 'ArrowRight') { e.preventDefault(); items[(i + 1) % items.length]?.focus() }
        if (e.key === 'ArrowLeft') { e.preventDefault(); items[(i - 1 + items.length) % items.length]?.focus() }
      }}
    >
      {open && (
        <div
          ref={pickerRef}
          role="menu"
          aria-label="Choose a reaction"
          style={{ transform: `translateX(${shift}px)` }}
          className="absolute bottom-full left-0 mb-2 z-40 flex items-end gap-0.5 rounded-full bg-white border border-ink-100 shadow-xl px-2 py-1.5 animate-reaction-pop select-none"
        >
          {REACTIONS.map((r, i) => {
            const isActive = active === r.key
            return (
              <button
                key={r.key}
                type="button"
                role="menuitem"
                data-reaction={r.key}
                aria-label={r.label}
                onPointerEnter={e => { if (e.pointerType === 'mouse') setActive(r.key) }}
                onPointerLeave={e => { if (e.pointerType === 'mouse') setActive(a => (a === r.key ? null : a)) }}
                onFocus={() => setActive(r.key)}
                onBlur={() => setActive(a => (a === r.key ? null : a))}
                onClick={() => choose(r.key)}
                style={{ animationDelay: `${i * 30}ms` }}
                className={cn(
                  'relative w-10 h-10 rounded-full flex items-center justify-center text-[26px] leading-none transition-transform duration-150 origin-bottom animate-reaction-in focus-visible:outline-none',
                  isActive ? '-translate-y-2 scale-[1.45]' : 'hover:scale-110',
                  value === r.key && !isActive && 'bg-primary-50 ring-1 ring-primary-200',
                )}
              >
                {isActive && (
                  <span className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 scale-[0.69] whitespace-nowrap rounded-full bg-ink-900/90 px-2 py-0.5 text-xs font-semibold text-white">
                    {r.label}
                  </span>
                )}
                <span className={cn('inline-block', isActive && `reaction-anim-${r.key}`)}>{r.emoji}</span>
              </button>
            )
          })}
        </div>
      )}

      <button
        type="button"
        data-like
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        onContextMenu={e => e.preventDefault()}
        onKeyDown={e => { if (e.key === 'ArrowUp' || (e.key === 'ArrowRight' && !open)) { e.preventDefault(); setOpen(true); window.setTimeout(() => wrapRef.current?.querySelector<HTMLElement>('[data-reaction]')?.focus(), 30) } }}
        onPointerEnter={e => {
          if (e.pointerType !== 'mouse' || disabled) return
          clear(); timer.current = window.setTimeout(() => setOpen(true), OPEN_DELAY)
        }}
        onPointerLeave={e => { if (e.pointerType === 'mouse' && !open) clear() }}
        onPointerDown={e => {
          if (e.pointerType === 'mouse' || disabled) return
          touching.current = true
          longPressed.current = false
          clear()
          timer.current = window.setTimeout(() => { longPressed.current = true; setOpen(true) }, LONG_PRESS)
        }}
        onPointerMove={e => {
          if (!touching.current || !longPressed.current) return
          setActive(reactionAt(e.clientX, e.clientY))
        }}
        onPointerUp={e => {
          if (!touching.current) return
          touching.current = false
          clear()
          if (!longPressed.current) return // a normal tap: the click handler does the like
          const picked = reactionAt(e.clientX, e.clientY)
          if (picked) { choose(picked); return }
          // released on the Like button or the picker background keeps it open; anywhere else cancels
          const el = document.elementFromPoint(e.clientX, e.clientY)
          if (!el || !wrapRef.current?.contains(el)) close(); else setActive(null)
        }}
        onPointerCancel={() => { touching.current = false; close() }}
        onClick={() => {
          if (longPressed.current) { longPressed.current = false; return }
          close()
          onPick((current?.key ?? 'like') as ReactionKey) // clicking your own reaction again removes it
        }}
        className={cn(
          'flex items-center gap-1.5 text-xs font-semibold select-none [touch-action:none] [-webkit-touch-callout:none] rounded-lg px-1.5 py-1 -mx-1.5 transition-colors',
          current ? current.text : 'text-ink-500 hover:text-primary-600',
          disabled ? 'cursor-default' : 'cursor-pointer hover:bg-primary-50',
        )}
      >
        {current ? <span className="text-base leading-none">{current.emoji}</span> : <ThumbsUp size={15} />}
        {current ? current.label : 'Like'}
      </button>
    </div>
  )
}

/** The little row of the emojis actually used, with the total (the total opens the list of people). */
export function ReactionSummary({ summary, total, onOpen }: {
  summary: { type: string; count: number }[]
  total: number
  onOpen: () => void
}) {
  if (total <= 0) return null
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`See who reacted (${total})`}
      className="flex items-center gap-1.5 text-xs text-ink-500 hover:text-primary-700 hover:underline transition-colors"
    >
      <span className="flex -space-x-1">
        {summary.slice(0, 3).map(s => (
          <span key={s.type} className="w-5 h-5 rounded-full bg-white ring-2 ring-white flex items-center justify-center text-[13px] leading-none">
            {REACTION_BY_KEY[s.type]?.emoji}
          </span>
        ))}
      </span>
      <span className="font-medium">{total}</span>
    </button>
  )
}
