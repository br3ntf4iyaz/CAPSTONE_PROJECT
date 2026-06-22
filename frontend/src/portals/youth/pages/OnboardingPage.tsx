import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  CheckCircle2, Circle, UserCircle, ShieldCheck, Compass,
  ArrowRight, Sparkles, Building2,
} from 'lucide-react'
import apiClient from '@/api/client'
import { authApi } from '@/api/auth'
import { authStore } from '@/store/authStore'
import { cn } from '@/utils'

const PROFILE_STEP = {
  id: 'profile',
  icon: UserCircle,
  title: 'Complete your profile',
  description: 'Add your barangay, birthday, and a short bio so LYDO can personalise your experience.',
  action: { label: 'Go to profile', to: '/profile' },
}

const VERIFY_STEP = {
  id: 'verify',
  icon: ShieldCheck,
  title: 'Verify your identity',
  description: 'Upload a government-issued ID to unlock programme applications and submissions.',
  action: { label: 'Verify identity', to: '/verify-identity' },
}

const YORP_STEP = {
  id: 'yorp',
  icon: Building2,
  title: 'Register your organization',
  description: 'Submit your youth organization details for LYDO recognition. Requires identity verification first.',
  action: { label: 'Register organization', to: '/yorp-registration' },
}

const EXPLORE_STEP = {
  id: 'explore',
  icon: Compass,
  title: 'Explore the platform',
  description: 'Browse programs, upcoming events, scholarships, and your barangay SK council.',
  action: { label: 'Go to dashboard', to: '/dashboard' },
}

export default function OnboardingPage() {
  const qc = useQueryClient()

  const { data: profile } = useQuery({
    queryKey: ['me-profile'],
    queryFn: () => authApi.updateProfile({}).catch(() => ({ data: null })),
    retry: false,
  })

  const { data: verification } = useQuery<{ is_verified: boolean }>({
    queryKey: ['verification-status'],
    queryFn: () => apiClient.get('/verification/').then(r => r.data),
  })

  const completeOnboarding = useMutation({
    mutationFn: () => authApi.completeOnboarding(),
    onSuccess: async () => {
      const meRes = await authApi.me()
      authStore.setUser(meRes.data)
      qc.setQueryData(['me'], meRes.data)
    },
  })

  const user = authStore.user
  const isOrgLeader = user?.youth_type === 'youth_org_leader'
  const completeness = (profile as any)?.data?.completeness_percent ?? 0
  const isIdentityVerified = verification?.is_verified ?? false

  const { data: mySubmissions } = useQuery({
    queryKey: ['my-org-submissions'],
    queryFn: () =>
      apiClient.get('/youth-orgs/my-submissions/').then(r => {
        const d = r.data as any
        return (Array.isArray(d) ? d : (d?.results ?? [])) as { id: number; status: string }[]
      }),
    enabled: isOrgLeader,
  })

  const hasOrgSubmission = (mySubmissions ?? []).length > 0

  const steps = isOrgLeader
    ? [PROFILE_STEP, VERIFY_STEP, YORP_STEP, EXPLORE_STEP]
    : [PROFILE_STEP, VERIFY_STEP, EXPLORE_STEP]

  const stepDone: Record<string, boolean> = {
    profile: completeness >= 80,
    verify: isIdentityVerified,
    yorp: hasOrgSubmission,
    explore: false,
  }

  const allDone = stepDone.profile && stepDone.verify && (!isOrgLeader || stepDone.yorp)

  return (
    <div className="min-h-screen flex flex-col bg-paper-50">
      <div className="ph-stripe h-1 w-full" />

      <div className="bg-white border-b border-ink-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="relative inline-flex items-center justify-center w-9 h-9 rounded-xl bg-primary-600 text-white">
              <Sparkles size={18} strokeWidth={2.5} />
              <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-accent-400 border-2 border-white" />
            </span>
            <span className="flex flex-col leading-none">
              <span className="font-display font-extrabold text-lg text-ink-900 tracking-tightish">LYDO</span>
              <span className="text-[10px] font-semibold text-ink-500 uppercase tracking-wider">Lucena Youth</span>
            </span>
          </Link>
          {allDone && (
            <button
              onClick={() => completeOnboarding.mutate()}
              className="text-sm font-semibold text-primary-700 hover:text-primary-800 transition-colors"
            >
              Skip to dashboard →
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 flex items-start justify-center px-4 py-12">
        <div className="w-full max-w-xl">
          <div className="mb-10 text-center">
            <p className="eyebrow mb-3">Getting started</p>
            <h1 className="font-display font-extrabold text-4xl text-ink-900 tracking-tighter2 mb-3">
              Welcome, {user?.first_name ?? 'there'}!
            </h1>
            <p className="text-ink-600 leading-relaxed">
              Complete these steps to get the most out of the Lucena Youth Leadership Hub.
            </p>
          </div>

          <div className="space-y-4 mb-8">
            {steps.map((step, idx) => {
              const done = stepDone[step.id] ?? false
              const blocked = step.id === 'yorp' && !stepDone.verify
              const Icon = step.icon
              return (
                <div
                  key={step.id}
                  className={cn(
                    'bg-white rounded-2xl border p-5 flex items-start gap-4 transition-all',
                    done ? 'border-emerald-200 bg-emerald-50/40' : blocked ? 'border-ink-100 opacity-60' : 'border-ink-200'
                  )}
                >
                  <div className={cn(
                    'flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center',
                    done ? 'bg-emerald-100' : 'bg-primary-50'
                  )}>
                    <Icon size={20} className={done ? 'text-emerald-600' : 'text-primary-600'} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold text-ink-400 uppercase tracking-wide">Step {idx + 1}</span>
                      {done
                        ? <CheckCircle2 size={14} className="text-emerald-500" />
                        : <Circle size={14} className="text-ink-300" />}
                    </div>
                    <p className="font-display font-bold text-ink-900 mb-1">{step.title}</p>
                    <p className="text-sm text-ink-600 leading-relaxed mb-3">{step.description}</p>
                    {!done && !blocked && (
                      <Link
                        to={step.action.to}
                        className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-700 hover:text-primary-800 transition-colors"
                      >
                        {step.action.label} <ArrowRight size={14} />
                      </Link>
                    )}
                    {blocked && (
                      <p className="text-xs text-ink-400 italic">Complete identity verification first</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          <button
            onClick={() => completeOnboarding.mutate()}
            disabled={completeOnboarding.isPending}
            className={cn('btn-primary w-full text-base', !allDone && 'opacity-80')}
          >
            {allDone ? (
              <>Go to my dashboard <ArrowRight size={16} /></>
            ) : (
              <>Continue to dashboard <ArrowRight size={16} /></>
            )}
          </button>

          <p className="mt-4 text-xs text-ink-500 text-center">
            You can complete the remaining steps at any time from your profile page.
          </p>
        </div>
      </div>
    </div>
  )
}
