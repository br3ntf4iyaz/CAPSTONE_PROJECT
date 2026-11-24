import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle, CheckCircle2, ChevronDown, Clock, Download, Eye, EyeOff, FileText, History, Landmark, Plus, Settings2,
  ShieldCheck, Upload, X, XCircle,
} from 'lucide-react'
import toast from 'react-hot-toast'
import apiClient from '@/api/client'
import { cn } from '@/utils'
import { PageSpinner } from '@/components/ui/Spinner'
import { apiMessage, downloadWithLogin } from '@/portals/youth/lms'

// ── Types ─────────────────────────────────────────────────────────────────────

type Status = 'completed' | 'under_review' | 'pending' | 'overdue'
interface Sub {
  id: number; title: string; description: string; status: 'uploaded' | 'verified' | 'rejected'
  uploaded_at: string; uploaded_by: string; verified_at: string | null; verified_by: string; review_note: string
  is_public: boolean; filename: string
}
interface Period {
  quarter: number | null; label: string; start: string; end: string; deadline: string | null
  status: Status; status_label: string; late_upload: boolean; upcoming: boolean; days_to_deadline: number | null
  current: Sub | null; history: Sub[]
}
interface Req { id: number; title: string; description: string; frequency: 'quarterly' | 'annual'; deadline_month: number | null; deadline_day: number | null; periods: Period[] }
interface Overview { year: number; years: number[]; summary: { total: number; completed: number; pending: number; overdue: number; under_review: number }; requirements: Req[] }
interface ReqRow { id: number; title: string; description: string; frequency: 'quarterly' | 'annual'; deadline_month: number | null; deadline_day: number | null; order: number; is_active: boolean }

const STATUS_UI: Record<Status, { cls: string; icon: typeof Clock; label: string }> = {
  completed: { cls: 'bg-emerald-50 text-emerald-800 border-emerald-200', icon: CheckCircle2, label: 'Completed' },
  under_review: { cls: 'bg-sky-50 text-sky-800 border-sky-200', icon: ShieldCheck, label: 'Waiting for verification' },
  pending: { cls: 'bg-amber-50 text-amber-900 border-amber-200', icon: Clock, label: 'Pending' },
  overdue: { cls: 'bg-red-50 text-red-800 border-red-200', icon: AlertTriangle, label: 'Overdue' },
}
const fmtDate = (iso: string | null) => (iso ? new Date(iso.length === 10 ? iso + 'T00:00:00' : iso).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : 'No deadline')

