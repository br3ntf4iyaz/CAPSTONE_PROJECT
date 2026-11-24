import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { X, ShieldCheck, Clock, AlertCircle } from 'lucide-react'
import { authApi } from '@/api/auth'
import { useAuthStore } from '@/store/authStore'

/**
 * Applying for jobs, scholarships and other opportunities needs a verified identity. Browsing, and the courses of the schools,
 * only need an account. The server enforces this too; this screen just tells the person what to do instead of showing a form
 * that would be refused.
 */
export default function VerifyGate({ children, onClose, what = 'apply' }: { children: React.ReactNode; onClose: () => void; what?: string }) {
  const { user } = useAuthStore()
  const staff = !!user && user.role !== 'youth'
  const { data, isLoading } = useQuery({
    queryKey: ['id-verify-gate'],
    queryFn: () => authApi.me().then(r => r.data as { id_verified?: boolean; id_verification_status?: string }),
    enabled: !staff,
    staleTime: 0,
  })

  if (staff || data?.id_verified) return <>{children}</>

  const status = data?.id_verification_status ?? 'none'
  const waiting = status === 'pending' || status === 'reviewing'
  const rejected = status === 'rejected'
  const Icon = waiting ? Clock : rejected ? AlertCircle : ShieldCheck

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 text-center shadow-2xl" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} aria-label="Close" className="absolute right-3 top-3 rounded-lg p-1.5 text-ink-400 hover:bg-ink-50"><X size={18} /></button>
        {isLoading ? (
          <p className="py-8 text-sm text-ink-500">Checking your account…</p>
        ) : (
          <>
            <span className={`mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full ${waiting ? 'bg-amber-100 text-amber-600' : rejected ? 'bg-red-100 text-red-600' : 'bg-primary-100 text-primary-700'}`}>
              <Icon size={28} />
            </span>
            <h2 className="mt-4 text-lg font-bold text-ink-900">
              {waiting ? 'Your identity is being reviewed' : rejected ? 'Your identity was not approved' : 'Verify your identity first'}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-600">
              {waiting
                ? `LYDO is checking your ID. You can ${what} as soon as it is approved. You can still browse everything, including the courses of the schools.`
                : rejected
                  ? `Please verify again with a clear photo of a valid ID so that you can ${what}.`
                  : `To make sure applications come from real people, you need to verify your identity before you ${what}. It only takes a few minutes. Until then you can still browse everything, including the courses of the schools.`}
            </p>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
              {!waiting && <Link to="/verify-identity" onClick={onClose} className="btn-primary">{rejected ? 'Verify again' : 'Verify my identity'}</Link>}
              {waiting && <Link to="/verify-identity" onClick={onClose} className="btn-primary">See my verification</Link>}
              <button onClick={onClose} className="btn-secondary">Not now</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
