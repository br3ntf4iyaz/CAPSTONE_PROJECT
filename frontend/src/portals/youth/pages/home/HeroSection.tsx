import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Sparkles } from 'lucide-react'
import type { PublicStats } from './types'

const HERO_IMAGES = [
  '/images/activities/hero-youth-1.jpg',
  '/images/activities/hero-youth-2.jpg',
]

export function HeroSection({ isAuthenticated, stats }: { isAuthenticated: boolean; stats?: PublicStats | null }) {
  // Background slideshow: crossfade + Ken Burns zoom
  const [heroIdx, setHeroIdx] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setHeroIdx(i => (i + 1) % HERO_IMAGES.length), 8000)
    return () => clearInterval(t)
  }, [])

  return (
    <section className="relative overflow-hidden bg-primary-900 text-white">
      {/* Hero background slideshow — crossfade + Ken Burns zoom */}
      {HERO_IMAGES.map((src, i) => (
        <img
          key={src}
          src={src}
          alt=""
          aria-hidden
          className="absolute inset-0 w-full h-full object-cover object-center pointer-events-none select-none"
          style={{
            opacity: i === heroIdx ? 1 : 0,
            transition: 'opacity 1.8s ease-in-out',
            animation: i === heroIdx ? 'heroZoom 16s ease-out forwards' : 'none',
            transform: i === heroIdx ? undefined : 'scale(1)',
          }}
        />
      ))}
      {/* Ken Burns keyframe */}
      <style>{`
        @keyframes heroZoom {
          from { transform: scale(1.08); }
          to   { transform: scale(1.0); }
        }
      `}</style>
      {/* Dark gradient overlay — keeps text readable */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary-900/80 via-primary-800/75 to-primary-900/85 pointer-events-none" />
      {/* Decorative dotted grid */}
      <div
        className="absolute inset-0 opacity-[0.06] pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />
      <div aria-hidden className="absolute -top-20 -right-20 w-96 h-96 rounded-full bg-accent-400/15 blur-3xl pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-24 sm:pt-20 sm:pb-32">
        <div className="max-w-3xl mx-auto text-center">
          <div>
            <div
              className="reveal inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/20 backdrop-blur-sm text-[12px] font-semibold mb-6"
              style={{ ['--delay' as any]: '0ms' }}
            >
              <Sparkles size={14} className="text-accent-300" />
              <span>Lucena City Youth Development Office</span>
            </div>

            <h1
              className="reveal font-display font-extrabold text-5xl sm:text-6xl lg:text-7xl leading-[1.02] tracking-tighter2 mb-6"
              style={{ ['--delay' as any]: '120ms' }}
            >
              Built for{' '}
              <span className="relative inline-block">
                <span className="relative z-10 text-accent-300">young Lucenahins</span>
                <span className="absolute left-0 right-0 bottom-1 h-3 bg-accent-400/30 rounded-sm -z-0" />
              </span>
              <br />
              ready to lead.
            </h1>

            <p
              className="reveal max-w-xl mx-auto text-primary-100 text-lg leading-relaxed mb-10"
              style={{ ['--delay' as any]: '240ms' }}
            >
              Programs, events, scholarships, and opportunities &mdash; curated by the
              LYDO for every barangay and every young person in the city.
            </p>

            <div
              className="reveal flex flex-col sm:flex-row gap-3 justify-center"
              style={{ ['--delay' as any]: '360ms' }}
            >
              {isAuthenticated ? (
                <Link to="/dashboard" className="btn-accent text-base">
                  Go to my dashboard <ArrowRight size={16} />
                </Link>
              ) : (
                <Link to="/register" className="btn-accent text-base">
                  Create your account <ArrowRight size={16} />
                </Link>
              )}
              <a href="#features" className="btn-ghost-on-dark text-base">
                Explore the platform
              </a>
            </div>

            {/* Social proof stats strip */}
            <div
              className="reveal flex flex-wrap justify-center gap-6 mt-10 pt-8 border-t border-white/10"
              style={{ ['--delay' as any]: '480ms' }}
            >
              {[
                { value: stats?.registered_youth != null ? `${stats.registered_youth.toLocaleString()}+` : '2,000+', label: 'Registered youth' },
                { value: stats?.barangay_sk_councils != null ? `${stats.barangay_sk_councils}` : '40+',                  label: 'Barangay SK councils' },
                { value: stats?.youth_organizations != null ? `${stats.youth_organizations}+` : '50+',                  label: 'Youth organizations' },
                { value: stats?.active_jobs != null ? `${stats.active_jobs}` : '30+',                           label: 'Open jobs' },
              ].map(({ value, label }) => (
                <div key={label} className="text-center">
                  <p className="font-display font-extrabold text-2xl text-accent-300 leading-none">{value}</p>
                  <p className="text-xs text-primary-200 mt-1">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom curve */}
      <svg className="absolute bottom-0 left-0 right-0 w-full text-paper-50" viewBox="0 0 1440 60" fill="currentColor" preserveAspectRatio="none" aria-hidden>
        <path d="M0,60 L0,30 Q360,0 720,30 T1440,30 L1440,60 Z" />
      </svg>
    </section>
  )
}
