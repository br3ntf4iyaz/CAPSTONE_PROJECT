import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Search, X, CheckCircle2, XCircle, RotateCcw, Ban, Eye } from 'lucide-react'
import toast from 'react-hot-toast'
import apiClient from '@/api/client'
import { PageSpinner } from '@/components/ui/Spinner'
import { QueryError } from '@/components/ui/QueryError'
import { cn } from '@/utils'
import { AccountGroupTabs, inGroup, type AccountGroup } from '../components/AccountGroupTabs'
import { APP_STATUS, AppHistory, type AppStatus, type OrgApplicationRow } from '@/portals/youth/components/OrgJoin'

type Tab = 'all' | AppStatus
const TABS: { key: Tab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending verification' },
  { key: 'reviewing', label: 'Under review' },
  { key: 'revision', label: 'Revision required' },
  { key: 'accepted', label: 'Approved' },
  { key: 'declined', label: 'Rejected' },
  { key: 'revoked', label: 'Revoked' },
]

const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })

type Action = { status: AppStatus; label: string; needsNote: boolean; tone: string; confirm: string; Icon: typeof Eye }
const ACTIONS: Action[] = [
  { status: 'reviewing', label: 'Start review', needsNote: false, tone: 'bg-blue-600 text-white', confirm: 'Mark this application as under review?', Icon: Eye },
  { status: 'accepted', label: 'Approve', needsNote: false, tone: 'bg-emerald-600 text-white', confirm: 'Approve this application? The person becomes a member.', Icon: CheckCircle2 },
  { status: 'revision', label: 'Request revision', needsNote: true, tone: 'bg-orange-500 text-white', confirm: 'Send this back to the applicant to fix?', Icon: RotateCcw },
  { status: 'declined', label: 'Reject', needsNote: true, tone: 'bg-red-600 text-white', confirm: 'Reject this application?', Icon: XCircle },
  { status: 'revoked', label: 'Revoke membership', needsNote: true, tone: 'bg-ink-800 text-white', confirm: 'Revoke this membership? The history stays and the person is told.', Icon: Ban },
]
const ALLOWED: Record<AppStatus, AppStatus[]> = {
  pending: ['reviewing', 'accepted', 'revision', 'declined'],
  reviewing: ['accepted', 'revision', 'declined'],
  revision: ['declined'],
  accepted: ['revoked'],
  declined: [],
  revoked: [],
}

