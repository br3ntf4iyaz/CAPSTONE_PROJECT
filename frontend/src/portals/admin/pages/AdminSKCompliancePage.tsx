import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, ChevronRight, Clock, Download, FileCheck2, FileText, Globe2, History, Info, Landmark, MousePointerClick, RotateCcw, Search, ShieldCheck, X } from 'lucide-react'
import toast from 'react-hot-toast'
import apiClient from '@/api/client'
import { cn } from '@/utils'
import { PageSpinner } from '@/components/ui/Spinner'
import { openPrivateFile } from '@/components/ui/SecureImage'
import { complianceTile, compliancePercent } from '@/components/ui/ComplianceBadge'
import { MONTHS, STATUS_META, StatusChip, StatusLegend, fmtDate, type ComplianceStatus } from '@/components/ComplianceStatus'
import { CompletionRing, KpiCard, SEGMENT_TINT, groupTone, type Tone } from '@/components/ComplianceKit'
import { apiMessage, downloadWithLogin } from '@/portals/youth/lms'
import AdminSKTrackerPage from './AdminSKTrackerPage'
import AdminDisclosurePage from './AdminDisclosurePage'

interface Period { label: string; quarter: number | null; month: number | null; deadline: string | null; status: ComplianceStatus; late: boolean; workflow: string | null; record_id: number | null }
interface Cell { periods: Period[]; kind: 'single' | 'quarterly' | 'monthly'; completed: number; overdue: number; total: number }
interface Row { barangay_id: number; barangay: string; cells: Record<string, Cell>; totals: { total: number; completed: number; overdue: number } }
interface Overview {
  year: number; years: number[]; percent: number; rows: Row[]
  summary: { total: number; completed: number; pending: number; overdue: number; for_verification: number; returned: number; verified: number; published: number }
  categories: { key: string; short: string; label: string; kind: string; description: string }[]
  barangays: { id: number; name: string }[]; statuses: { key: string; label: string }[]
}
interface Rec {
  id: number; status: ComplianceStatus; title: string; description: string; year: number; period_end_year: number | null; submitted_at: string | null
  submitted_by: string; reviewed_at: string | null; reviewed_by: string; review_remarks: string; is_none_declaration: boolean; has_file: boolean
  filename: string; via_existing_requirement: boolean; total_amount: string | null; published_at: string | null
}
interface Slot { label: string; deadline: string | null; status: ComplianceStatus; late: boolean; current: Rec | null; history: Rec[] }
interface Detail { barangay: { id: number; name: string }; category: string; year: number; label: string; description: string; slots: Slot[] }
interface QueueRow extends Rec { barangay: string; barangay_id: number; category: string; category_short: string; period: string; waiting_days: number }

/** A soft status pill: tinted background, strong coloured text, readable on white. */
const PILL: Record<ComplianceStatus, string> = {
  not_submitted: 'bg-amber-50 text-amber-800 border-amber-200',
  submitted: 'bg-sky-50 text-sky-800 border-sky-200',
  under_verification: 'bg-violet-50 text-violet-800 border-violet-200',
  returned: 'bg-orange-50 text-orange-800 border-orange-200',
  verified: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  published: 'bg-primary-600 text-white border-primary-700',
  overdue: 'bg-red-100 text-red-800 border-red-200',
}
function TileChip({ status }: { status: ComplianceStatus }) {
  const m = STATUS_META[status]
  return <span className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-bold', PILL[status])}><m.icon size={12} /> {m.label}</span>
}

