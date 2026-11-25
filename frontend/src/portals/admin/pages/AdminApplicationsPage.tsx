import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ClipboardCheck, Save, Download, Eye, CheckCircle2, XCircle, PlayCircle, ShieldCheck, RefreshCw, Undo2 } from 'lucide-react'
import toast from 'react-hot-toast'
import apiClient from '@/api/client'
import { openPrivateFile, SecureImage } from '@/components/ui/SecureImage'
import { cn, formatDateTime } from '@/utils'

interface Application {
  id: number
  kind: 'job' | 'scholarship'
  title: string
  full_name: string
  email: string
  contact_number: string
  address: string
  birthdate: string | null
  id_type: string
  id_number: string
  message: string
  confirmed_requirements: string[]
  document_url: string | null
  id_document_url: string | null
  id_document_back_url: string | null
  selfie_url: string | null
  face_check: { distance?: number; similarity?: number; matched?: boolean } | null
  resubmit_count: number
  previous_note: string
  status: 'submitted' | 'under_review' | 'approved' | 'rejected' | 'revoked'
  submitted_at: string
  admin_note: string
  ai_status: 'pending' | 'processing' | 'done' | 'failed' | 'unavailable'
  ai_results: {
    documents?: Record<string, { status: string; finding: string; detected_type?: string; extracted?: { name: string | null; id_number: string | null }; sections_found?: string[] }>
    requirements?: { requirement: string; status: string; finding: string }[]
    overall?: string
  } | null
  file_names: Record<string, string>
  opened_docs: Record<string, string>
  manual_checks: Record<string, boolean>
  ai_override_note: string
  approval_blockers: string[]
  approved_at: string | null
  approved_by_name: string | null
  revoked_at: string | null
  revoked_by_name: string | null
  revocation_reason: string
}

const STATUSES = [
  { value: 'submitted', label: 'Submitted', cls: 'bg-gray-100 text-gray-700' },
  { value: 'under_review', label: 'Under review', cls: 'bg-amber-100 text-amber-800' },
  { value: 'approved', label: 'Approved', cls: 'bg-emerald-100 text-emerald-800' },
  { value: 'rejected', label: 'Not accepted', cls: 'bg-red-100 text-red-700' },
  { value: 'revoked', label: 'Approval revoked', cls: 'bg-orange-100 text-orange-800' },
]

type DocKey = 'id_front' | 'id_back' | 'selfie' | 'resume'
type AiDoc = { status: string; finding: string; detected_type?: string; extracted?: { name: string | null; id_number: string | null }; sections_found?: string[] }

const DOCS: { key: DocKey; label: string; url: (a: Application) => string | null; check: 'id' | 'selfie' | 'resume' }[] = [
  { key: 'id_front', label: 'ID front', url: a => a.id_document_url, check: 'id' },
  { key: 'id_back', label: 'ID back', url: a => a.id_document_back_url, check: 'id' },
  { key: 'selfie', label: 'Selfie', url: a => a.selfie_url, check: 'selfie' },
  { key: 'resume', label: 'Resume', url: a => a.document_url, check: 'resume' },
]

const AI_BADGE: Record<string, { label: string; cls: string }> = {
  ai_verified: { label: 'AI Verified', cls: 'bg-emerald-100 text-emerald-800' },
  needs_review: { label: 'Needs Manual Review', cls: 'bg-amber-100 text-amber-800' },
  invalid: { label: 'Invalid Requirement', cls: 'bg-red-100 text-red-700' },
  missing: { label: 'Missing Requirement', cls: 'bg-red-100 text-red-700' },
  processing: { label: 'Processing', cls: 'bg-sky-100 text-sky-800' },
  failed: { label: 'Verification Failed', cls: 'bg-gray-200 text-gray-700' },
  unavailable: { label: 'AI Verification Unavailable', cls: 'bg-gray-200 text-gray-700' },
}

const CHECK_TEXT: Record<string, string> = {
  id: "I personally reviewed the applicant's ID front and back.",
  selfie: 'I personally reviewed the submitted selfie.',
  resume: 'I reviewed the resume and confirmed that it contains appropriate resume information.',
  ai_findings: 'I reviewed the AI verification findings.',
}

function isImageName(name?: string) {
  return !!name && /\.(png|jpe?g|webp|gif)$/i.test(name)
}

