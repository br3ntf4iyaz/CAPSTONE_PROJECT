import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Clock, X, XCircle, UserPlus, ShieldCheck, ShieldAlert, RotateCcw, Ban } from 'lucide-react'
import toast from 'react-hot-toast'
import apiClient from '@/api/client'
import { useAuthStore } from '@/store/authStore'
import { cn } from '@/utils'

export type AppStatus = 'pending' | 'reviewing' | 'revision' | 'accepted' | 'declined' | 'revoked'

export interface OrgApplicationRow {
  id: number
  reference_number: string
  organization: number
  organization_name: string
  applicant_name: string
  applicant_email: string
  applicant_type?: string
  message: string
  status: AppStatus
  status_display: string
  decision_note: string
  snapshot: { name?: string; email?: string; age?: number | null; sex?: string; barangay?: string; phone?: string }
  privacy_consent_at: string | null
  history: { id: number; action: string; note: string; created_at: string }[]
  created_at: string
  updated_at: string
}

export const APP_STATUS: Record<AppStatus, { label: string; cls: string; Icon: typeof Clock }> = {
  pending: { label: 'Pending verification', cls: 'bg-amber-50 text-amber-800 border-amber-200', Icon: Clock },
  reviewing: { label: 'Under review', cls: 'bg-blue-50 text-blue-800 border-blue-200', Icon: Clock },
  revision: { label: 'Revision required', cls: 'bg-orange-50 text-orange-800 border-orange-200', Icon: RotateCcw },
  accepted: { label: 'Approved', cls: 'bg-emerald-50 text-emerald-800 border-emerald-200', Icon: CheckCircle2 },
  declined: { label: 'Rejected', cls: 'bg-red-50 text-red-700 border-red-200', Icon: XCircle },
  revoked: { label: 'Revoked', cls: 'bg-ink-100 text-ink-700 border-ink-300', Icon: Ban },
}
const STATUS = APP_STATUS

const EVENT_LABEL: Record<string, string> = {
  submitted: 'Application sent', resubmitted: 'Corrected and sent again', review_started: 'Review started',
  revision_requested: 'Revision requested', approved: 'Approved', rejected: 'Rejected', revoked: 'Membership revoked',
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
    <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-black/50 p-4" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <div className="relative my-auto w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        <button type="button" onClick={onClose} aria-label="Close" className="absolute right-3 top-3 rounded-full p-1.5 text-ink-500 hover:bg-ink-100"><X size={16} /></button>
        {children}
      </div>
    </div>
  )
}