function Detail({ app, onClose, onDone }: { app: OrgApplicationRow; onClose: () => void; onDone: () => void }) {
  const [note, setNote] = useState('')
  const [pick, setPick] = useState<Action | null>(null)
  const decide = useMutation({
    mutationFn: (status: AppStatus) => apiClient.post(`/youth-orgs/${app.organization}/decide-application/`, { application: app.id, status, note }).then(r => r.data),
    onSuccess: () => { toast.success('Saved. The applicant was notified.'); onDone(); onClose() },
    onError: (e: any) => toast.error(String(e?.response?.data?.detail ?? 'Could not save.')),
  })
  const st = APP_STATUS[app.status]
  const options = ACTIONS.filter(a => ALLOWED[app.status].includes(a.status))
  const snap = app.snapshot ?? {}
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 px-4 py-6" onClick={onClose}>
      <div className="my-auto w-full max-w-xl space-y-4 rounded-xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-ink-800">Membership application</h2>
            <p className="text-sm text-ink-500">{app.organization_name} · <span className="font-mono">{app.reference_number}</span></p>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-ink-400 hover:text-ink-600"><X size={18} /></button>
        </div>
        <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold', st.cls)}><st.Icon size={13} /> {st.label}</span>

        <div className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-xl border border-ink-100 bg-ink-50/60 p-3 text-sm">
          <p><span className="text-ink-500">Name:</span> {snap.name ?? app.applicant_name}</p>
          <p className="break-all"><span className="text-ink-500">Email:</span> {snap.email ?? app.applicant_email}</p>
          <p><span className="text-ink-500">Age:</span> {snap.age ?? 'not set'}</p>
          <p><span className="text-ink-500">Sex:</span> {snap.sex || 'not set'}</p>
          <p><span className="text-ink-500">Barangay:</span> {snap.barangay || 'not set'}</p>
          <p><span className="text-ink-500">Contact:</span> {snap.phone || 'not set'}</p>
          <p className="col-span-2 text-xs text-ink-500">Sent {fmt(app.created_at)}. Privacy agreement {app.privacy_consent_at ? `accepted ${fmt(app.privacy_consent_at)}` : 'not recorded'}.
            The applicant&apos;s verified ID documents are in Account Verification, not here.</p>
        </div>

        {app.message && <div className="rounded-xl bg-ink-50 p-3 text-sm text-ink-700"><p className="mb-0.5 text-[11px] font-semibold uppercase text-ink-500">Why they want to join</p>{app.message}</div>}
        {app.decision_note && <div className="rounded-xl border border-ink-100 p-3 text-sm text-ink-700"><p className="mb-0.5 text-[11px] font-semibold uppercase text-ink-500">Latest note</p>{app.decision_note}</div>}
        <div><p className="mb-1 text-xs font-semibold uppercase text-ink-500">History</p><AppHistory rows={app.history} /></div>

        {options.length > 0 && (
          <div className="space-y-2 border-t border-ink-100 pt-3">
            {pick ? (
              <>
                <p className="text-sm font-semibold text-ink-800">{pick.confirm}</p>
                {pick.needsNote && (
                  <textarea className="input min-h-[70px]" value={note} onChange={e => setNote(e.target.value)} maxLength={500}
                    placeholder={pick.status === 'revision' ? 'Say exactly what the applicant must fix' : 'Reason (the applicant reads it and it is kept in the history)'} />
                )}
                <div className="flex justify-end gap-2">
                  <button onClick={() => setPick(null)} className="btn-secondary btn-sm">Back</button>
                  <button onClick={() => decide.mutate(pick.status)} disabled={decide.isPending || (pick.needsNote && note.trim().length < 5)} className={cn('btn-sm rounded-lg px-3 py-1.5 text-sm font-semibold disabled:opacity-50', pick.tone)}>
                    {decide.isPending ? 'Saving…' : `Yes, ${pick.label.toLowerCase()}`}
                  </button>
                </div>
              </>
            ) : (
              <div className="flex flex-wrap justify-end gap-2">
                {options.map(a => (
                  <button key={a.status} onClick={() => { setPick(a); setNote('') }} className={cn('inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold', a.tone)}>
                    <a.Icon size={14} /> {a.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default function AdminMembershipPage() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<Tab>('pending')
  const [q, setQ] = useState('')
  const [group, setGroup] = useState<AccountGroup>('all')
  const [open, setOpen] = useState<number | null>(null)
  const list = useQuery<OrgApplicationRow[]>({
    queryKey: ['admin-membership-applications'],
    queryFn: () => apiClient.get('/youth-orgs/membership-applications/').then(r => r.data),
    refetchInterval: 20000,
  })
  const everyone = list.data ?? []
  const all = useMemo(() => everyone.filter(a => inGroup(group, a.applicant_type)), [everyone, group])
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: all.length }
    for (const a of all) c[a.status] = (c[a.status] ?? 0) + 1
    return c
  }, [all])
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase()
    return all.filter(a => (tab === 'all' || a.status === tab) &&
      (!s || [a.applicant_name, a.applicant_email, a.organization_name, a.reference_number, a.snapshot?.barangay ?? ''].some(v => v.toLowerCase().includes(s))))
  }, [all, tab, q])
  const current = all.find(a => a.id === open) ?? null

  if (list.isLoading) return <PageSpinner />
  if (list.isError) return <QueryError onRetry={() => list.refetch()} />

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Organization Membership Verification</h1>
        <p className="page-subtitle">Applications to join youth organizations. Only people with a verified account can apply.</p>
      </div>

      <AccountGroupTabs value={group} onChange={setGroup} types={everyone.map(a => a.applicant_type)} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={cn('card p-3 text-left transition-shadow hover:shadow-md', tab === t.key && 'ring-2 ring-primary-500')}>
            <p className="text-2xl font-extrabold text-ink-900">{counts[t.key] ?? 0}</p>
            <p className="text-[11px] font-semibold text-ink-500">{t.label}</p>
          </button>
        ))}
      </div>

      <div className="relative max-w-md">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
        <input className="input w-full pl-9" value={q} onChange={e => setQ(e.target.value)} placeholder="Search name, email, organization, barangay or reference" />
      </div>

      <div className="card overflow-x-auto">
        <table className="table w-full text-sm">
          <thead>
            <tr><th>Reference</th><th>Applicant</th><th>Organization</th><th>Barangay</th><th>Sent</th><th>Status</th><th /></tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={7} className="py-8 text-center text-ink-500">No applications here.</td></tr>}
            {rows.map(a => {
              const st = APP_STATUS[a.status]
              return (
                <tr key={a.id}>
                  <td className="font-mono text-xs">{a.reference_number}</td>
                  <td><p className="font-medium">{a.applicant_name}</p><p className="text-xs text-ink-500">{a.applicant_email}</p></td>
                  <td>{a.organization_name}</td>
                  <td>{a.snapshot?.barangay || '—'}</td>
                  <td className="text-ink-500">{fmt(a.created_at)}</td>
                  <td><span className={cn('rounded-full border px-2 py-0.5 text-[11px] font-semibold', st.cls)}>{st.label}</span></td>
                  <td><button onClick={() => setOpen(a.id)} className="btn-secondary btn-sm">Review</button></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {current && <Detail app={current} onClose={() => setOpen(null)} onDone={() => qc.invalidateQueries({ queryKey: ['admin-membership-applications'] })} />}
    </div>
  )
}
