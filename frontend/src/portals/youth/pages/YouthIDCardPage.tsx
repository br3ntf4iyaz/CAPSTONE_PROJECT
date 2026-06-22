import { useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Sparkles, ShieldCheck, Shield, MapPin, CreditCard,
  Printer, ArrowLeft,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useMe } from '@/hooks/useAuth'
import apiClient from '@/api/client'
import { cn } from '@/utils'
import { PageSpinner } from '@/components/ui/Spinner'

const YOUTH_TYPE_LABEL: Record<string, string> = {
  sk:                'SK Member',
  youth_org_leader:  'Youth Org Leader',
  general_youth:     'General Youth',
}

// Deterministic pseudo-random grid using user id as seed
function gridCell(idx: number, seed: number): boolean {
  return ((idx * 137 + seed * 31 + idx * idx) % 5) < 2
}

export default function YouthIDCardPage() {
  const { data: user, isLoading } = useMe()
  const cardRef = useRef<HTMLDivElement>(null)

  const { data: verification } = useQuery<{ is_verified: boolean }>({
    queryKey: ['verification-status'],
    queryFn: () => apiClient.get('/verification/').then(r => r.data).catch(() => ({ is_verified: false })),
  })

  if (isLoading || !user) return <PageSpinner />

  const isVerified = verification?.is_verified ?? false
  const initials = `${user.first_name?.[0] ?? ''}${user.last_name?.[0] ?? ''}`.toUpperCase() || 'YU'
  const memberId = user.id.toString().padStart(7, '0')
  const memberSince = new Date((user as any).date_joined).getFullYear()
  const youthTypeLabel = YOUTH_TYPE_LABEL[(user as any).youth_type] ?? 'Youth Member'
  const barangay = (user as any).profile?.barangay
  const skPosition = (user as any).profile?.sk_position
  const avatarUrl = (user as any).avatar_url

  return (
    <div className="max-w-lg mx-auto space-y-6 pb-12">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/profile" className="btn-secondary btn-sm flex items-center gap-1">
            <ArrowLeft size={14} /> Back
          </Link>
          <h1 className="page-title">My Digital ID</h1>
        </div>
        <button
          onClick={() => window.print()}
          className="btn-secondary btn-sm flex items-center gap-1.5 print:hidden"
        >
          <Printer size={14} /> Print
        </button>
      </div>

      {/* ── The Card ──────────────────────────────────────────────────────── */}
      <div
        ref={cardRef}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary-700 via-primary-800 to-primary-950 text-white shadow-2xl shadow-primary-900/30"
      >
        {/* Dot-grid texture */}
        <div
          className="absolute inset-0 opacity-[0.06] pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
            backgroundSize: '20px 20px',
          }}
        />
        {/* Accent glow */}
        <div className="absolute -bottom-24 -right-24 w-80 h-80 rounded-full bg-accent-400/20 blur-3xl pointer-events-none" />

        {/* Header strip */}
        <div className="relative flex items-center justify-between px-7 pt-6 pb-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-white/15 backdrop-blur-sm">
              <Sparkles size={17} strokeWidth={2.5} />
            </span>
            <div>
              <p className="font-display font-extrabold text-sm leading-none tracking-tighter2">LYDO</p>
              <p className="text-[10px] text-white/55 font-semibold uppercase tracking-wider">Lucena Youth Dev. Office</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-white/40 uppercase tracking-widest">Youth ID Card</p>
            <p className="text-[11px] text-white/65 font-mono font-bold mt-0.5">#{memberId}</p>
          </div>
        </div>

        {/* Body */}
        <div className="relative px-7 py-6">
          <div className="flex items-start gap-5">
            {/* Avatar */}
            <div className="flex-shrink-0 flex flex-col items-center gap-2">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={user.full_name}
                  className="w-20 h-20 rounded-2xl object-cover border-2 border-white/20 shadow-lg"
                />
              ) : (
                <div className="w-20 h-20 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center text-2xl font-bold border-2 border-white/20">
                  {initials}
                </div>
              )}
              {isVerified ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-400/20 border border-emerald-300/30">
                  <ShieldCheck size={10} className="text-emerald-300" />
                  <span className="text-[10px] font-bold text-emerald-200">Verified</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-400/15 border border-amber-300/20">
                  <Shield size={10} className="text-amber-300" />
                  <span className="text-[10px] font-semibold text-amber-200">Unverified</span>
                </span>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0 pt-1">
              <h2 className="font-display font-extrabold text-2xl tracking-tighter2 leading-none mb-1.5">
                {user.first_name}
                <br />
                {user.last_name}
              </h2>
              <p className="text-sm text-white/65 font-semibold mb-3">{youthTypeLabel}</p>

              <div className="space-y-1.5">
                {barangay && (
                  <div className="flex items-center gap-1.5 text-xs text-white/55">
                    <MapPin size={11} className="text-accent-300 flex-shrink-0" />
                    <span>Brgy. {barangay}, Lucena City</span>
                  </div>
                )}
                {skPosition && (
                  <div className="flex items-center gap-1.5 text-xs text-white/55">
                    <Sparkles size={11} className="text-accent-300 flex-shrink-0" />
                    <span>{skPosition}</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5 text-xs text-white/55">
                  <CreditCard size={11} className="text-accent-300 flex-shrink-0" />
                  <span>Member since {memberSince}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Member ID + pixel grid row */}
          <div className="mt-5 pt-4 border-t border-white/10 flex items-end justify-between">
            <div>
              <p className="text-[9px] text-white/35 uppercase tracking-widest mb-1">Member ID</p>
              <p className="font-mono font-bold text-2xl tracking-[0.15em] text-white/90">
                {memberId}
              </p>
            </div>

            {/* Deterministic pixel "code" based on user.id — decorative */}
            <div className="grid gap-[3px]" style={{ gridTemplateColumns: 'repeat(7, 1fr)' }}>
              {Array.from({ length: 49 }, (_, i) => (
                <div
                  key={i}
                  className={cn(
                    'w-2.5 h-2.5 rounded-[1.5px]',
                    gridCell(i, user.id) ? 'bg-white/80' : 'bg-white/10',
                  )}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Footer strip */}
        <div className="relative px-7 py-3 bg-black/20 flex items-center justify-between">
          <p className="text-[10px] text-white/35">City Government of Lucena · LYDO Portal</p>
          <p className="text-[10px] text-white/35 font-mono">{new Date().getFullYear()}</p>
        </div>
      </div>

      {/* Info card */}
      <div className="card p-5 space-y-3">
        <p className="text-sm font-semibold text-ink-800">About your Digital ID</p>
        <p className="text-sm text-ink-500 leading-relaxed">
          This card confirms your membership in the LYDO Youth Portal. Present this screen to Lucena
          Youth Development Office staff for identification. Your Member ID is used in official
          youth program records.
        </p>
        {!isVerified && (
          <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm">
            <Shield size={15} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-amber-700">
              <Link to="/verify-identity" className="font-semibold underline underline-offset-2">
                Verify your identity
              </Link>{' '}
              to display a Verified badge on your card.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
