import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, ExternalLink, Globe2, History, Landmark, RotateCcw, Search, ShieldCheck, X } from 'lucide-react'
import toast from 'react-hot-toast'
import apiClient from '@/api/client'
import { cn } from '@/utils'
import { PageSpinner } from '@/components/ui/Spinner'
import { MONTHS, STATUS_META, StatusChip, StatusLegend, fmtDate, type ComplianceStatus } from '@/components/ComplianceStatus'
import { apiMessage, downloadWithLogin } from '@/portals/youth/lms'
import AdminSKTrackerPage from './AdminSKTrackerPage'
import AdminDisclosurePage from './AdminDisclosurePage'

interface Period { label: string; quarter: number | null; month: number | null; deadline: string | null; status: ComplianceStatus; late: boolean; workflow: string | null; record_id: number | null }
interface Cell { periods: Period[]; kind: 'single' | 'quarterly' | 'monthly'; completed: number; overdue: number; total: number }
interface Row { barangay_id: number; barangay: string; cells: Record<string, Cell>; totals: { total: number; completed: number; overdue: number } }
interface Overview {
  year: number; years: number[]; percent: number; rows: Row[]
  summary: { total: number; completed: number; pending: number; overdue: number; for_verification: number; returned: number; verified: number; published: number }
  categories: { key: string; short: string; label: string; kind: string }[]
  barangays: { id: number; name: string }[]; statuses: { key: string; label: string }[]
}
interface Rec {
  id: number; status: ComplianceStatus; title: string; description: string; year: number; period_end_year: number | null; submitted_at: string | null
  submitted_by: string; reviewed_at: string | null; reviewed_by: string; review_remarks: string; is_none_declaration: boolean; has_file: boolean
  filename: string; via_existing_requirement: boolean; total_amount: string | null; published_at: string | null
}
interface Slot { label: string; deadline: string | null; status: ComplianceStatus; late: boolean; current: Rec | null; history: Rec[] }
interface Detail { barangay: { id: number; name: string }; category: string; year: number; label: string; slots: Slot[] }
interface QueueRow extends Rec { barangay: string; barangay_id: number; category: string; category_short: string; period: string; waiting_days: number }