export default function AdminSKCompliancePage() {
  const [search, setSearch] = useSearchParams()
  const tab = (['monitor', 'queue', 'other', 'office'].includes(search.get('tab') ?? '') ? search.get('tab') : 'monitor') as 'monitor' | 'queue' | 'other' | 'office'
  const setTab = (t: 'monitor' | 'queue' | 'other' | 'office') => setSearch(t === 'monitor' ? {} : { tab: t }, { replace: true })
  const [f, setF] = useState({ year: '', barangay: '', category: '', quarter: '', month: '', status: '', publication: '' })
  const [open, setOpen] = useState<{ barangay_id: number; barangay: string; category: string; year: number } | null>(null)
  const [sort, setSort] = useState<'name' | 'behind' | 'best'>('name')
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
  const kpis: { label: string; value: number; icon: React.ReactNode; tone: Tone; hint?: string }[] = [
    { label: 'Total required', value: s.total, icon: <FileText size={16} />, tone: 'ink' },
    { label: 'Completed', value: s.completed, icon: <CheckCircle2 size={16} />, tone: 'green' },
    { label: 'Pending', value: s.pending, icon: <Clock size={16} />, tone: 'yellow' },
    { label: 'Overdue', value: s.overdue, icon: <AlertTriangle size={16} />, tone: 'red' },
    { label: 'Submitted for verification', value: s.for_verification, icon: <FileCheck2 size={16} />, tone: 'sky' },
    { label: 'Returned for correction', value: s.returned, icon: <RotateCcw size={16} />, tone: 'orange' },
    { label: 'Verified', value: s.verified, icon: <ShieldCheck size={16} />, tone: 'green', hint: 'ready to publish' },
    { label: 'Published', value: s.published, icon: <Globe2 size={16} />, tone: 'blue', hint: 'on the public FPDPB' },
  ]
  const tabs = [['monitor', 'Monitoring (5 documents)'], ['queue', `Verification queue${waiting ? ` (${waiting})` : ''}`], ['other', 'Other requirements'], ['office', 'LYDO office documents']] as const

  return (
    <div className="space-y-6">
      {/* Banner */}
      <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary-700 to-primary-900 text-white shadow-lg">
        <div className="ph-stripe h-1.5 w-full" />
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        <div aria-hidden className="pointer-events-none absolute -bottom-20 -right-16 h-64 w-64 rounded-full bg-accent-400/20 blur-2xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-6 p-6 sm:p-8">
          <div className="min-w-0 max-w-3xl">
            <p className="eyebrow-on-dark mb-2 flex items-center gap-1.5"><Landmark size={13} /> LYDO · City of Lucena</p>
            <h1 className="font-display text-2xl font-extrabold leading-tight tracking-tightish sm:text-3xl">SK Compliance Monitoring System</h1>
            <p className="mt-2 text-sm leading-relaxed text-primary-100">
              Monitor the CBYDP, ABYIP, SK Approved Annual Budget, quarterly RCB and monthly MIL of every barangay. Verified documents are published on the
              FPDPB (Full Public Disclosure Policy Board).
            </p>
            <Link to="/fpdpb" target="_blank" className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-primary-800 shadow-sm transition hover:bg-primary-50">
              <Globe2 size={15} /> Open FPDPB (public)
            </Link>
          </div>
          <div className="flex items-center gap-4 rounded-2xl bg-white/10 p-4 backdrop-blur-sm">
            <CompletionRing percent={o.percent} />
            <div>
              <p className="font-display text-base font-bold">Compliance</p>
              <p className="text-xs text-primary-100">{s.completed} of {s.total} documents</p>
              <p className="mt-1 text-[11px] text-primary-200">{o.year}{o.rows.length ? ` · ${o.rows.length} barangay${o.rows.length === 1 ? '' : 's'}` : ''}</p>
            </div>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="inline-flex max-w-full gap-1 overflow-x-auto rounded-2xl border border-primary-100 bg-white p-1 shadow-sm" role="tablist">
        {tabs.map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={cn('inline-flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold transition-colors',
              tab === k ? 'bg-primary-600 text-white shadow' : 'text-ink-600 hover:bg-primary-50 hover:text-primary-700')}>
            {label}
            {k === 'queue' && waiting > 0 && tab !== 'queue' && <span className="h-2 w-2 rounded-full bg-accent-400" aria-hidden />}
          </button>
        ))}
      </div>

      {tab === 'monitor' ? (
        <>
          <section aria-label="Filters" className="grid grid-cols-2 gap-3 rounded-2xl border border-primary-100 bg-primary-50/50 p-4 md:grid-cols-4 xl:grid-cols-7">
            <Sel label="Year" value={f.year || String(o.year)} onChange={v => set('year', v)}>{o.years.map(y => <option key={y} value={y}>{y}</option>)}</Sel>
            <Sel label="Barangay" value={f.barangay} onChange={v => set('barangay', v)}><option value="">All barangays</option>{o.barangays.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</Sel>
            <Sel label="Document" value={f.category} onChange={v => set('category', v)}><option value="">All documents</option>{o.categories.map(c => <option key={c.key} value={c.key}>{c.short}</option>)}</Sel>
            <Sel label="Quarter" value={f.quarter} onChange={v => set('quarter', v)}><option value="">Any quarter</option>{[1, 2, 3, 4].map(n => <option key={n} value={n}>Q{n}</option>)}</Sel>
            <Sel label="Month" value={f.month} onChange={v => set('month', v)}><option value="">Any month</option>{MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</Sel>
            <Sel label="Status" value={f.status} onChange={v => set('status', v)}><option value="">Any status</option>{o.statuses.map(st => <option key={st.key} value={st.key}>{st.label}</option>)}</Sel>
            <Sel label="Publication" value={f.publication} onChange={v => set('publication', v)}><option value="">Published or not</option><option value="published">Published</option><option value="unpublished">Not published</option></Sel>
          </section>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {kpis.map(c => <KpiCard key={c.label} {...c} />)}
          </div>

          <div className="rounded-2xl border border-ink-100 bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-center justify-between text-xs font-semibold text-ink-600"><span>Compliance for the selected filters</span><span className="text-primary-700">{o.percent}%</span></div>
            <div className="h-2.5 overflow-hidden rounded-full bg-ink-100"><div className="h-full rounded-full bg-gradient-to-r from-primary-600 to-emerald-500 transition-all duration-700" style={{ width: `${o.percent}%` }} /></div>
            <div className="mt-3"><StatusLegend /></div>
          </div>

          <details className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary-700 to-primary-900 text-sm text-white shadow-lg">
            <div className="ph-stripe h-1 w-full" />
            <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
            <div aria-hidden className="pointer-events-none absolute -bottom-16 -right-12 h-48 w-48 rounded-full bg-accent-400/20 blur-2xl" />
            <summary className="relative flex cursor-pointer list-none items-center gap-2 px-5 py-4 font-display text-base font-bold">
              <Info size={18} className="text-accent-300" /> What do CBYDP, ABYIP, RCB and MIL mean?
              <ChevronRight size={16} className="ml-auto text-primary-200 transition-transform group-open:rotate-90" />
            </summary>
            <dl className="relative grid gap-3 px-5 pb-5 md:grid-cols-2">
              {o.categories.map(c => (
                <div key={c.key} className="rounded-2xl border border-white/15 border-l-4 border-l-accent-400 bg-white/10 p-3.5 backdrop-blur-sm">
                  <dt className="font-bold text-white">{c.short} <span className="font-medium text-primary-100">&middot; {c.label}</span></dt>
                  <dd className="mt-1 text-xs leading-relaxed text-primary-50">{c.description}</dd>
                </div>
              ))}
            </dl>
          </details>
          <p className="-mt-2 flex items-center gap-1.5 text-xs text-ink-500"><MousePointerClick size={13} /> Click any cell to open that barangay's document, review it, and see its history.</p>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-bold text-ink-800">{o.rows.length} barangay{o.rows.length === 1 ? '' : 's'} <span className="ml-2 text-xs font-medium text-ink-500">Small bars show each quarter or month</span></p>
            <label className="flex items-center gap-2 text-xs font-semibold text-ink-600">
              Sort by
              <select value={sort} onChange={e => setSort(e.target.value as typeof sort)} className="input w-auto py-1 text-xs">
                <option value="name">Barangay name</option>
                <option value="behind">Most behind first</option>
                <option value="best">Best compliance first</option>
              </select>
            </label>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-primary-100 bg-white shadow-sm">
            <table className="w-full min-w-[1080px] border-separate border-spacing-x-2 border-spacing-y-2 px-2 text-sm">
              <thead>
                <tr className="text-left text-xs font-extrabold uppercase tracking-wide">
                  <th className="sticky left-0 z-10 rounded-xl bg-primary-50 px-4 py-3 text-primary-900">Barangay</th>
                  {o.categories.map(c => (
                    <th key={c.key} className="rounded-xl bg-primary-50 px-3 py-3 align-bottom text-primary-900" title={`${c.label}: ${c.description}`}>
                      <span className="block">{c.short}</span>
                      <span className="mt-0.5 block max-w-[150px] text-[10px] font-semibold normal-case leading-tight tracking-normal text-primary-700">{c.label.replace(/ \([A-Z]+\)$/, '')}</span>
                    </th>
                  ))}
                  <th className="rounded-xl bg-primary-50 px-4 py-3 text-right text-primary-900">Compliance</th>
                </tr>
              </thead>
              <tbody>
                {o.rows.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-ink-500">No records match these filters.</td></tr>}
                {[...o.rows].sort((x, y) => {
                  const px = x.totals.total ? x.totals.completed / x.totals.total : 0
                  const py = y.totals.total ? y.totals.completed / y.totals.total : 0
                  if (sort === 'behind') return px - py || y.totals.overdue - x.totals.overdue
                  if (sort === 'best') return py - px
                  return x.barangay.localeCompare(y.barangay, undefined, { numeric: true })
                }).map(r => {
                  const pct = compliancePercent(r.totals.completed, r.totals.total)
                  const tile = complianceTile(pct)
                  return (
                    <tr key={r.barangay_id}>
                      <td className="sticky left-0 z-10 rounded-xl bg-white px-4 py-2.5 shadow-[6px_0_8px_-8px_rgba(15,23,42,0.25)]">
                        <span className="flex items-center gap-2.5 whitespace-nowrap font-extrabold text-ink-900">
                          <span className={cn('inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl', tile.bg)} title={`${pct}% compliant`}>
                            <tile.Icon size={15} className={tile.icon} />
                          </span>
                          <span>
                            {r.barangay}
                            {r.totals.overdue > 0 && <span className="block text-[11px] font-bold text-red-600">{r.totals.overdue} overdue</span>}
                          </span>
                        </span>
                      </td>
                      {o.categories.map(c => {
                        const cell = r.cells[c.key]
                        if (!cell || cell.total === 0) return <td key={c.key} className="min-w-[150px] p-0"><span className="block rounded-xl bg-ink-100 px-3 py-3 text-xs font-semibold text-ink-400">&mdash;</span></td>
                        const tone: ComplianceStatus = cell.kind === 'single' ? cell.periods[0].status : groupTone(cell.completed, cell.overdue, cell.total)
                        return (
                          <td key={c.key} className="min-w-[150px] p-0 align-middle">
                            <button type="button" title={`Open ${r.barangay} · ${c.short}`} aria-label={`${r.barangay} ${c.short}`}
                              onClick={() => setOpen({ barangay_id: r.barangay_id, barangay: r.barangay, category: c.key, year: o.year })}
                              className={cn('group flex h-full w-full items-center justify-between gap-2 rounded-xl border border-l-4 px-3 py-2.5 text-left text-ink-900 transition hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500', SEGMENT_TINT[tone])}>
                              <span className="min-w-0 flex-1">
                                {cell.kind === 'single' ? <TileChip status={cell.periods[0].status} /> : (
                                  <>
                                    <span className="flex items-baseline gap-1.5 whitespace-nowrap text-xs">
                                      <span className="text-sm font-bold text-ink-900">{cell.completed}/{cell.total}</span>
                                      {cell.overdue > 0 && <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">{cell.overdue} overdue</span>}
                                    </span>
                                    <span className="mt-1.5 grid gap-0.5" style={{ gridTemplateColumns: `repeat(${cell.periods.length}, minmax(0, 1fr))` }}>
                                      {cell.periods.map((p, i) => <span key={i} title={`${p.label}: ${STATUS_META[p.status].label}`} className={cn('h-1.5 rounded-full', STATUS_META[p.status].dot)} />)}
                                    </span>
                                  </>
                                )}
                              </span>
                              <ChevronRight size={14} className="shrink-0 text-ink-300 transition group-hover:translate-x-0.5 group-hover:text-primary-600" />
                            </button>
                          </td>
                        )
                      })}
                      <td className="rounded-xl px-4 py-2 text-right">
                        <span className={cn('text-base font-extrabold tabular-nums', tile.text)}>{pct}%</span>
                        <span className="ml-auto mt-1 block text-[11px] font-semibold tabular-nums text-ink-600">{r.totals.completed}/{r.totals.total} done</span>
                        <span className="ml-auto mt-1 block h-1.5 w-24 overflow-hidden rounded-full bg-ink-100"><span className={cn('block h-full rounded-full transition-all', tile.bar)} style={{ width: `${pct}%` }} /></span>
                      </td>
                    </tr>
                  )
                })}
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
  return <label className="text-xs font-bold uppercase tracking-wide text-primary-800">{label}<select className="input mt-1 bg-white py-2 text-sm font-normal normal-case tracking-normal text-ink-900" value={value} onChange={e => onChange(e.target.value)}>{children}</select></label>
}

interface AwaitingDoc { id: number; barangay: string; label: string; submitted_at: string | null; sk_remarks: string; filename: string }

/** The documents SK councils submitted (Annex H, Policies, Minutes, KK Assembly, Linggo ng Kabataan): LYDO opens each one, then approves it or returns it with remarks. */
function OtherDocsQueue() {
  const qc = useQueryClient()
  const [returning, setReturning] = useState<number | null>(null)
  const [remarks, setRemarks] = useState('')
  const q = useQuery({ queryKey: ['sk-other-awaiting'], queryFn: () => apiClient.get('/sk-requirements/requirements/awaiting/').then(r => r.data as AwaitingDoc[]) })
  const decide = useMutation({
    mutationFn: (v: { id: number; decision: 'approve' | 'return'; remarks?: string }) => apiClient.post(`/sk-requirements/requirements/${v.id}/review/`, { decision: v.decision, remarks: v.remarks ?? '' }),
    onSuccess: (_r, v) => {
      toast.success(v.decision === 'approve' ? 'Verified. The SK was notified.' : 'Returned. The SK was notified.')
      setReturning(null); setRemarks('')
      qc.invalidateQueries({ queryKey: ['sk-other-awaiting'] })
      qc.invalidateQueries({ queryKey: ['sk-barangays-directory'] })
    },
    onError: (e: any) => toast.error(String(e?.response?.data?.detail ?? 'Could not save.')),
  })
  const rows = q.data ?? []
  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
      <h2 className="border-b border-gray-100 bg-gray-50 px-5 py-3 text-sm font-semibold text-gray-900">Other documents waiting for review ({rows.length})</h2>
      {rows.length === 0 ? <p className="px-5 py-6 text-sm text-gray-500">No other SK document is waiting for review.</p> : (
        <ul className="divide-y divide-gray-100">
          {rows.map(r => (
            <li key={r.id} className="space-y-2 px-5 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{r.barangay}: {r.label}</p>
                  <p className="text-xs text-gray-500">Submitted {fmtDate(r.submitted_at)} · {r.filename}</p>
                  {r.sk_remarks && <p className="mt-1 text-xs text-gray-600"><strong>SK remarks:</strong> {r.sk_remarks}</p>}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" className="btn-secondary btn-sm" onClick={() => openPrivateFile(`/api/sk-requirements/requirements/${r.id}/file/`).catch(() => toast.error('Could not open the file'))}>Open file</button>
                  <button type="button" className="btn-primary btn-sm" disabled={decide.isPending} onClick={() => decide.mutate({ id: r.id, decision: 'approve' })}>Verify</button>
                  <button type="button" className="btn-secondary btn-sm text-amber-700" onClick={() => { setReturning(returning === r.id ? null : r.id); setRemarks('') }}>Return</button>
                </div>
              </div>
              {returning === r.id && (
                <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
                  <textarea className="input resize-none text-sm" rows={2} maxLength={1000} placeholder="What must the SK correct? They will read this." value={remarks} onChange={e => setRemarks(e.target.value)} />
                  <button type="button" disabled={remarks.trim().length < 5 || decide.isPending} onClick={() => decide.mutate({ id: r.id, decision: 'return', remarks })} className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40">Return to the SK</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
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
  return <div className="space-y-5"><OtherDocsQueue /><Block title="Waiting for verification" rows={data.to_verify} empty="Nothing is waiting for verification." />
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
          <div><h2 className="text-lg font-bold text-gray-900">{barangay}</h2><p className="text-sm font-medium text-gray-700">{q.data?.label ?? ''} · {year}</p>
            {q.data?.description && <p className="mt-1 max-w-xl text-xs leading-relaxed text-gray-500">{q.data.description}</p>}</div>
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
