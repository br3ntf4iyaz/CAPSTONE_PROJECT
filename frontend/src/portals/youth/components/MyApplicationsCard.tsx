import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ShieldCheck, ShieldAlert, Clock, ShieldX, ChevronRight } from 'lucide-react'
import apiClient from '@/api/client'
import { cn } from '@/utils'
import { APP_STATUS, JoinFlow, type OrgApplicationRow } from './OrgJoin'

const VERIFY: Record<string, { label: string; text: string; cls: string; Icon: typeof Clock }> = {
  none: { label: 'Not verified', text: 'Verify once to apply for programs, jobs, scholarships and youth organizations.', cls: 'bg-amber-50 text-amber-800 border-amber-200', Icon: ShieldAlert },
  pending: { label: 'Pending verification', text: 'Your documents are waiting for review.', cls: 'bg-amber-50 text-amber-800 border-amber-200', Icon: Clock },
  reviewing: { label: 'Under review', text: 'The LYDO team is checking your documents.', cls: 'bg-blue-50 text-blue-800 border-blue-200', Icon: Clock },
  revision: { label: 'Revision required', text: 'LYDO asked for a correction. Open it to see what to fix.', cls: 'bg-orange-50 text-orange-800 border-orange-200', Icon: ShieldAlert },
  approved: { label: 'Verified', text: 'You can apply for everything that needs a verified account.', cls: 'bg-emerald-50 text-emerald-800 border-emerald-200', Icon: ShieldCheck },
  rejected: { label: 'Rejected', text: 'Your verification was not approved. You may submit again.', cls: 'bg-red-50 text-red-700 border-red-200', Icon: ShieldX },
  suspended: { label: 'Suspended', text: 'You cannot apply for anything right now. Please contact LYDO.', cls: 'bg-ink-100 text-ink-700 border-ink-300', Icon: ShieldX },
}

/** My Space: where my account verification and my youth organization applications stand. */
export function MyApplicationsCard({ verification }: { verification?: { status?: string; reference_number?: string } }) {
  const [open, setOpen] = useState<{ id: number; name: string } | null>(null)
  const apps = useQuery<OrgApplicationRow[]>({
    queryKey: ['my-org-applications'],
    queryFn: () => apiClient.get('/youth-orgs/my-applications/').then(r => r.data),
  })
  const v = VERIFY[verification?.status ?? 'none'] ?? VERIFY.none
  const rows = apps.data ?? []
  return (
    <div className="card p-5 space-y-4">
      <h2 className="font-display text-base font-bold text-ink-900">My verification and applications</h2>
      <Link to="/verify-identity" className="flex items-center gap-3 rounded-xl border border-ink-100 p-3 hover:bg-ink-50">
        <span className={cn('inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border', v.cls)}><v.Icon size={18} /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-ink-900">Account verification · <span className="font-bold">{v.label}</span></span>
          <span className="block text-xs text-ink-500">{v.text}{verification?.reference_number ? ` Ref. ${verification.reference_number}` : ''}</span>
        </span>
        <ChevronRight size={16} className="text-ink-400" />
      </Link>
      {rows.length > 0 && (
        <ul className="space-y-2">
          {rows.map(a => {
            const st = APP_STATUS[a.status]
            return (
              <li key={a.id}>
                <button type="button" onClick={() => setOpen({ id: a.organization, name: a.organization_name })} className="flex w-full items-center gap-3 rounded-xl border border-ink-100 p-3 text-left hover:bg-ink-50">
                  <span className={cn('inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border', st.cls)}><st.Icon size={18} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink-900">{a.organization_name}</span>
                    <span className="block text-xs text-ink-500">{st.label} · {a.reference_number}</span>
                  </span>
                  <ChevronRight size={16} className="text-ink-400" />
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {open && <JoinFlow org={open} onClose={() => setOpen(null)} />}
    </div>
  )
}