export default function AdminSKCompliancePage() {
  const [search, setSearch] = useSearchParams()
  const tab = (['monitor', 'queue', 'other', 'office'].includes(search.get('tab') ?? '') ? search.get('tab') : 'monitor') as 'monitor' | 'queue' | 'other' | 'office'
  const setTab = (t: 'monitor' | 'queue' | 'other' | 'office') => setSearch(t === 'monitor' ? {} : { tab: t }, { replace: true })
  const [f, setF] = useState({ year: '', barangay: '', category: '', quarter: '', month: '', status: '', publication: '' })
  const [open, setOpen] = useState<{ barangay_id: number; barangay: string; category: string; year: number } | null>(null)
  const params = Object.fromEntries(Object.entries(f).filter(([, v]) => v))
  const q = useQuery({
    queryKey: ['sk-compliance-overview', 'admin', params],
    queryFn: () => apiClient.get('/compliance/sk/overview/', { params }).then(r => r.data as Overview),
    placeholderData: prev => prev,
  })
  const queue = useQuery({ queryKey: ['sk-compliance-queue'], queryFn: () => apiClient.get('/compliance/sk/queue/').then(r => r.data as { to_verify: QueueRow[]; ready_to_publish: QueueRow[] }) })
  const set = (k: keyof typeof f, v: string) => setF(p => ({ ...p, [k]: v }))

  if (q.isLoading) return <PageSpinner />
  if (q.isError || !q.data) return <p className="p-6 text-sm text-red-600">Could not load the SK compliance records.</p>
  const o = q.data
  const s = o.summary
  const waiting = (queue.data?.to_verify.length ?? 0) + (queue.data?.ready_to_publish.length ?? 0)
  const cards = [
    { label: 'Total required', value: s.total, cls: 'border-gray-200 bg-white' },
    { label: 'Completed', value: s.completed, cls: 'border-emerald-200 bg-emerald-50 text-emerald-900' },
    { label: 'Pending', value: s.pending, cls: 'border-amber-200 bg-amber-50 text-amber-900' },
    { label: 'Overdue', value: s.overdue, cls: s.overdue ? 'border-red-300 bg-red-50 text-red-900' : 'border-gray-200 bg-white' },
    { label: 'Submitted for verification', value: s.for_verification, cls: 'border-sky-200 bg-sky-50 text-sky-900' },
    { label: 'Returned for correction', value: s.returned, cls: s.returned ? 'border-orange-300 bg-orange-50 text-orange-900' : 'border-gray-200 bg-white' },
    { label: 'Verified', value: s.verified, cls: 'border-emerald-200 bg-white' },
    { label: 'Published', value: s.published, cls: 'border-teal-300 bg-teal-50 text-teal-900' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900"><Landmark size={22} className="text-primary-700" /> SK Compliance Monitoring System</h1>
          <p className="mt-1 max-w-3xl text-sm text-gray-500">
            Monitor the CBYDP, ABYIP, SK Approved Annual Budget, quarterly RCB and monthly MIL of every barangay. Verified documents are published on the
            FPDPB (Full Public Disclosure Policy Board).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/fpdpb" target="_blank" className="btn-secondary btn-sm"><Globe2 size={13} /> Open FPDPB (public)</Link>
        </div>
      </div>

      <div className="flex gap-2" role="tablist">
        {([['monitor', 'Monitoring (5 documents)'], ['queue', `Verification queue${waiting ? ` (${waiting})` : ''}`], ['other', 'Other requirements'], ['office', 'LYDO office documents']] as const).map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={cn('whitespace-nowrap rounded-xl border px-4 py-2 text-sm font-semibold', tab === k ? 'border-primary-700 bg-primary-700 text-white' : 'border-gray-200 bg-white text-gray-700 hover:border-primary-300')}>{label}</button>
        ))}
      </div>

      {tab === 'monitor' ? (
        <>
          <section aria-label="Filters" className="grid grid-cols-2 gap-3 rounded-2xl border border-gray-200 bg-white p-4 md:grid-cols-4 xl:grid-cols-7">
            <Sel label="Year" value={f.year || String(o.year)} onChange={v => set('year', v)}>{o.years.map(y => <option key={y} value={y}>{y}</option>)}</Sel>
            <Sel label="Barangay" value={f.barangay} onChange={v => set('barangay', v)}><option value="">All barangays</option>{o.barangays.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</Sel>
            <Sel label="Document" value={f.category} onChange={v => set('category', v)}><option value="">All documents</option>{o.categories.map(c => <option key={c.key} value={c.key}>{c.short}</option>)}</Sel>
            <Sel label="Quarter" value={f.quarter} onChange={v => set('quarter', v)}><option value="">Any quarter</option>{[1, 2, 3, 4].map(n => <option key={n} value={n}>Q{n}</option>)}</Sel>
            <Sel label="Month" value={f.month} onChange={v => set('month', v)}><option value="">Any month</option>{MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</Sel>
            <Sel label="Status" value={f.status} onChange={v => set('status', v)}><option value="">Any status</option>{o.statuses.map(st => <option key={st.key} value={st.key}>{st.label}</option>)}</Sel>
            <Sel label="Publication" value={f.publication} onChange={v => set('publication', v)}><option value="">Published or not</option><option value="published">Published</option><option value="unpublished">Not published</option></Sel>
          </section>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {cards.map(c => (
              <div key={c.label} className={cn('rounded-2xl border p-4', c.cls)}>
                <p className="text-[11px] font-semibold uppercase tracking-wide opacity-75">{c.label}</p>
                <p className="mt-1 text-3xl font-extrabold tabular-nums">{c.value}</p>
              </div>
            ))}
          </div>
          <div>
            <div className="mb-1 flex justify-between text-xs font-semibold text-gray-500"><span>Compliance for the selected filters</span><span>{o.percent}%</span></div>
            <div className="h-2 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${o.percent}%` }} /></div>
          </div>
          <StatusLegend />

          <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <tr><th className="px-4 py-3">Barangay</th>{o.categories.map(c => <th key={c.key} className="px-3 py-3">{c.short}</th>)}<th className="px-3 py-3 text-right">Done</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {o.rows.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">No records match these filters.</td></tr>}
                {o.rows.map(r => (
                  <tr key={r.barangay_id} className="hover:bg-gray-50/60">
                    <td className="px-4 py-3 font-semibold text-gray-900">{r.barangay}</td>
                    {o.categories.map(c => {
                      const cell = r.cells[c.key]
                      return (
                        <td key={c.key} className="px-3 py-2.5 align-middle">
                          {!cell || cell.total === 0 ? <span className="text-xs text-gray-300">—</span> : (
                            <button type="button" className="group block text-left" aria-label={`${r.barangay} ${c.short}`}
                              onClick={() => setOpen({ barangay_id: r.barangay_id, barangay: r.barangay, category: c.key, year: o.year })}>
                              {cell.kind === 'single' ? <StatusChip status={cell.periods[0].status} /> : (
                                <>
                                  <span className="text-xs font-semibold text-gray-700 group-hover:underline">{cell.completed}/{cell.total}{cell.overdue ? <span className="ml-1 text-red-600">· {cell.overdue} overdue</span> : null}</span>
                                  <span className="mt-1 flex flex-wrap gap-0.5">{cell.periods.map((p, i) => <span key={i} title={`${p.label}: ${STATUS_META[p.status].label}`} className={cn('h-2.5 w-2.5 rounded-sm', STATUS_META[p.status].dot)} />)}</span>
                                </>
                              )}
                            </button>
                          )}
                        </td>
                      )
                    })}
                    <td className="px-3 py-3 text-right text-xs font-semibold tabular-nums text-gray-700">{r.totals.completed}/{r.totals.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : tab === 'other' ? (
        <AdminSKTrackerPage embedded />
      ) : tab === 'office' ? (
        <AdminDisclosurePage embedded />
      ) : (
        <Queue data={queue.data} loading={queue.isLoading} onOpen={r => setOpen({ barangay_id: r.barangay_id, barangay: r.barangay, category: r.category, year: r.year })} />
      )}

      {open && <DetailModal {...open} onClose={() => setOpen(null)} />}
    </div>
  )
}

function Sel({ label, value, onChange, children }: { label: string; value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return <label className="text-xs font-semibold text-gray-500">{label}<select className="input mt-1 py-2 text-sm" value={value} onChange={e => onChange(e.target.value)}>{children}</select></label>
}

function Queue({ data, loading, onOpen }: { data?: { to_verify: QueueRow[]; ready_to_publish: QueueRow[] }; loading: boolean; onOpen: (r: QueueRow) => void }) {
  if (loading || !data) return <PageSpinner />
  const Block = ({ title, rows, empty }: { title: string; rows: QueueRow[]; empty: string }) => (
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
      <h2 className="border-b border-gray-100 bg-gray-50 px-5 py-3 text-sm font-semibold text-gray-900">{title} ({rows.length})</h2>
      {rows.length === 0 ? <p className="px-5 py-6 text-sm text-gray-500">{empty}</p> : (
        <ul className="divide-y divide-gray-100">
          {rows.map(r => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
              <div className="min-w-0"><p className="text-sm font-semibold text-gray-900">{r.barangay}: {r.period}</p>
                <p className="text-xs text-gray-500">Submitted {fmtDate(r.submitted_at)} by {r.submitted_by || 'LYDO'} · waiting {r.waiting_days} day{r.waiting_days === 1 ? '' : 's'}{r.is_none_declaration ? ' · NONE FOR THE PERIOD' : ''}</p></div>
              <div className="flex items-center gap-2"><StatusChip status={r.status} /><button type="button" className="btn-primary btn-sm" onClick={() => onOpen(r)}>Review</button></div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
  return <div className="space-y-5"><Block title="Waiting for verification" rows={data.to_verify} empty="Nothing is waiting for verification." />
    <Block title="Verified and ready to publish" rows={data.ready_to_publish} empty="No verified documents are waiting for publication." /></div>
}

function DetailModal({ barangay_id, barangay, category, year, onClose }: { barangay_id: number; barangay: string; category: string; year: number; onClose: () => void }) {
  const q = useQuery({
    queryKey: ['sk-compliance-detail', barangay_id, category, year],
    queryFn: () => apiClient.get('/compliance/sk/slots/', { params: { barangay: barangay_id, category, year } }).then(r => r.data as Detail),
  })
  const [hist, setHist] = useState<number | null>(null)
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4" role="dialog" aria-modal="true" aria-label={`${barangay} ${category}`}>
      <div className="my-6 w-full max-w-3xl rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div><h2 className="text-lg font-bold text-gray-900">{barangay}</h2><p className="text-sm text-gray-500">{q.data?.label ?? ''} · {year}</p></div>
          <button type="button" aria-label="Close" className="rounded-lg p-1 text-gray-500 hover:bg-gray-100" onClick={onClose}><X size={18} /></button>
        </div>
        {q.isLoading ? <PageSpinner /> : q.isError || !q.data ? <p className="text-sm text-red-600">Could not load.</p> : (
          <ul className="space-y-3">
            {q.data.slots.map((s, i) => (
              <li key={i} className="rounded-xl border border-gray-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div><p className="font-semibold text-gray-900">{s.label}</p>
                    <p className="text-xs text-gray-500">{s.deadline ? `Deadline ${fmtDate(s.deadline)}` : 'No deadline set'}{s.late ? ' · submitted late' : ''}</p></div>
                  <StatusChip status={s.status} />
                </div>
                {s.current ? <Review rec={s.current} category={category} onDone={() => q.refetch()} /> : <p className="mt-2 text-sm text-gray-400">Nothing submitted for this period.</p>}
                {s.history.length > 1 && (
                  <div className="mt-2"><button type="button" className="inline-flex items-center gap-1 text-xs font-semibold text-primary-700 hover:underline" onClick={() => setHist(hist === i ? null : i)}><History size={12} /> History ({s.history.length})</button>
                    {hist === i && <ul className="mt-1.5 space-y-1 rounded-lg bg-gray-50 p-2.5 text-xs">{s.history.map(h => (
                      <li key={h.id} className="flex flex-wrap items-center gap-2"><StatusChip status={h.status} /> {fmtDate(h.submitted_at)}{h.review_remarks ? ` · ${h.review_remarks}` : ''}
                        {h.has_file && <button type="button" className="font-semibold text-primary-700 hover:underline" onClick={() => downloadWithLogin(`/compliance/sk/records/${h.id}/file/`, h.filename).catch(e => toast.error(apiMessage(e)))}>Download</button>}</li>))}</ul>}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        {(category === 'cbydp' || category === 'abyip' || category === 'annual_budget') && (
          <p className="mt-4 text-xs text-gray-500">The SK uploads this document in the SK Requirements page of their account. You can also record it for them under <Link to="/admin/sk-compliance?tab=other" onClick={onClose} className="font-semibold text-primary-700 hover:underline">Other requirements</Link>.</p>
        )}
      </div>
    </div>
  )
}

function Review({ rec, category, onDone }: { rec: Rec; category: string; onDone: () => void }) {
  const qc = useQueryClient()
  const [remarks, setRemarks] = useState('')
  const [description, setDescription] = useState(rec.description)
  const [meta, setMeta] = useState({ year: String(rec.year), period_end_year: rec.period_end_year ? String(rec.period_end_year) : '', total_amount: rec.total_amount ?? '' })
  const act = useMutation({
    mutationFn: (body: Record<string, unknown>) => apiClient.post(`/compliance/sk/records/${rec.id}/review/`, body).then(r => r.data),
    onSuccess: (_d, b) => {
      toast.success({ start: 'Review started.', verify: 'Verified.', return: 'Returned for correction.', publish: 'Published on the FPDPB.', unpublish: 'Removed from the FPDPB.', update: 'Saved.' }[String(b.action)] ?? 'Done.')
      qc.invalidateQueries({ queryKey: ['sk-compliance-overview'] }); qc.invalidateQueries({ queryKey: ['sk-compliance-queue'] })
      onDone()
    },
    onError: e => toast.error(apiMessage(e)),
  })
  const go = (action: string, confirm?: string, extra: Record<string, unknown> = {}) => {
    if (confirm && !window.confirm(confirm)) return
    act.mutate({ action, remarks, description, ...extra })
  }
  const existing = category === 'cbydp' || category === 'abyip' || category === 'annual_budget'
  const st = rec.status
  return (
    <div className="mt-3 space-y-3 border-t border-gray-100 pt-3 text-sm">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-600">
        <StatusChip status={st} />
        <span>Submitted {fmtDate(rec.submitted_at)}{rec.submitted_by ? ` by ${rec.submitted_by}` : ''}</span>
        {rec.reviewed_by && <span>· reviewed by {rec.reviewed_by} on {fmtDate(rec.reviewed_at)}</span>}
        {rec.is_none_declaration && <span className="font-bold tracking-wide text-gray-800">NONE FOR THE PERIOD</span>}
        {rec.via_existing_requirement && <span className="rounded bg-primary-50 px-1.5 py-0.5 text-primary-800">from SK Requirements</span>}
      </div>
      {rec.review_remarks && <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-700"><strong>Remarks:</strong> {rec.review_remarks}</p>}
      <div className="flex flex-wrap gap-2">
        {rec.has_file && <button type="button" className="btn-secondary btn-sm" onClick={() => downloadWithLogin(`/compliance/sk/records/${rec.id}/file/`, rec.filename).catch(e => toast.error(apiMessage(e)))}><Download size={13} /> Download</button>}
      </div>

      {existing && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <label className="text-xs font-semibold text-gray-500">{category === 'cbydp' ? 'Valid from (year)' : 'Reporting year'}<input className="input mt-1 py-1.5 text-sm" value={meta.year} onChange={e => setMeta({ ...meta, year: e.target.value })} /></label>
          {category === 'cbydp' && <label className="text-xs font-semibold text-gray-500">Valid until (year)<input className="input mt-1 py-1.5 text-sm" value={meta.period_end_year} onChange={e => setMeta({ ...meta, period_end_year: e.target.value })} /></label>}
          {category === 'annual_budget' && <label className="text-xs font-semibold text-gray-500">Total approved budget (₱)<input className="input mt-1 py-1.5 text-sm" inputMode="decimal" value={meta.total_amount} onChange={e => setMeta({ ...meta, total_amount: e.target.value })} /></label>}
          <button type="button" className="btn-secondary btn-sm self-end" disabled={act.isPending} onClick={() => go('update', undefined, { year: meta.year, ...(category === 'cbydp' ? { period_end_year: meta.period_end_year || meta.year } : {}), ...(category === 'annual_budget' ? { total_amount: meta.total_amount } : {}) })}>Save details</button>
        </div>
      )}

      {(st === 'submitted' || st === 'under_verification' || st === 'verified') && (
        <div><label className="text-xs font-semibold text-gray-500">Remarks <span className="font-normal text-gray-400">(required when returning; never shown to the public)</span></label>
          <textarea className="input mt-1 text-sm" rows={2} maxLength={2000} value={remarks} onChange={e => setRemarks(e.target.value)} /></div>
      )}
      {(st === 'verified' || st === 'published') && (
        <div><label className="text-xs font-semibold text-gray-500">Public description <span className="font-normal text-gray-400">(shown on the FPDPB)</span></label>
          <input className="input mt-1 text-sm" maxLength={3000} value={description} onChange={e => setDescription(e.target.value)} /></div>
      )}
      <div className="flex flex-wrap gap-2">
        {st === 'submitted' && <button type="button" className="btn-secondary btn-sm" disabled={act.isPending} onClick={() => go('start')}><Search size={13} /> Start review</button>}
        {(st === 'submitted' || st === 'under_verification') && <button type="button" className="btn-primary btn-sm" disabled={act.isPending} onClick={() => go('verify', 'Verify this document? You have checked it.')}><ShieldCheck size={13} /> Verify</button>}
        {(st === 'submitted' || st === 'under_verification' || st === 'verified') && <button type="button" className="btn-secondary btn-sm text-orange-700" disabled={act.isPending || !remarks.trim()} title={remarks.trim() ? undefined : 'Write the remarks first'} onClick={() => go('return', 'Return this document to the SK for correction?')}><RotateCcw size={13} /> Return for correction</button>}
        {st === 'verified' && <button type="button" className="btn-primary btn-sm" disabled={act.isPending} onClick={() => go('publish', 'Publish this document on the public FPDPB? Anyone will be able to see it.')}><Globe2 size={13} /> Approve and publish</button>}
        {st === 'published' && <button type="button" className="btn-secondary btn-sm" disabled={act.isPending} onClick={() => go('unpublish', 'Remove this document from the public FPDPB?')}>Unpublish</button>}
      </div>
    </div>
  )
}