function aiOf(a: Application, key: DocKey): { status: string; finding: string; doc?: AiDoc } {
  const doc = a.ai_results?.documents?.[key]
  if (doc) return { status: doc.status, finding: doc.finding, doc }
  if (a.ai_status === 'pending' || a.ai_status === 'processing') return { status: 'processing', finding: 'The AI is still checking this file.' }
  return { status: 'unavailable', finding: 'No AI result for this file. Check it yourself.' }
}

function Card({ a }: { a: Application }) {
  const qc = useQueryClient()
  const [note, setNote] = useState(a.status === 'rejected' || a.status === 'revoked' ? a.admin_note : '')
  const [open, setOpen] = useState(a.status === 'submitted' || a.status === 'under_review')
  const [preview, setPreview] = useState<Record<string, boolean>>({})
  const [refusing, setRefusing] = useState(false)
  const [items, setItems] = useState<string[]>([])
  const [override, setOverride] = useState(a.ai_override_note ?? '')
  const [revoking, setRevoking] = useState(false)
  const [reason, setReason] = useState('')
  const [sure, setSure] = useState(false)
  const st = STATUSES.find(s => s.value === a.status)!
  const isJob = a.kind === 'job'
  const face = a.face_check ?? {}
  const opened = a.opened_docs ?? {}
  const checks = a.manual_checks ?? {}
  const refresh = () => qc.invalidateQueries({ queryKey: ['admin-applications'] })
  const fail = (err: any) => {
    const d = err?.response?.data
    toast.error(String(d?.blockers?.[0] ?? d?.detail ?? 'Could not update the application'))
  }

  const send = useMutation({
    mutationFn: (body: Record<string, unknown>) => apiClient.patch(`/applications/${a.id}/`, body),
    onSuccess: () => { toast.success('Saved. The applicant was notified.'); setRefusing(false); refresh() },
    onError: fail,
  })
  const tick = useMutation({
    mutationFn: (body: Record<string, boolean>) => apiClient.post(`/applications/${a.id}/manual-checks/`, { checks: body }),
    onSuccess: refresh,
    onError: fail,
  })
  const rescreen = useMutation({
    mutationFn: () => apiClient.post(`/applications/${a.id}/rescreen/`),
    onSuccess: () => { toast.success('AI screening started.'); refresh() },
    onError: fail,
  })
  const revoke = useMutation({
    mutationFn: () => apiClient.post(`/applications/${a.id}/revoke/`, { confirm: true, reason }),
    onSuccess: () => { toast.success('Approval revoked. The applicant was notified.'); setRevoking(false); refresh() },
    onError: fail,
  })

  // Opening a file only records that it was opened. It never marks the file as verified.
  const openDoc = (url: string | null) => {
    if (!url) return
    openPrivateFile(url).then(refresh).catch(() => toast.error('Could not open the file'))
  }

  const docs = a.ai_results?.documents ?? {}
  const flagged = DOCS.filter(d => ['invalid', 'missing'].includes(docs[d.key]?.status))
  const serverBlockers = (a.approval_blockers ?? []).filter(b => !b.startsWith('The AI flagged'))
  const needOverride = flagged.length > 0
  const canApprove = a.status === 'under_review' && serverBlockers.length === 0 && (!needOverride || override.trim().length >= 10)
  const aiBusy = a.ai_status === 'pending' || a.ai_status === 'processing'
  const overallAi = aiBusy ? { label: 'AI Screening', cls: 'bg-sky-100 text-sky-800' }
    : a.ai_status === 'done'
      ? (flagged.length ? AI_BADGE.invalid : DOCS.some(d => ['needs_review', 'failed', 'unavailable'].includes(docs[d.key]?.status)) ? AI_BADGE.needs_review : AI_BADGE.ai_verified)
      : AI_BADGE[a.ai_status] ?? AI_BADGE.unavailable
  const open_ = a.status === 'submitted' || a.status === 'under_review'

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-gray-900 break-words">{a.full_name} <span className="font-normal text-gray-500">applied to</span> {a.title}</p>
          <p className="text-xs text-gray-500">
            {isJob ? 'Job' : 'Scholarship'} · {a.email} · {a.contact_number} · {formatDateTime(a.submitted_at)}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', st.cls)}>{st.label}</span>
          {isJob && a.id_document_url && open_ && <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-full', overallAi.cls)}>{overallAi.label}</span>}
          {a.resubmit_count > 0 && <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">Sent again ×{a.resubmit_count}</span>}
        </div>
      </div>

      {a.resubmit_count > 0 && a.previous_note && (
        <p className="rounded-lg bg-violet-50 px-3 py-2 text-xs text-violet-900"><b>Sent again after it was not accepted.</b> Earlier reason: {a.previous_note}</p>
      )}

      <button type="button" onClick={() => setOpen(o => !o)} className="text-xs font-semibold text-primary-700 hover:text-primary-800">
        {open ? 'Hide details' : 'View details'}
      </button>
      {open && (
        <div className="space-y-4 rounded-xl bg-gray-50 p-3">
          {/* A. Applicant information */}
          <section>
            <h3 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-gray-500">A · Applicant information</h3>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div><dt className="text-xs text-gray-500">Full name</dt><dd className="break-words">{a.full_name}</dd></div>
              <div><dt className="text-xs text-gray-500">Birthdate</dt><dd>{a.birthdate || '—'}</dd></div>
              <div><dt className="text-xs text-gray-500">Contact</dt><dd className="break-words">{a.contact_number} · {a.email}</dd></div>
              <div><dt className="text-xs text-gray-500">Address</dt><dd className="break-words">{a.address || '—'}</dd></div>
              <div><dt className="text-xs text-gray-500">Valid ID given</dt><dd className="break-words">{a.id_type || '—'} · {a.id_number || '—'}</dd></div>
              <div><dt className="text-xs text-gray-500">Applied position</dt><dd className="break-words">{a.title}</dd></div>
              <div><dt className="text-xs text-gray-500">Date submitted</dt><dd>{formatDateTime(a.submitted_at)}</dd></div>
              {a.confirmed_requirements.length > 0 && (
                <div className="sm:col-span-2">
                  <dt className="text-xs text-gray-500">Requirements confirmed by the applicant</dt>
                  <dd><ul className="list-disc pl-5">{a.confirmed_requirements.map(r => <li key={r} className="break-words">{r}</li>)}</ul></dd>
                </div>
              )}
              {a.message && (
                <div className="sm:col-span-2"><dt className="text-xs text-gray-500">Message from the applicant</dt><dd className="whitespace-pre-wrap break-words">{a.message}</dd></div>
              )}
            </dl>
          </section>

          {/* B. Submitted requirements */}
          <section>
            <h3 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-gray-500">B · Submitted requirements</h3>
            {a.selfie_url && (
              <p className={cn('mb-2 rounded-lg px-3 py-2 text-xs', face.matched === true ? 'bg-emerald-50 text-emerald-800' : face.matched === false ? 'bg-red-50 text-red-800' : 'bg-amber-50 text-amber-800')}>
                <b>Face check on the applicant device:</b>{' '}
                {face.matched === true ? 'the faces looked alike.' : face.matched === false ? 'the faces did not match.' : 'it could not run.'}{' '}
                This is only a guide and proves nothing. Compare the ID and the selfie yourself.
              </p>
            )}
            <div className="grid gap-2 md:grid-cols-2">
              {DOCS.map(d => {
                const url = d.url(a)
                const ai = aiOf(a, d.key)
                const badge = !url ? AI_BADGE.missing : AI_BADGE[ai.status] ?? AI_BADGE.unavailable
                const name = a.file_names?.[d.key]
                const seen = !!opened[d.key]
                return (
                  <div key={d.key} className="space-y-1.5 rounded-xl border border-gray-200 bg-white p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-gray-900">{d.label}</p>
                      <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', badge.cls)}>{badge.label}</span>
                    </div>
                    <p className="text-xs text-gray-500 break-all">
                      {url ? <>Uploaded{name ? <> · {name}</> : null}</> : 'Not uploaded (older application)'}
                    </p>
                    <p className="text-xs text-gray-700"><b>AI finding:</b> {url ? ai.finding : 'The applicant did not submit this requirement.'}</p>
                    {d.key === 'id_front' && ai.doc?.extracted && (ai.doc.extracted.name || ai.doc.extracted.id_number) && (
                      <p className="text-xs text-gray-600">Read from the ID: {ai.doc.extracted.name ?? '—'} · {ai.doc.extracted.id_number ?? '—'}</p>
                    )}
                    {d.key === 'resume' && (ai.doc?.sections_found?.length ?? 0) > 0 && (
                      <p className="text-xs text-gray-600">Sections seen: {ai.doc!.sections_found!.join(', ')}</p>
                    )}
                    {url && preview[d.key] && isImageName(name ?? (d.key === 'resume' ? '' : '.jpg')) && (
                      <SecureImage src={url} alt={d.label} className="max-h-56 w-full rounded-lg border border-gray-100 object-contain bg-gray-50" />
                    )}
                    <div className="flex flex-wrap items-center gap-2 pt-0.5">
                      <button type="button" disabled={!url} onClick={() => openDoc(url)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-semibold text-gray-800 hover:border-primary-300 disabled:opacity-50">
                        <Eye size={13} /> Open / view
                      </button>
                      {url && isImageName(name ?? (d.key === 'resume' ? '' : '.jpg')) && (
                        <button type="button" onClick={() => { setPreview(p => ({ ...p, [d.key]: !p[d.key] })); if (!seen) refresh() }}
                          className="text-xs font-semibold text-primary-700 hover:text-primary-800">{preview[d.key] ? 'Hide preview' : 'Show preview'}</button>
                      )}
                      <span className={cn('text-[11px] font-semibold', seen ? 'text-emerald-700' : 'text-gray-500')}>{seen ? 'Opened by an administrator' : 'Not opened yet'}</span>
                    </div>
                    <p className="text-[11px] text-gray-500">Manual review: {checks[d.check] ? 'confirmed by you' : 'not confirmed yet'} (opening a file does not confirm it)</p>
                  </div>
                )
              })}
            </div>
          </section>

          {/* C. AI summary */}
          {isJob && a.id_document_url && (
            <section>
              <h3 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-gray-500">C · AI application screening</h3>
              <div className="space-y-1.5 rounded-xl border border-gray-200 bg-white p-3 text-sm">
                <p className="text-xs text-gray-500">An assistance only. It never approves or refuses anyone, and it can be wrong.</p>
                <ul className="space-y-1">
                  {DOCS.map(d => {
                    const ai = aiOf(a, d.key)
                    const badge = !d.url(a) ? AI_BADGE.missing : AI_BADGE[ai.status] ?? AI_BADGE.unavailable
                    return <li key={d.key} className="flex flex-wrap items-center justify-between gap-2"><span>{d.label}</span><span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', badge.cls)}>{badge.label}</span></li>
                  })}
                </ul>
                {(a.ai_results?.requirements?.length ?? 0) > 0 && (
                  <div className="border-t border-gray-100 pt-1.5">
                    <p className="text-xs font-semibold text-gray-700">Job requirements</p>
                    <ul className="mt-1 space-y-1 text-xs text-gray-700">
                      {a.ai_results!.requirements!.map((r, i) => (
                        <li key={i}>
                          <b>{r.requirement}:</b>{' '}
                          {r.status === 'evident' ? 'appears consistent' : r.status === 'needs_confirmation' ? 'needs your confirmation' : 'not evident in the documents'}. {r.finding}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <p className="border-t border-gray-100 pt-1.5 text-xs text-gray-800"><b>Overall assessment:</b> {aiBusy ? 'The AI is still working. You can review the documents yourself meanwhile.' : a.ai_results?.overall || 'No AI assessment. Review the requirements yourself.'}</p>
                {open_ && !aiBusy && (a.ai_status === 'failed' || a.ai_status === 'unavailable' || a.ai_status === 'done') && (
                  <button type="button" onClick={() => rescreen.mutate()} disabled={rescreen.isPending}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-700 hover:text-primary-800 disabled:opacity-50">
                    <RefreshCw size={12} /> Run AI screening again
                  </button>
                )}
              </div>
            </section>
          )}
        </div>
      )}

      {a.status === 'submitted' && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
            <p className="flex-1 text-sm text-amber-900">Open and read the requirements, then start the review. You may refuse an application at any time if a requirement is clearly wrong.</p>
            <button type="button" onClick={() => send.mutate({ status: 'under_review' })} disabled={send.isPending} className="btn-primary inline-flex items-center gap-2 disabled:opacity-50">
              <PlayCircle size={15} /> Start review
            </button>
          </div>
        </div>
      )}

      {/* D. Administrator review + E. Final decision */}
      {a.status === 'under_review' && (
        <div className="space-y-3 rounded-xl border border-primary-200 bg-primary-50/50 p-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-primary-900"><ShieldCheck size={16} /> D · Administrator review</p>
          <div className="space-y-1.5 text-sm">
            {(['id', 'selfie', 'resume', 'ai_findings'] as const).map(c => {
              const needs = c === 'id' ? ['id_front', 'id_back'] : c === 'selfie' ? ['selfie'] : c === 'resume' ? ['resume'] : []
              const ready = needs.every(k => opened[k]) && (c !== 'ai_findings' || !aiBusy)
              return (
                <label key={c} className={cn('flex items-start gap-2', !ready && 'opacity-50')}>
                  <input type="checkbox" className="mt-1" disabled={!ready || tick.isPending} checked={!!checks[c]} onChange={e => tick.mutate({ [c]: e.target.checked })} />
                  <span>{CHECK_TEXT[c]} {!ready && <span className="text-xs text-gray-500">({c === 'ai_findings' ? 'wait for the AI to finish' : 'open the file first'})</span>}</span>
                </label>
              )
            })}
          </div>

          {needOverride && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-2.5">
              <p className="text-xs text-red-800">The AI flagged {flagged.map(d => d.label).join(', ')} as invalid or missing. To approve anyway, write why you accept it.</p>
              <textarea className="input mt-1.5 resize-none" rows={2} maxLength={1000} placeholder="Why do you accept it although the AI flagged it?" value={override} onChange={e => setOverride(e.target.value)} />
            </div>
          )}

          {!canApprove && (
            <ul className="list-disc pl-5 text-xs text-gray-600">
              {serverBlockers.map(b => <li key={b}>{b}</li>)}
              {needOverride && override.trim().length < 10 && <li>Explain why you accept the flagged requirement.</li>}
            </ul>
          )}

          <textarea className="input resize-none" rows={2} maxLength={1000} placeholder="Note for the applicant (optional when approving)" value={note} onChange={e => setNote(e.target.value)} />
          <p className="text-sm font-semibold text-primary-900">E · Final decision</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => send.mutate({ status: 'approved', admin_note: note, ai_override_note: override })} disabled={!canApprove || send.isPending}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-40">
              <CheckCircle2 size={15} /> Approve
            </button>
            <button type="button" onClick={() => setRefusing(r => !r)}
              className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700">
              <XCircle size={15} /> Not accepted
            </button>
          </div>
        </div>
      )}

      {open_ && a.status === 'submitted' && (
        <button type="button" onClick={() => setRefusing(r => !r)} className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700">
          <XCircle size={15} /> Not accepted
        </button>
      )}

      {open_ && refusing && (
        <div className="space-y-2 rounded-xl border border-red-200 bg-red-50/60 p-3">
          <p className="text-sm font-semibold text-red-900">Why is it not accepted? The applicant will read this.</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {[...DOCS.map(d => ({ key: d.key as string, label: d.label })), { key: 'other', label: 'Other' }].map(i => (
              <label key={i.key} className="flex items-center gap-1.5">
                <input type="checkbox" checked={items.includes(i.key)} onChange={e => setItems(p => e.target.checked ? [...p, i.key] : p.filter(x => x !== i.key))} />
                {i.label} is invalid or missing
              </label>
            ))}
          </div>
          <textarea className="input resize-none" rows={2} maxLength={900} placeholder="Explain in your own words (required if you chose none above)" value={note} onChange={e => setNote(e.target.value)} />
          <button type="button" disabled={send.isPending || (items.length === 0 && note.trim().length < 5)}
            onClick={() => send.mutate({ status: 'rejected', rejected_items: items, admin_note: note })}
            className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-40">
            <XCircle size={15} /> Send: not accepted
          </button>
        </div>
      )}

      {a.status === 'approved' && (
        <div className="space-y-2">
          <p className="text-xs text-gray-600">Approved{a.approved_by_name ? ` by ${a.approved_by_name}` : ''}{a.approved_at ? ` on ${formatDateTime(a.approved_at)}` : ''}.{a.ai_override_note ? ` Accepted despite an AI flag: ${a.ai_override_note}` : ''}</p>
          {!revoking ? (
            <button type="button" onClick={() => setRevoking(true)} className="inline-flex items-center gap-2 rounded-xl border border-red-300 px-3 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-50">
              <Undo2 size={14} /> Revoke approval
            </button>
          ) : (
            <div className="space-y-2 rounded-xl border border-red-200 bg-red-50/60 p-3">
              <p className="text-sm font-semibold text-red-900">Revoke this approval? The applicant is told and reads your reason. The earlier approval stays in the history.</p>
              <textarea className="input resize-none" rows={2} maxLength={1000} placeholder="Reason for revoking (at least 10 characters)" value={reason} onChange={e => setReason(e.target.value)} />
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={sure} onChange={e => setSure(e.target.checked)} /> Yes, I want to revoke this approval.</label>
              <div className="flex gap-2">
                <button type="button" disabled={!sure || reason.trim().length < 10 || revoke.isPending} onClick={() => revoke.mutate()}
                  className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-40">Revoke approval</button>
                <button type="button" onClick={() => setRevoking(false)} className="btn-secondary">Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}

      {a.status === 'revoked' && (
        <p className="rounded-lg bg-orange-50 px-3 py-2 text-xs text-orange-900"><b>Approval revoked</b>{a.revoked_by_name ? ` by ${a.revoked_by_name}` : ''}{a.revoked_at ? ` on ${formatDateTime(a.revoked_at)}` : ''}. Reason: {a.revocation_reason}</p>
      )}

      {(a.status === 'approved' || a.status === 'rejected') && (
        <div className="space-y-2">
          <textarea className="input resize-none" rows={2} maxLength={1000} placeholder="Note for the applicant (they will see this)" value={note || (a.status === 'approved' ? a.admin_note : '')} onChange={e => setNote(e.target.value)} />
          <button type="button" onClick={() => send.mutate({ admin_note: note })} disabled={!note || note === a.admin_note || send.isPending} className="btn-primary inline-flex items-center gap-2 disabled:opacity-50">
            <Save size={14} /> Save note
          </button>
        </div>
      )}
    </div>
  )
}

function csvCell(v: unknown) {
  const s = String(v ?? '').replace(/"/g, '""')
  return /^[=+\-@]/.test(s) ? `"'${s}"` : `"${s}"`
}

export default function AdminApplicationsPage({ embedded = false }: { embedded?: boolean }) {
  const [status, setStatus] = useState('')
  const [kind, setKind] = useState('')
  const [q, setQ] = useState('')
  const { data = [], isLoading } = useQuery<Application[]>({
    queryKey: ['admin-applications'],
    queryFn: () => apiClient.get('/applications/').then(r => (Array.isArray(r.data) ? r.data : r.data.results ?? [])),
  })

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase()
    return data.filter(a =>
      (!status || a.status === status) &&
      (!kind || a.kind === kind) &&
      (!t || a.full_name.toLowerCase().includes(t) || a.title.toLowerCase().includes(t) || a.email.toLowerCase().includes(t)),
    )
  }, [data, status, kind, q])

  const count = (s: string) => data.filter(a => a.status === s).length

  const exportCsv = () => {
    const head = ['Applicant', 'Email', 'Contact', 'Type', 'Applied to', 'Status', 'Submitted', 'Note']
    const rows = shown.map(a => [a.full_name, a.email, a.contact_number, a.kind, a.title, a.status, a.submitted_at, a.admin_note])
    const csv = [head, ...rows].map(r => r.map(csvCell).join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const el = document.createElement('a')
    el.href = url
    el.download = 'applications.csv'
    el.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-primary-600 text-white"><ClipboardCheck size={20} /></span>
          <div>
            {embedded
              ? <h2 className="text-lg font-bold text-gray-900">Job applications</h2>
              : <h1 className="text-xl font-bold text-gray-900">Job applications</h1>}
            <p className="text-xs text-gray-500">{count('submitted')} new · {count('under_review')} under review · {data.length} total</p>
            <p className="mt-0.5 text-xs text-gray-500">
              Applications sent by young people for jobs (this also shows any older scholarship applications made before the new scholarship system).
              To add or edit the listings, go to{' '}
              <Link to="/admin/jobs-schools" className="font-semibold text-primary-700 hover:underline">Jobs, Scholarships &amp; Schools</Link>.
            </p>
          </div>
        </div>
        <button type="button" onClick={exportCsv} disabled={shown.length === 0} className="btn-secondary inline-flex items-center gap-2 disabled:opacity-50">
          <Download size={14} /> Export CSV
        </button>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <input className="input w-full sm:w-64" placeholder="Search name, email or title" value={q} onChange={e => setQ(e.target.value)} />
        <select className="input w-auto" value={kind} onChange={e => setKind(e.target.value)}>
          <option value="">All types</option>
          <option value="job">Jobs</option>
          <option value="scholarship">Scholarships</option>
        </select>
        {[{ value: '', label: 'All' }, ...STATUSES].map(s => (
          <button
            key={s.value}
            type="button"
            onClick={() => setStatus(s.value)}
            className={cn('px-3 py-1.5 rounded-lg text-sm font-semibold', status === s.value ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}
          >
            {s.label}
          </button>
        ))}
      </div>

      {isLoading && <p className="text-sm text-gray-500">Loading...</p>}
      {!isLoading && shown.length === 0 && <p className="text-sm text-gray-500">No applications match.</p>}
      <div className="space-y-3">{shown.map(a => <Card key={a.id} a={a} />)}</div>
    </div>
  )
}
