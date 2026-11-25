import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Clock, X, XCircle, UserPlus } from 'lucide-react'
import toast from 'react-hot-toast'
import apiClient from '@/api/client'
import { useAuthStore } from '@/store/authStore'
import { cn } from '@/utils'

export interface OrgApplicationRow {
  id: number
  organization: number
  organization_name: string
  applicant_name: string
  applicant_email: string
  message: string
  status: 'pending' | 'accepted' | 'declined'
  decision_note: string
  created_at: string
}

const STATUS: Record<OrgApplicationRow['status'], { label: string; cls: string; Icon: typeof Clock }> = {
  pending: { label: 'Waiting for the organization', cls: 'bg-amber-50 text-amber-800 border-amber-200', Icon: Clock },
  accepted: { label: 'Accepted', cls: 'bg-emerald-50 text-emerald-800 border-emerald-200', Icon: CheckCircle2 },
  declined: { label: 'Not accepted', cls: 'bg-red-50 text-red-700 border-red-200', Icon: XCircle },
}

/** Where a visitor returns to after signing in or creating an account: the same organization, with the apply form open. */
export const joinUrl = (orgId: number) => `/organizations?org=${orgId}&join=1`
const NEXT_KEY = 'lydop_next'

function rememberNext(path: string) {
  try { sessionStorage.setItem(NEXT_KEY, JSON.stringify({ path, ts: Date.now() })) } catch { /* private mode: the ?next= in the link still works */ }
}

/** The picked organization survives sign-in AND account creation (which needs email verification in between). Valid for 2 hours. */
export function peekRememberedNext(): string | null {
  try {
    const v = JSON.parse(sessionStorage.getItem(NEXT_KEY) ?? 'null') as { path?: string; ts?: number } | null
    if (!v?.path || !v.ts || Date.now() - v.ts > 2 * 3600 * 1000) return null
    return v.path.startsWith('/') && !v.path.startsWith('//') ? v.path : null
  } catch {
    return null
  }
}

/** Called once the person is back on the organization, so a later sign-in does not jump there again. */
export function clearRememberedNext() {
  try { sessionStorage.removeItem(NEXT_KEY) } catch { /* nothing to clear */ }
}

function Shell({ onClose, title, children }: { onClose: () => void; title: string; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <div className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        <button type="button" onClick={onClose} aria-label="Close" className="absolute right-3 top-3 rounded-full p-1.5 text-ink-500 hover:bg-ink-100"><X size={16} /></button>
        {children}
      </div>
    </div>
  )
}

