import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, ChevronDown, Clock, ExternalLink, Eye, FileCheck2, FileText, Globe2, History, RotateCcw, ShieldAlert, ShieldCheck, Upload, X } from 'lucide-react'
import toast from 'react-hot-toast'
import apiClient from '@/api/client'
import { cn } from '@/utils'
import { PageSpinner } from '@/components/ui/Spinner'
import { StatusChip, StatusLegend, fmtDate, type ComplianceStatus } from '@/components/ComplianceStatus'
import { CompletionRing, KpiCard, type Tone } from '@/components/ComplianceKit'
import { apiMessage, downloadWithLogin } from '../lms'

interface Rec {
  id: number; status: ComplianceStatus; status_label: string; title: string; description: string; submitted_at: string | null
  submitted_by: string; review_remarks?: string; reviewed_at?: string | null; is_none_declaration: boolean; has_file: boolean
  filename: string; via_existing_requirement: boolean; published_at: string | null; total_amount: string | null
}
interface Slot {
  label: string; quarter: number | null; month: number | null; deadline: string | null
  status: ComplianceStatus; status_label: string; late: boolean; current: Rec | null; history: Rec[]
}
interface Detail {
  barangay: { id: number; name: string }; category: string; year: number; label: string; slots: Slot[]
  requirement?: { id: number; status: string; due_date: string | null; has_file: boolean; submitted_at: string | null } | null
  manage_url?: string; manage_ppa_url?: string; ppa_budget_total?: string
  ppas?: { id: number; title: string; abyip_reference_code: string; status: string; estimated_budget: string | null; period_of_implementation: string }[]
}
interface Overview {
  year: number; years: number[]; percent: number
  summary: { total: number; completed: number; pending: number; overdue: number; for_verification: number; returned: number; verified: number; published: number }
  me: { role: 'admin' | 'sk'; barangay: { id: number; name: string } | null; can_submit: boolean; needs_verification: boolean }
  categories: { key: string; short: string; label: string; kind: 'single' | 'quarterly' | 'monthly'; description: string }[]
}