function deadlineNote(p: Period): string {
  if (p.status === 'completed' || p.days_to_deadline === null) return ''
  if (p.days_to_deadline < 0) return `${-p.days_to_deadline} day${p.days_to_deadline === -1 ? '' : 's'} past the deadline`
  if (p.days_to_deadline === 0) return 'Due today'
  return `${p.days_to_deadline} day${p.days_to_deadline === 1 ? '' : 's'} left`
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminDisclosurePage() {
  const qc = useQueryClient()
  const [year, setYear] = useState<number | null>(null)
  const [upload, setUpload] = useState<{ req: Req; period: Period } | null>(null)
  const [review, setReview] = useState<{ sub: Sub; mode: 'verify' | 'reject' } | null>(null)
  const [manage, setManage] = useState(false)
  const [openHistory, setOpenHistory] = useState<string | null>(null)

  const q = useQuery({
    queryKey: ['disclosure-overview', year],
    queryFn: () => apiClient.get('/compliance/disclosure/overview/', { params: year ? { year } : {} }).then(r => r.data as Overview),
  })
  const refresh = () => qc.invalidateQueries({ queryKey: ['disclosure-overview'] })

  const visibility = useMutation({
    mutationFn: ({ id, is_public }: { id: number; is_public: boolean }) => apiClient.post(`/compliance/disclosure/submissions/${id}/visibility/`, { is_public }),
    onSuccess: () => { refresh(); toast.success('Visibility updated') },
    onError: e => toast.error(apiMessage(e)),
  })

  if (q.isLoading) return <PageSpinner />
  if (q.isError || !q.data) return <p className="p-6 text-sm text-red-600">Could not load the disclosure checklist.</p>
  const o = q.data
  const s = o.summary
  const pct = s.total ? Math.round((s.completed / s.total) * 100) : 0

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900"><Landmark size={22} className="text-primary-700" /> Public Disclosure (FPDPB)</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">
            Track the documents that must be disclosed. A period is only completed after the uploaded document is checked and verified here.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select aria-label="Year" className="input w-auto py-2 text-sm" value={o.year} onChange={e => setYear(Number(e.target.value))}>
            {o.years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button type="button" className="btn-secondary btn-sm" onClick={() => setManage(true)}><Settings2 size={14} /> Manage checklist</button>
          <Link to="/transparency" target="_blank" className="btn-secondary btn-sm"><Eye size={14} /> Public page</Link>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Total required', value: s.total, cls: 'border-gray-200 bg-white text-gray-900', icon: FileText },
          { label: 'Completed', value: s.completed, cls: 'border-emerald-200 bg-emerald-50 text-emerald-900', icon: CheckCircle2 },
          { label: 'Pending', value: s.pending, cls: 'border-amber-200 bg-amber-50 text-amber-900', icon: Clock, note: s.under_review ? `${s.under_review} waiting for verification` : '' },
          { label: 'Overdue', value: s.overdue, cls: s.overdue ? 'border-red-300 bg-red-50 text-red-900' : 'border-gray-200 bg-white text-gray-900', icon: AlertTriangle },
        ].map(c => (
          <div key={c.label} className={cn('rounded-2xl border p-4', c.cls)}>
            <div className="flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-wide opacity-80">{c.label}</p><c.icon size={16} className="opacity-70" /></div>
            <p className="mt-1 text-3xl font-extrabold tabular-nums">{c.value}</p>
            {c.note && <p className="mt-0.5 text-[11px] opacity-80">{c.note}</p>}
          </div>
        ))}
      </div>
      <div>
        <div className="mb-1 flex justify-between text-xs font-semibold text-gray-500"><span>{o.year} completion</span><span>{pct}%</span></div>
        <div className="h-2 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} /></div>
      </div>

      {/* Checklist */}
      {o.requirements.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">No required documents yet. Use "Manage checklist" to add one.</div>
      ) : o.requirements.map(r => (
        <section key={r.id} className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
          <header className="border-b border-gray-100 bg-gray-50 px-5 py-3">
            <h2 className="font-semibold text-gray-900">{r.title} <span className="ml-1 text-xs font-medium text-gray-500">({r.frequency})</span></h2>
            {r.description && <p className="text-xs text-gray-500">{r.description}</p>}
          </header>
          <ul className="divide-y divide-gray-100">
            {r.periods.map(p => {
              const ui = STATUS_UI[p.status]
              const key = `${r.id}-${p.quarter ?? 'y'}`
              return (
                <li key={key} className="px-5 py-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-gray-900">{p.label}</p>
                        <span className={cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold', ui.cls)}>
                          <ui.icon size={12} /> {ui.label}
                        </span>
                        {p.late_upload && <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-800">Uploaded late</span>}
                        {p.upcoming && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-600">Upcoming</span>}
                      </div>
                      <p className="mt-0.5 text-xs text-gray-500">
                        Deadline: <strong className="text-gray-700">{fmtDate(p.deadline)}</strong>
                        {deadlineNote(p) && <> · <span className={cn(p.status === 'overdue' && 'font-semibold text-red-700')}>{deadlineNote(p)}</span></>}
                      </p>
                      {p.current ? (
                        <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-xs text-gray-600">
                          <FileText size={12} className="text-gray-400" /> <span className="font-medium">{p.current.title}</span>
                          <span className="text-gray-400">·</span> uploaded {fmtDate(p.current.uploaded_at)}{p.current.uploaded_by ? ` by ${p.current.uploaded_by}` : ''}
                          {p.current.status === 'verified' && <><span className="text-gray-400">·</span> verified {fmtDate(p.current.verified_at)} by {p.current.verified_by}</>}
                          {p.current.status === 'rejected' && <span className="text-red-700">· rejected{p.current.review_note ? `: ${p.current.review_note}` : ''}</span>}
                        </p>
                      ) : <p className="mt-1.5 text-xs text-gray-400">Nothing uploaded yet.</p>}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {p.current && (
                        <button type="button" className="btn-secondary btn-sm" onClick={() => downloadWithLogin(`/compliance/disclosure/files/${p.current!.id}/`, p.current!.filename).catch(e => toast.error(apiMessage(e)))}>
                          <Download size={13} /> Download
                        </button>
                      )}
                      {p.current?.status === 'uploaded' && (
                        <>
                          <button type="button" className="btn-primary btn-sm" onClick={() => setReview({ sub: p.current!, mode: 'verify' })}><ShieldCheck size={13} /> Verify</button>
                          <button type="button" className="btn-secondary btn-sm text-red-700" onClick={() => setReview({ sub: p.current!, mode: 'reject' })}><XCircle size={13} /> Reject</button>
                        </>
                      )}
                      {p.current?.status === 'verified' && (
                        <button type="button" className="btn-secondary btn-sm" disabled={visibility.isPending}
                          onClick={() => visibility.mutate({ id: p.current!.id, is_public: !p.current!.is_public })}>
                          {p.current.is_public ? <><EyeOff size={13} /> Hide from public</> : <><Eye size={13} /> Show to public</>}
                        </button>
                      )}
                      <button type="button" className="btn-primary btn-sm" onClick={() => setUpload({ req: r, period: p })}>
                        <Upload size={13} /> {p.current ? 'Upload new version' : 'Upload'}
                      </button>
                      {p.history.length > 0 && (
                        <button type="button" className="btn-secondary btn-sm" aria-expanded={openHistory === key} onClick={() => setOpenHistory(openHistory === key ? null : key)}>
                          <History size={13} /> History ({p.history.length}) <ChevronDown size={12} className={cn('transition-transform', openHistory === key && 'rotate-180')} />
                        </button>
                      )}
                    </div>
                  </div>

                  {openHistory === key && (
                    <ul className="mt-3 space-y-1.5 rounded-xl bg-gray-50 p-3 text-xs">
                      {p.history.map(h => (
                        <li key={h.id} className="flex flex-wrap items-center justify-between gap-2">
                          <span><strong>{h.title}</strong> · {fmtDate(h.uploaded_at)} · <span className={cn('font-semibold', h.status === 'verified' ? 'text-emerald-700' : h.status === 'rejected' ? 'text-red-700' : 'text-sky-700')}>{h.status === 'uploaded' ? 'waiting for verification' : h.status}</span>{h.review_note ? ` (${h.review_note})` : ''}</span>
                          <button type="button" className="font-semibold text-primary-700 hover:underline" onClick={() => downloadWithLogin(`/compliance/disclosure/files/${h.id}/`, h.filename).catch(e => toast.error(apiMessage(e)))}>Download</button>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      ))}

      {upload && <UploadModal year={o.year} {...upload} onClose={() => setUpload(null)} onDone={() => { setUpload(null); refresh() }} />}
      {review && <ReviewModal {...review} onClose={() => setReview(null)} onDone={() => { setReview(null); refresh() }} />}
      {manage && <ManageModal onClose={() => { setManage(false); refresh() }} />}
    </div>
  )
}

// ── Modals ────────────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
          <button type="button" aria-label="Close" className="rounded-lg p-1 text-gray-500 hover:bg-gray-100" onClick={onClose}><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

function UploadModal({ req, period, year, onClose, onDone }: { req: Req; period: Period; year: number; onClose: () => void; onDone: () => void }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const file = useRef<HTMLInputElement>(null)
  const m = useMutation({
    mutationFn: () => {
      const f = file.current?.files?.[0]
      if (!f) throw new Error('Choose a file to upload.')
      const fd = new FormData()
      fd.append('requirement', String(req.id)); fd.append('year', String(year))
      if (period.quarter) fd.append('quarter', String(period.quarter))
      if (title.trim()) fd.append('title', title.trim())
      fd.append('description', description); fd.append('file', f)
      return apiClient.post('/compliance/disclosure/submissions/', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
    },
    onSuccess: () => { toast.success('Uploaded. It is completed only after you verify it.'); onDone() },
    onError: (e: any) => toast.error(e?.message && !e?.response ? e.message : apiMessage(e)),
  })
  return (
    <Modal title={`Upload: ${req.title}`} onClose={onClose}>
      <p className="mb-4 rounded-lg bg-gray-50 p-3 text-sm text-gray-600">{period.label} · {year} · deadline {fmtDate(period.deadline)}</p>
      <div className="space-y-3">
        <div><label className="label">Document title <span className="font-normal text-gray-400">(optional)</span></label>
          <input className="input" value={title} maxLength={255} onChange={e => setTitle(e.target.value)} placeholder={`${req.title} - ${year}${period.quarter ? ` Q${period.quarter}` : ''}`} /></div>
        <div><label className="label">Description <span className="font-normal text-gray-400">(optional)</span></label>
          <textarea className="input" rows={3} value={description} maxLength={3000} onChange={e => setDescription(e.target.value)} /></div>
        <div><label className="label">File</label>
          <input ref={file} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx" className="input" />
          <p className="mt-1 text-xs text-gray-500">PDF, Word or Excel, up to 15 MB.</p></div>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" className="btn-secondary btn-sm" onClick={onClose}>Cancel</button>
        <button type="button" className="btn-primary btn-sm" disabled={m.isPending} onClick={() => m.mutate()}>{m.isPending ? 'Uploading…' : 'Upload'}</button>
      </div>
    </Modal>
  )
}

function ReviewModal({ sub, mode, onClose, onDone }: { sub: Sub; mode: 'verify' | 'reject'; onClose: () => void; onDone: () => void }) {
  const [note, setNote] = useState('')
  const [pub, setPub] = useState(true)
  const m = useMutation({
    mutationFn: () => apiClient.post(`/compliance/disclosure/submissions/${sub.id}/${mode}/`, { note, is_public: pub }),
    onSuccess: () => { toast.success(mode === 'verify' ? 'Verified. The period is now completed.' : 'Rejected.'); onDone() },
    onError: e => toast.error(apiMessage(e)),
  })
  return (
    <Modal title={mode === 'verify' ? 'Verify this document' : 'Reject this document'} onClose={onClose}>
      <p className="text-sm text-gray-700"><strong>{sub.title}</strong> · uploaded {fmtDate(sub.uploaded_at)}</p>
      {mode === 'verify' ? (
        <>
          <p className="mt-2 text-sm text-gray-600">Open and read the file first. Verifying marks this period as completed.</p>
          <label className="mt-4 flex cursor-pointer items-start gap-2 text-sm text-gray-700">
            <input type="checkbox" className="mt-0.5 accent-primary-700" checked={pub} onChange={e => setPub(e.target.checked)} />
            <span>Show this document on the public disclosure page.</span>
          </label>
          <div className="mt-3"><label className="label">Note <span className="font-normal text-gray-400">(optional)</span></label>
            <input className="input" value={note} onChange={e => setNote(e.target.value)} maxLength={2000} /></div>
        </>
      ) : (
        <div className="mt-3"><label className="label">Reason (required)</label>
          <textarea className="input" rows={3} value={note} onChange={e => setNote(e.target.value)} maxLength={2000} placeholder="What needs to be corrected?" /></div>
      )}
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" className="btn-secondary btn-sm" onClick={onClose}>Cancel</button>
        <button type="button" className={mode === 'verify' ? 'btn-primary btn-sm' : 'btn-primary btn-sm !bg-red-600 hover:!bg-red-700'}
          disabled={m.isPending || (mode === 'reject' && !note.trim())} onClick={() => m.mutate()}>
          {mode === 'verify' ? 'Verify' : 'Reject'}
        </button>
      </div>
    </Modal>
  )
}

function ManageModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const list = useQuery({ queryKey: ['disclosure-reqs'], queryFn: () => apiClient.get('/compliance/disclosure/requirements/').then(r => r.data as ReqRow[]) })
  const [draft, setDraft] = useState<Partial<ReqRow> | null>(null)
  const save = useMutation({
    mutationFn: (d: Partial<ReqRow>) => d.id ? apiClient.patch(`/compliance/disclosure/requirements/${d.id}/`, d) : apiClient.post('/compliance/disclosure/requirements/', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['disclosure-reqs'] }); setDraft(null); toast.success('Saved') },
    onError: e => toast.error(apiMessage(e)),
  })
  const off = useMutation({
    mutationFn: (id: number) => apiClient.delete(`/compliance/disclosure/requirements/${id}/`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['disclosure-reqs'] }); toast.success('Switched off. Past uploads are kept.') },
    onError: e => toast.error(apiMessage(e)),
  })
  const rows = (list.data ?? []).filter(r => r.is_active)
  return (
    <Modal title="Manage the checklist" onClose={onClose}>
      <p className="mb-3 text-sm text-gray-600">These are the documents that must be disclosed. Quarterly items always use the fixed deadlines: April 7, July 7, October 7 and January 7 of the next year.</p>
      <ul className="space-y-2">
        {rows.map(r => (
          <li key={r.id} className="flex items-start justify-between gap-3 rounded-xl border border-gray-200 p-3">
            <div className="min-w-0"><p className="text-sm font-semibold text-gray-900">{r.title}</p>
              <p className="text-xs text-gray-500">{r.frequency}{r.frequency === 'annual' && r.deadline_month ? ` · due ${r.deadline_month}/${r.deadline_day} each year` : ''}</p></div>
            <div className="flex shrink-0 gap-2">
              <button type="button" className="text-xs font-semibold text-primary-700 hover:underline" onClick={() => setDraft(r)}>Edit</button>
              <button type="button" className="text-xs font-semibold text-red-600 hover:underline" disabled={off.isPending} onClick={() => { if (window.confirm('Switch this item off? Past uploads are kept.')) off.mutate(r.id) }}>Switch off</button>
            </div>
          </li>
        ))}
      </ul>

      {draft ? (
        <div className="mt-4 space-y-3 rounded-xl border border-primary-100 bg-primary-50/40 p-4">
          <div><label className="label">Document name</label><input className="input" value={draft.title ?? ''} onChange={e => setDraft({ ...draft, title: e.target.value })} maxLength={255} /></div>
          <div><label className="label">Description</label><textarea className="input" rows={2} value={draft.description ?? ''} onChange={e => setDraft({ ...draft, description: e.target.value })} /></div>
          <div><label className="label">How often</label>
            <select className="input" value={draft.frequency ?? 'quarterly'} onChange={e => setDraft({ ...draft, frequency: e.target.value as 'quarterly' | 'annual' })}>
              <option value="quarterly">Every quarter</option><option value="annual">Once a year</option>
            </select></div>
          {draft.frequency === 'annual' && (
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Deadline month (1-12)</label><input type="number" min={1} max={12} className="input" value={draft.deadline_month ?? ''} onChange={e => setDraft({ ...draft, deadline_month: e.target.value ? Number(e.target.value) : null })} /></div>
              <div><label className="label">Deadline day</label><input type="number" min={1} max={31} className="input" value={draft.deadline_day ?? ''} onChange={e => setDraft({ ...draft, deadline_day: e.target.value ? Number(e.target.value) : null })} /></div>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary btn-sm" onClick={() => setDraft(null)}>Cancel</button>
            <button type="button" className="btn-primary btn-sm" disabled={save.isPending || !(draft.title ?? '').trim()} onClick={() => save.mutate({ frequency: 'quarterly', ...draft })}>Save</button>
          </div>
        </div>
      ) : (
        <button type="button" className="btn-secondary btn-sm mt-4" onClick={() => setDraft({ frequency: 'quarterly', title: '', description: '' })}><Plus size={13} /> Add a required document</button>
      )}
    </Modal>
  )
}
