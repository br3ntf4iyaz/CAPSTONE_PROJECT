import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ShieldCheck, Clock } from 'lucide-react'
import { authApi } from '@/api/auth'
import { useAuthStore } from '@/store/authStore'

/** A short reminder, above the opportunities, that applying needs a verified identity. Hidden once the person is verified. */
export default function VerifyBanner() {
  const { user } = useAuthStore()
  const youth = user?.role === 'youth'
  const { data } = useQuery({
    queryKey: ['id-verify-gate'],
    queryFn: () => authApi.me().then(r => r.data as { id_verified?: boolean; id_verification_status?: string }),
    enabled: youth,
    staleTime: 60_000,
  })
  if (!youth || !data || data.id_verified) return null
  const waiting = data.id_verification_status === 'pending' || data.id_verification_status === 'reviewing'
  const Icon = waiting ? Clock : ShieldCheck
  return (
    <div className={`flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center ${waiting ? 'border-amber-200 bg-amber-50' : 'border-primary-200 bg-primary-50'}`}>
      <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${waiting ? 'bg-amber-100 text-amber-700' : 'bg-primary-100 text-primary-700'}`}><Icon size={20} /></span>
      <p className="flex-1 text-sm leading-relaxed text-ink-700">
        {waiting
          ? <><strong>Your ID is being reviewed.</strong> You can apply for jobs and scholarships as soon as it is approved. You can already browse everything, including the courses of the schools.</>
          : <><strong>Verify your identity to apply.</strong> You can browse everything and see the courses of the schools now, but jobs and scholarships need a verified identity before you can apply.</>}
      </p>
      <Link to="/verify-identity" className="btn-primary whitespace-nowrap">{waiting ? 'See my verification' : 'Verify my identity'}</Link>
    </div>
  )
}