const peso = (v: string | null | undefined) => (v ? `₱${Number(v).toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : null)

export default function SKCompliancePage() {
  const [year, setYear] = useState<number | null>(null)
  const q = useQuery({
    queryKey: ['sk-compliance-overview', year],
    queryFn: () => apiClient.get('/compliance/sk/overview/', { params: year ? { year } : {} }).then(r => r.data as Overview),
    retry: false,
  })

  if (q.isLoading) return <PageSpinner />
  if (q.isError || !q.data) {
    return (
      <div className="mx-auto max-w-xl py-16 text-center">
        <ShieldAlert className="mx-auto mb-3 text-gray-300" size={40} />
        <p className="font-display text-lg font-bold text-gray-900">SK Compliance Monitoring System</p>
        <p className="mt-2 text-sm text-gray-600">{apiMessage(q.error, 'This page is for SK officials whose profile has a barangay with an SK council.')}</p>
      </div>
    )
  }
  const o = q.data
  const s = o.summary
  const kpis: { label: string; value: number; icon: React.ReactNode; tone: Tone }[] = [
    { label: 'Total required', value: s.total, icon: <FileText size={16} />, tone: 'ink' },
    { label: 'Completed', value: s.completed, icon: <CheckCircle2 size={16} />, tone: 'green' },
    { label: 'Pending', value: s.pending, icon: <Clock size={16} />, tone: 'yellow' },
    { label: 'Overdue', value: s.overdue, icon: <AlertTriangle size={16} />, tone: 'red' },
    { label: 'Submitted for verification', value: s.for_verification, icon: <FileCheck2 size={16} />, tone: 'blue' },
    { label: 'Returned for correction', value: s.returned, icon: <RotateCcw size={16} />, tone: 'orange' },
    { label: 'Verified', value: s.verified, icon: <ShieldCheck size={16} />, tone: 'green' },
    { label: 'Published', value: s.published, icon: <Globe2 size={16} />, tone: 'teal' },
  ]

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-10">
      <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary-700 to-primary-900 p-7 text-white shadow-lg sm:p-9">
        <div className="ph-stripe absolute inset-x-0 top-0 h-1.5" aria-hidden />
        <div aria-hidden className="pointer-events-none absolute -bottom-20 -right-16 h-64 w-64 rounded-full bg-accent-400/20 blur-2xl" />
        <div className="absolute right-6 top-6 hidden sm:block"><CompletionRing percent={o.percent} size={84} /></div>
        <p className="eyebrow-on-dark mb-2 relative">SK Compliance Monitoring System</p>
        <h1 className="font-display text-3xl font-extrabold leading-tight">{o.me.barangay?.name ?? 'Your barangay'}</h1>
        <p className="mt-2 max-w-2xl text-sm text-primary-100">
          Submit the five required documents, follow their deadlines and see when LYDO verifies and publishes them on the{' '}
          <Link to="/fpdpb" className="font-semibold underline">FPDPB</Link>.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <select aria-label="Reporting year" className="rounded-xl border-0 bg-white/95 px-3 py-2 text-sm font-semibold text-gray-900" value={o.year} onChange={e => setYear(Number(e.target.value))}>
            {o.years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <span className="rounded-full bg-white/15 px-3 py-1 text-sm font-semibold">{o.percent}% complete</span>
          <Link to="/sk-requirements" className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3.5 py-2 text-sm font-semibold text-primary-800 hover:bg-primary-50">
            <Upload size={14} /> Upload CBYDP, ABYIP or Annual Budget
          </Link>
        </div>
      </header>

      {o.me.needs_verification && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <p>You can see your barangay's records, but you must <Link to="/verify-identity" className="font-semibold underline">verify your identity</Link> before you can submit RCB and MIL documents.</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map(c => <KpiCard key={c.label} {...c} />)}
      </div>
      <div className="rounded-2xl border border-ink-100 bg-white p-4 shadow-sm">
        <div className="mb-2 flex items-center justify-between text-xs font-semibold text-ink-600"><span>{o.year} compliance</span><span className="text-primary-700">{o.percent}%</span></div>
        <div className="h-2.5 overflow-hidden rounded-full bg-ink-100"><div className="h-full rounded-full bg-gradient-to-r from-primary-600 to-emerald-500 transition-all duration-700" style={{ width: `${o.percent}%` }} /></div>
        <div className="mt-3"><StatusLegend /></div>
      </div>

      {o.categories.map(c => <Category key={c.key} cat={c} year={o.year} barangayId={o.me.barangay?.id ?? 0} canSubmit={o.me.can_submit} />)}
    </div>
  )
}

function Category({ cat, year, barangayId, canSubmit }: { cat: Overview['categories'][number]; year: number; barangayId: number; canSubmit: boolean }) {
  const [open, setOpen] = useState(cat.kind === 'single' || cat.kind === 'quarterly')
  const [modal, setModal] = useState<Slot | null>(null)
  const [history, setHistory] = useState<number | null>(null)
  const q = useQuery({
    queryKey: ['sk-compliance-slots', cat.key, year, barangayId],
    queryFn: () => apiClient.get('/compliance/sk/slots/', { params: { category: cat.key, year } }).then(r => r.data as Detail),
    enabled: open,
  })
  const d = q.data
  const done = d?.slots.filter(s => s.status === 'verified' || s.status === 'published').length ?? 0

  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
      <button type="button" aria-expanded={open} onClick={() => setOpen(o => !o)} className="flex w-full items-center justify-between gap-3 bg-gray-50 px-5 py-4 text-left">
        <div className="min-w-0">
          <h2 className="font-semibold text-gray-900">{cat.label}</h2>
          <p className="mt-0.5 text-xs leading-relaxed text-gray-500">{cat.description}</p>
          {d && <p className="mt-1 text-xs font-semibold text-gray-600">{done} of {d.slots.length} completed</p>}
        </div>
        <ChevronDown size={18} className={cn('shrink-0 text-gray-400 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="p-5">
          {q.isLoading ? <PageSpinner /> : q.isError || !d ? <p className="text-sm text-red-600">Could not load this section.</p> : (
            <>
              {d.manage_url && (
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary-100 bg-primary-50/50 p-3.5 text-sm">
                  <p className="text-gray-700">
                    {cat.key === 'cbydp' ? 'The CBYDP is a three-year plan.' : ''} Upload and update this document in the existing <strong>SK Requirements</strong> page.
                    LYDO then verifies it here.
                  </p>
                  <Link to={d.manage_url} className="btn-primary btn-sm shrink-0"><ExternalLink size={13} /> Open SK Requirements</Link>
                </div>
              )}

              <ul className="divide-y divide-gray-100">
                {d.slots.map((s, i) => {
                  const key = `${cat.key}-${i}`
                  const rec = s.current
                  const canAct = cat.kind !== 'single' && canSubmit && (!rec || rec.status === 'returned')
                  return (
                    <li key={key} className="py-3.5">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-gray-900">{s.label}</p>
                            <StatusChip status={s.status} />
                            {s.late && <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-800">Submitted late</span>}
                            {rec?.is_none_declaration && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-700">NONE FOR THE PERIOD</span>}
                          </div>
                          <p className="mt-0.5 text-xs text-gray-500">
                            {s.deadline ? <>Deadline: <strong className="text-gray-700">{fmtDate(s.deadline)}</strong></> : 'No deadline set'}
                            {rec?.submitted_at && <> · Submitted {fmtDate(rec.submitted_at)}</>}
                            {rec?.status === 'verified' || rec?.status === 'published' ? <> · Verified {fmtDate(rec.reviewed_at)}</> : null}
                          </p>
                          {rec?.status === 'returned' && rec.review_remarks && (
                            <p className="mt-1.5 rounded-lg bg-orange-50 px-3 py-2 text-xs text-orange-900"><strong>LYDO remarks:</strong> {rec.review_remarks}</p>
                          )}
                          {cat.key === 'annual_budget' && rec?.total_amount && <p className="mt-1 text-xs text-gray-600">Total approved budget: {peso(rec.total_amount)}</p>}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {rec?.has_file && (
                            <button type="button" className="btn-secondary btn-sm"
                              onClick={() => downloadWithLogin(`/compliance/sk/records/${rec.id}/file/`, rec.filename).catch(err => toast.error(apiMessage(err)))}>
                              <Eye size={13} /> Download
                            </button>
                          )}
                          {canAct && (
                            <button type="button" className="btn-primary btn-sm" onClick={() => setModal(s)}>
                              <Upload size={13} /> {rec?.status === 'returned' ? 'Submit again' : 'Submit'}
                            </button>
                          )}
                          {s.history.length > 1 && (
                            <button type="button" className="btn-secondary btn-sm" onClick={() => setHistory(history === i ? null : i)}><History size={13} /> History ({s.history.length})</button>
                          )}
                        </div>
                      </div>
                      {history === i && (
                        <ul className="mt-2 space-y-1 rounded-xl bg-gray-50 p-3 text-xs">
                          {s.history.map(h => (
                            <li key={h.id} className="flex flex-wrap items-center gap-2">
                              <StatusChip status={h.status} /> <span>{fmtDate(h.submitted_at)}</span>
                              {h.is_none_declaration && <span className="font-semibold">NONE FOR THE PERIOD</span>}
                              {h.review_remarks && <span className="text-gray-600">({h.review_remarks})</span>}
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  )
                })}
              </ul>

              {d.ppas && (
                <div className="mt-5 rounded-xl border border-gray-200">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 bg-gray-50 px-4 py-2.5">
                    <p className="text-sm font-semibold text-gray-900">Programs, Projects and Activities (PPAs) from your submissions</p>
                    {d.manage_ppa_url && <Link to={d.manage_ppa_url} className="text-xs font-semibold text-primary-700 hover:underline">Open Submissions</Link>}
                  </div>
                  {d.ppas.length === 0 ? <p className="px-4 py-3 text-sm text-gray-500">No PPAs submitted yet.</p> : (
                    <>
                      <table className="w-full text-sm"><thead><tr className="text-left text-xs text-gray-500"><th className="px-4 py-2">PPA</th><th>ABYIP code</th><th>Status</th><th className="pr-4 text-right">Budget</th></tr></thead>
                        <tbody>{d.ppas.map(p => (
                          <tr key={p.id} className="border-t border-gray-100"><td className="px-4 py-2 font-medium text-gray-900">{p.title}</td><td>{p.abyip_reference_code || '—'}</td><td className="capitalize">{p.status.replace('_', ' ')}</td><td className="pr-4 text-right">{peso(p.estimated_budget) ?? '—'}</td></tr>
                        ))}</tbody></table>
                      <p className="border-t border-gray-100 px-4 py-2 text-right text-xs text-gray-600">Total PPA budget: <strong>{peso(d.ppa_budget_total)}</strong></p>
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {modal && d && <SubmitModal cat={cat} slot={modal} year={year} onClose={() => setModal(null)} />}
    </section>
  )
}

function SubmitModal({ cat, slot, year, onClose }: { cat: Overview['categories'][number]; slot: Slot; year: number; onClose: () => void }) {
  const qc = useQueryClient()
  const file = useRef<HTMLInputElement>(null)
  const [none, setNone] = useState(false)
  const [description, setDescription] = useState('')
  const m = useMutation({
    mutationFn: () => {
      const fd = new FormData()
      fd.append('category', cat.key); fd.append('year', String(year))
      if (slot.quarter) fd.append('quarter', String(slot.quarter))
      if (slot.month) fd.append('month', String(slot.month))
      if (description.trim()) fd.append('description', description.trim())
      if (none) fd.append('none_declaration', 'true')
      else {
        const f = file.current?.files?.[0]
        if (!f) throw new Error('Choose the document to upload.')
        fd.append('file', f)
      }
      return apiClient.post('/compliance/sk/records/', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
    },
    onSuccess: () => {
      toast.success(none ? 'Declaration submitted. It waits for LYDO verification.' : 'Submitted. It waits for LYDO verification.')
      qc.invalidateQueries({ queryKey: ['sk-compliance-slots'] })
      qc.invalidateQueries({ queryKey: ['sk-compliance-overview'] })
      onClose()
    },
    onError: (e: any) => toast.error(e?.message && !e?.response ? e.message : apiMessage(e)),
  })
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label={`Submit ${slot.label}`}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div><h2 className="text-lg font-bold text-gray-900">{cat.short}: {slot.label}</h2><p className="text-xs text-gray-500">Deadline {fmtDate(slot.deadline)}</p></div>
          <button type="button" aria-label="Close" className="rounded-lg p-1 text-gray-500 hover:bg-gray-100" onClick={onClose}><X size={18} /></button>
        </div>

        {cat.kind === 'monthly' && (
          <div className="mb-4 space-y-2 rounded-xl border border-gray-200 p-3 text-sm">
            <label className="flex cursor-pointer items-start gap-2"><input type="radio" name="mode" className="mt-1 accent-primary-700" checked={!none} onChange={() => setNone(false)} />
              <span><strong>Upload the Itemized List of Purchase Requests</strong> and supporting Purchase Request documents.</span></label>
            <label className="flex cursor-pointer items-start gap-2"><input type="radio" name="mode" className="mt-1 accent-primary-700" checked={none} onChange={() => setNone(true)} />
              <span><strong>NONE FOR THE PERIOD</strong>: there were no purchase requests this month. This is a formal declaration that LYDO must verify.</span></label>
          </div>
        )}

        {!none && (
          <div className="mb-3"><label className="label">Document</label>
            <input ref={file} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx" className="input" />
            <p className="mt-1 text-xs text-gray-500">PDF, Word or Excel, up to 15 MB.</p></div>
        )}
        <div><label className="label">Note <span className="font-normal text-gray-400">(optional)</span></label>
          <textarea className="input" rows={2} maxLength={3000} value={description} onChange={e => setDescription(e.target.value)} /></div>

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-secondary btn-sm" onClick={onClose}>Cancel</button>
          <button type="button" className="btn-primary btn-sm" disabled={m.isPending}
            onClick={() => { if (!none || window.confirm('Declare NONE FOR THE PERIOD for ' + slot.label + '? LYDO will verify this declaration.')) m.mutate() }}>
            {m.isPending ? 'Submitting…' : none ? 'Submit declaration' : 'Submit document'}
          </button>
        </div>
      </div>
    </div>
  )
}