/** The steps of an application, oldest first. */
export function AppHistory({ rows }: { rows: OrgApplicationRow['history'] }) {
  if (!rows?.length) return null
  return (
    <ol className="space-y-1 rounded-xl border border-ink-100 bg-white p-3">
      {rows.map(e => (
        <li key={e.id} className="text-xs text-ink-700">
          <span className="font-semibold">{EVENT_LABEL[e.action] ?? e.action}</span>
          <span className="text-ink-400"> · {new Date(e.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
          {e.note && <span className="block text-ink-500">{e.note}</span>}
        </li>
      ))}
    </ol>
  )
}

interface VerificationState { status: string; is_verified?: boolean }

const VERIFY_GATE: Record<string, { title: string; text: string; cta?: string }> = {
  none: { title: 'Verify your account first', text: 'Only verified accounts can join a youth organization. Verifying takes a few minutes and is done once for everything you apply for.', cta: 'Verify my account' },
  pending: { title: 'Your verification is waiting for review', text: 'You can apply as soon as LYDO verifies your account. We will notify you.' },
  reviewing: { title: 'Your verification is being reviewed', text: 'You can apply as soon as LYDO verifies your account. We will notify you.' },
  revision: { title: 'Your verification needs a correction', text: 'LYDO asked you to fix something in your documents. Correct it first, then you can apply.', cta: 'See what to fix' },
  rejected: { title: 'Your verification was not approved', text: 'Please verify again with clear documents to be able to apply.', cta: 'Verify again' },
  suspended: { title: 'Your account is suspended', text: 'You cannot apply for anything right now. Please contact the LYDO office.' },
}

/** Join / apply. A visitor is asked to sign in first. A signed-in person must be verified, then fills the membership application. */
export function JoinFlow({ org, onClose }: { org: { id: number; name: string }; onClose: () => void }) {
  const auth = useAuthStore()
  const qc = useQueryClient()
  const [message, setMessage] = useState('')
  const [consent, setConsent] = useState(false)
  const [editing, setEditing] = useState(false)
  const next = joinUrl(org.id)

  const mine = useQuery<OrgApplicationRow[]>({
    queryKey: ['my-org-applications'],
    queryFn: () => apiClient.get('/youth-orgs/my-applications/').then(r => r.data),
    enabled: !!auth.isAuthenticated,
  })
  const ver = useQuery<VerificationState>({
    queryKey: ['verification-status'],
    queryFn: () => apiClient.get('/verification/').then(r => r.data),
    enabled: !!auth.isAuthenticated,
  })
  const me = useQuery<any>({ queryKey: ['me'], queryFn: () => apiClient.get('/auth/me/').then(r => r.data), enabled: !!auth.isAuthenticated })
  const existing = mine.data?.find(a => a.organization === org.id)
  const detail = useQuery<{ name: string; membership_requirements?: string; how_to_join?: string }>({ queryKey: ['org-detail', org.id], queryFn: () => apiClient.get(`/youth-orgs/${org.id}/`).then(r => r.data) })
  const orgName = detail.data?.name ?? org.name

  const apply = useMutation({
    mutationFn: () => apiClient.post(`/youth-orgs/${org.id}/apply/`, { message, consent: 'true' }).then(r => r.data),
    onSuccess: () => { toast.success('Application sent'); setEditing(false); qc.invalidateQueries({ queryKey: ['my-org-applications'] }) },
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

  // an existing application is shown as it is, unless the person was asked to fix it (or was rejected) and chose to send it again
  if (existing && !editing) {
    const st = STATUS[existing.status]
    return (
      <Shell onClose={onClose} title="Your application">
        <h3 className="font-display text-xl font-extrabold text-ink-900">Your application to {orgName}</h3>
        <div className="mt-3 space-y-3">
          <p className={cn('inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold', st.cls)}>
            <st.Icon size={13} /> {st.label}
          </p>
          <p className="text-xs text-ink-500">Reference number: <strong className="font-mono text-ink-800">{existing.reference_number}</strong></p>
          <p className="text-sm text-ink-600">
            {existing.status === 'pending' ? 'Your application was sent. You will get a notification when it is reviewed.'
              : existing.status === 'reviewing' ? 'Your application is being reviewed.'
              : existing.status === 'revision' ? 'A correction is needed. Read the note below, fix it, and send the application again.'
              : existing.status === 'accepted' ? 'Congratulations! You are a member of this organization.'
              : existing.status === 'revoked' ? 'Your membership was revoked. Please contact LYDO if you think this is a mistake.'
              : 'This application was not approved. You may apply again.'}
          </p>
          {existing.decision_note && <p className="rounded-lg bg-ink-50 p-3 text-sm text-ink-700">{existing.decision_note}</p>}
          <AppHistory rows={existing.history} />
          {(existing.status === 'revision' || existing.status === 'declined') && (
            <button type="button" onClick={() => { setMessage(existing.message); setEditing(true) }} className="btn-primary w-full">
              {existing.status === 'revision' ? 'Fix and send again' : 'Apply again'}
            </button>
          )}
          <button type="button" onClick={onClose} className={existing.status === 'revision' || existing.status === 'declined' ? 'btn-secondary w-full' : 'btn-primary w-full'}>Close</button>
        </div>
      </Shell>
    )
  }

  // only verified accounts apply (staff accounts are not asked to verify, and are not youth applicants anyway)
  const vs = ver.data?.status ?? 'none'
  if (!ver.isLoading && !ver.data?.is_verified && vs !== 'approved') {
    const gate = VERIFY_GATE[vs] ?? VERIFY_GATE.none
    return (
      <Shell onClose={onClose} title="Verify your account">
        <span className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-700"><ShieldAlert size={22} /></span>
        <h3 className="font-display text-xl font-extrabold text-ink-900">{gate.title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-ink-600">{gate.text}</p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          {gate.cta && <Link to="/verify-identity" onClick={onClose} className="btn-primary flex-1 text-center">{gate.cta}</Link>}
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Close</button>
        </div>
      </Shell>
    )
  }

  const prof = me.data?.profile ?? {}
  const rows: [string, string][] = [
    ['Name', me.data?.full_name ?? ''], ['Email', me.data?.email ?? ''],
    ['Barangay', prof.barangay ?? ''], ['Contact number', prof.phone ?? ''],
  ]
  return (
    <Shell onClose={onClose} title="Apply for membership">
      <h3 className="font-display text-xl font-extrabold text-ink-900">Membership application</h3>
      <p className="text-sm text-ink-500">{orgName}</p>
      <div className="mt-3 space-y-3">
        <p className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800"><ShieldCheck size={13} /> Your account is verified</p>
        <div className="rounded-xl border border-ink-100 bg-ink-50/60 p-3">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-500">Taken from your account</p>
          <dl className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-0.5 text-sm">
            {rows.map(([k, v]) => (<div key={k} className="contents"><dt className="text-ink-500">{k}</dt><dd className="break-words font-medium text-ink-800">{v || 'not set'}</dd></div>))}
          </dl>
          <p className="mt-1.5 text-[11px] text-ink-500">Change these in My Space. You do not upload your ID again: your verified account is used.</p>
        </div>
        {detail.data?.membership_requirements && (
          <div className="rounded-xl border border-primary-100 bg-primary-50/50 p-3 text-sm text-ink-700">
            <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-wide text-primary-700">This organization asks for</p>
            <p className="whitespace-pre-line">{detail.data.membership_requirements}</p>
          </div>
        )}
        <textarea className="input resize-none" rows={3} maxLength={500} value={message} onChange={e => setMessage(e.target.value)} placeholder="Why do you want to join? (optional)" />
        <label className="flex items-start gap-2.5 rounded-xl border border-ink-100 p-3 text-xs text-ink-700">
          <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0" />
          <span>I agree that LYDO and this organization may use the details above to process my membership, as described in the{' '}
            <a href="/privacy" target="_blank" rel="noopener noreferrer" className="font-semibold text-primary-700 underline">Privacy Policy</a>.
            My ID documents are never shown to the organization.</span>
        </label>
        <div className="flex gap-2">
          <button type="button" onClick={() => apply.mutate()} disabled={apply.isPending || !consent} className="btn-primary flex-1 disabled:opacity-50">{apply.isPending ? 'Sending...' : existing ? 'Send again' : 'Submit application'}</button>
          <button type="button" onClick={() => (existing ? setEditing(false) : onClose())} className="btn-secondary">Cancel</button>
        </div>
      </div>
    </Shell>
  )
}

/** For the person who registered the organization (and LYDO): who applied, and the decision with a reason. */
export function OrgApplicationsPanel({ orgId }: { orgId: number }) {
  const qc = useQueryClient()
  const [acting, setActing] = useState<{ id: number; status: 'declined' | 'revision' } | null>(null)
  const [note, setNote] = useState('')
  const list = useQuery<OrgApplicationRow[]>({
    queryKey: ['org-applications', orgId],
    queryFn: () => apiClient.get(`/youth-orgs/${orgId}/applications/`).then(r => r.data),
  })
  const decide = useMutation({
    mutationFn: (v: { application: number; status: AppStatus; note?: string }) => apiClient.post(`/youth-orgs/${orgId}/decide-application/`, v),
    onSuccess: () => { toast.success('Saved. The applicant was notified.'); setActing(null); setNote(''); qc.invalidateQueries({ queryKey: ['org-applications', orgId] }) },
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
              <p className="text-[11px] text-ink-400">{a.reference_number}{a.snapshot?.barangay ? ` · ${a.snapshot.barangay}` : ''}{a.snapshot?.age != null ? ` · ${a.snapshot.age} yrs` : ''}</p>
              {a.message && <p className="mt-1 whitespace-pre-wrap break-words text-ink-700">{a.message}</p>}
              {(a.status === 'pending' || a.status === 'reviewing') && (acting?.id === a.id ? (
                <div className="mt-2 space-y-2">
                  <textarea className="input resize-none text-sm" rows={2} maxLength={500} placeholder={acting.status === 'revision' ? 'What must the applicant fix?' : 'Reason (the applicant will read it)'} value={note} onChange={e => setNote(e.target.value)} />
                  <div className="flex gap-2">
                    <button type="button" disabled={note.trim().length < 5 || decide.isPending} onClick={() => decide.mutate({ application: a.id, status: acting.status, note })} className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40">{acting.status === 'revision' ? 'Ask for a fix' : 'Reject'}</button>
                    <button type="button" onClick={() => setActing(null)} className="text-xs font-semibold text-ink-500">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" disabled={decide.isPending} onClick={() => decide.mutate({ application: a.id, status: 'accepted' })} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40">Approve</button>
                  <button type="button" onClick={() => { setActing({ id: a.id, status: 'revision' }); setNote('') }} className="rounded-lg border border-orange-300 px-3 py-1.5 text-xs font-semibold text-orange-700">Ask for a fix</button>
                  <button type="button" onClick={() => { setActing({ id: a.id, status: 'declined' }); setNote('') }} className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700">Reject</button>
                </div>
              ))}
              {a.decision_note && !['pending', 'reviewing'].includes(a.status) && <p className="mt-1 text-xs text-ink-500">Note: {a.decision_note}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