/** Join / apply. A visitor is asked to sign in first and comes back to the same organization. A signed-in user applies right here. */
export function JoinFlow({ org, onClose }: { org: { id: number; name: string }; onClose: () => void }) {
  const auth = useAuthStore()
  const qc = useQueryClient()
  const [message, setMessage] = useState('')
  const next = joinUrl(org.id)

  const mine = useQuery<OrgApplicationRow[]>({
    queryKey: ['my-org-applications'],
    queryFn: () => apiClient.get('/youth-orgs/my-applications/').then(r => r.data),
    enabled: !!auth.isAuthenticated,
  })
  const existing = mine.data?.find(a => a.organization === org.id)
  const detail = useQuery<{ name: string }>({ queryKey: ['org-detail', org.id], queryFn: () => apiClient.get(`/youth-orgs/${org.id}/`).then(r => r.data) })
  const orgName = detail.data?.name ?? org.name

  const apply = useMutation({
    mutationFn: () => apiClient.post(`/youth-orgs/${org.id}/apply/`, { message }),
    onSuccess: () => { toast.success('Application sent'); qc.invalidateQueries({ queryKey: ['my-org-applications'] }) },
    onError: (e: any) => toast.error(String(e?.response?.data?.detail ?? 'Could not send the application.')),
  })

  if (!auth.isAuthenticated) {
    return (
      <Shell onClose={onClose} title="Sign in to apply">
        <span className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-50 text-primary-700"><UserPlus size={22} /></span>
        <h3 className="font-display text-xl font-extrabold text-ink-900">Join the youth organization community in Lucena City.</h3>
        <p className="mt-2 text-sm leading-relaxed text-ink-600">
          To apply for membership in <strong>{orgName}</strong>, you need to sign in to your LYDOP account, or create an account if you don&apos;t have one yet.
          We will bring you back to this organization afterwards.
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <Link to={`/login?next=${encodeURIComponent(next)}`} onClick={() => rememberNext(next)} className="btn-primary flex-1 text-center">Sign In</Link>
          <Link to={`/register?next=${encodeURIComponent(next)}`} onClick={() => rememberNext(next)} className="btn-secondary flex-1 text-center">Create Account</Link>
        </div>
        <button type="button" onClick={onClose} className="mt-3 w-full text-sm font-semibold text-ink-500 hover:text-ink-800">Cancel</button>
      </Shell>
    )
  }

  const sent = existing ?? (apply.isSuccess ? { status: 'pending' as const, decision_note: '' } : null)
  return (
    <Shell onClose={onClose} title="Apply for membership">
      <h3 className="font-display text-xl font-extrabold text-ink-900">Apply to {orgName}</h3>
      {sent ? (
        <div className="mt-4 space-y-3">
          <p className={cn('inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold', STATUS[sent.status].cls)}>
            {(() => { const I = STATUS[sent.status].Icon; return <I size={13} /> })()} {STATUS[sent.status].label}
          </p>
          <p className="text-sm text-ink-600">
            {sent.status === 'pending' ? 'Your application was sent. The organization will review it and you will get a notification.' : sent.status === 'accepted' ? 'Congratulations! The organization accepted you.' : 'The organization did not accept this application.'}
          </p>
          {sent.decision_note && <p className="rounded-lg bg-ink-50 p-3 text-sm text-ink-700">{sent.decision_note}</p>}
          <button type="button" onClick={onClose} className="btn-primary w-full">Done</button>
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <p className="text-sm text-ink-600">Tell the organization a little about yourself. This is optional. Your account name and email are shared with them.</p>
          <textarea className="input resize-none" rows={4} maxLength={500} value={message} onChange={e => setMessage(e.target.value)} placeholder="Why do you want to join? (optional)" />
          <div className="flex gap-2">
            <button type="button" onClick={() => apply.mutate()} disabled={apply.isPending} className="btn-primary flex-1 disabled:opacity-50">{apply.isPending ? 'Sending...' : 'Send application'}</button>
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}
    </Shell>
  )
}

/** For the person who registered the organization (and LYDO): who applied, and accept or decline with a reason. */
export function OrgApplicationsPanel({ orgId }: { orgId: number }) {
  const qc = useQueryClient()
  const [declining, setDeclining] = useState<number | null>(null)
  const [note, setNote] = useState('')
  const list = useQuery<OrgApplicationRow[]>({
    queryKey: ['org-applications', orgId],
    queryFn: () => apiClient.get(`/youth-orgs/${orgId}/applications/`).then(r => r.data),
  })
  const decide = useMutation({
    mutationFn: (v: { application: number; status: 'accepted' | 'declined'; note?: string }) => apiClient.post(`/youth-orgs/${orgId}/decide-application/`, v),
    onSuccess: () => { toast.success('Saved. The applicant was notified.'); setDeclining(null); setNote(''); qc.invalidateQueries({ queryKey: ['org-applications', orgId] }) },
    onError: (e: any) => toast.error(String(e?.response?.data?.detail ?? 'Could not save.')),
  })
  const rows = list.data ?? []
  return (
    <div className="px-4 pb-6 pt-2">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">Membership applications ({rows.length})</p>
      {rows.length === 0 ? <p className="text-sm text-ink-500">No applications yet.</p> : (
        <ul className="space-y-2">
          {rows.map(a => (
            <li key={a.id} className="rounded-xl border border-ink-100 p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-ink-900">{a.applicant_name} <span className="font-normal text-ink-500">· {a.applicant_email}</span></p>
                <span className={cn('rounded-full border px-2 py-0.5 text-[11px] font-semibold', STATUS[a.status].cls)}>{STATUS[a.status].label}</span>
              </div>
              {a.message && <p className="mt-1 whitespace-pre-wrap break-words text-ink-700">{a.message}</p>}
              {a.status === 'pending' && (declining === a.id ? (
                <div className="mt-2 space-y-2">
                  <textarea className="input resize-none text-sm" rows={2} maxLength={500} placeholder="Reason (the applicant will read it)" value={note} onChange={e => setNote(e.target.value)} />
                  <div className="flex gap-2">
                    <button type="button" disabled={note.trim().length < 5 || decide.isPending} onClick={() => decide.mutate({ application: a.id, status: 'declined', note })} className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40">Not accept</button>
                    <button type="button" onClick={() => setDeclining(null)} className="text-xs font-semibold text-ink-500">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="mt-2 flex gap-2">
                  <button type="button" disabled={decide.isPending} onClick={() => decide.mutate({ application: a.id, status: 'accepted' })} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40">Accept</button>
                  <button type="button" onClick={() => { setDeclining(a.id); setNote('') }} className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700">Not accept</button>
                </div>
              ))}
              {a.decision_note && a.status !== 'pending' && <p className="mt-1 text-xs text-ink-500">Reason: {a.decision_note}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
