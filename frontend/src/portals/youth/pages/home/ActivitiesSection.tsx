import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { cn } from '@/utils'
import { ProgramSlider } from './ProgramSlider'
import type { Slide } from './types'

export function ActivitiesSection({ slides }: { slides: Slide[] }) {
  const [sliderCurrent, setSliderCurrent] = useState(0)

  // ── Activities Slider ───────────────────────────────────────────
  return (
    <section id="community" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
        <div>
          <p className="eyebrow mb-3">Programs &amp; Activities</p>
          <h2 className="font-display font-extrabold text-3xl sm:text-4xl lg:text-5xl text-ink-900 tracking-tighter2 max-w-2xl">
            Programs that made moves this season.
          </h2>
        </div>
        <Link to="/programs" className="btn-secondary self-start sm:self-end whitespace-nowrap">
          See all programs <ArrowRight size={16} />
        </Link>
      </header>

      <ProgramSlider slides={slides} current={sliderCurrent} setCurrent={setSliderCurrent} />

      {/* Thumbnail strip — clicking navigates the slider */}
      <div className="mt-4 grid grid-cols-5 gap-2">
        {slides.map((s, i) => (
          <button
            key={s.id}
            onClick={() => setSliderCurrent(i)}
            aria-label={`Go to slide: ${s.title}`}
            className={cn(
              'relative rounded-xl overflow-hidden aspect-video border-2 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
              i === sliderCurrent
                ? 'border-primary-500 opacity-100 scale-[1.03] shadow-md'
                : 'border-transparent opacity-55 hover:opacity-80 hover:border-primary-300',
            )}
          >
            <img
              src={s.image}
              alt=""
              className="w-full h-full object-cover"
              onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
            <div className="absolute inset-0 bg-gradient-to-br from-primary-700/50 to-primary-900/50" />
            <span className="absolute bottom-1 left-1 right-1 text-white text-[9px] font-semibold leading-tight line-clamp-1 drop-shadow">
              {s.title}
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}
