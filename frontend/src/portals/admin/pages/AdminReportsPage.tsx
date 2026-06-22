import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  FileText, BarChart2, MapPin, Tag, Download, ChevronDown,
  TrendingUp, Users, Building2, Layers, AlertCircle,
} from 'lucide-react'
import apiClient from '@/api/client'
import { PageSpinner } from '@/components/ui/Spinner'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReportSummary {
  total_submissions: number
  approved: number
  completed: number
  pending: number
  total_male_participants: number
  total_female_participants: number
  total_lgbtq_participants: number
  total_prefer_not_say_participants: number
  total_participants: number
  total_budget: number
  barangays_reached: number
}

interface BreakdownItem {
  category?: string
  barangay?: string
  submitter_type?: string
  label?: string
  count: number
}

interface Report {
  period_label: string
  period: string
  year: number
  filters: { barangay: string; category: string }
  summary: ReportSummary
  by_category: BreakdownItem[]
  by_barangay: BreakdownItem[]
  by_submitter_type: BreakdownItem[]
  narrative: string
}

const CATEGORIES = [
  { value: '', label: 'All Categories' },
  { value: 'livelihood', label: 'Livelihood' },
  { value: 'education', label: 'Education' },
  { value: 'health', label: 'Health' },
  { value: 'environment', label: 'Environment' },
  { value: 'sports', label: 'Sports & Recreation' },
  { value: 'arts', label: 'Arts & Culture' },
  { value: 'governance', label: 'Governance' },
  { value: 'other', label: 'Other' },
]

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const CURRENT_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i)

// ─── Bar row ─────────────────────────────────────────────────────────────────

function BarRow({ label, count, max }: { label: string; count: number; max: number }) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0
  return (
    <div className="grid grid-cols-[1fr_120px_40px] items-center gap-3 text-sm">
      <span className="text-gray-700 truncate" title={label}>{label}</span>
      <div className="h-4 bg-gray-100 rounded overflow-hidden">
        <div
          className="h-full bg-primary/70 rounded transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-right text-gray-500 font-medium tabular-nums">{count}</span>
    </div>
  )
}

// ─── Stat card ───────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, accent,
}: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div className="card p-4 text-center">
      <p className={`text-3xl font-bold ${accent ?? 'text-gray-800'}`}>{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
      {sub && <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AdminReportsPage() {
  const [period, setPeriod] = useState<'monthly' | 'quarterly' | 'annual'>('monthly')
  const [year, setYear] = useState(CURRENT_YEAR)
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [quarter, setQuarter] = useState(Math.ceil((new Date().getMonth() + 1) / 3))
  const [barangay, setBarangay] = useState('')
  const [category, setCategory] = useState('')
  const [enabled, setEnabled] = useState(false)

  const params: Record<string, string | number> = { period, year }
  if (period === 'monthly') params.month = month
  if (period === 'quarterly') params.quarter = quarter
  if (barangay) params.barangay = barangay
  if (category) params.category = category

  const { data: report, isLoading, isError } = useQuery<Report>({
    queryKey: ['admin-report', params],
    queryFn: () => apiClient.get('/programs/submissions/report/', { params }).then(r => r.data),
    enabled,
  })

  const handleGenerate = () => setEnabled(true)

  const handlePrint = () => window.print()

  const handleReportCSV = () => {
    if (!report) return
    const sections: string[][] = []

    sections.push(['Report Period', report.period_label])
    if (report.filters.barangay) sections.push(['Filter: Barangay', report.filters.barangay])
    if (report.filters.category) sections.push(['Filter: Category', report.filters.category])
    sections.push([])

    sections.push(['Summary'])
    sections.push(['Total Submissions', String(report.summary.total_submissions)])
    sections.push(['Approved / Active', String(report.summary.approved)])
    sections.push(['Completed', String(report.summary.completed)])
    sections.push(['Pending', String(report.summary.pending)])
    sections.push(['Total Participants', String(report.summary.total_participants)])
    sections.push(['Male Participants', String(report.summary.total_male_participants)])
    sections.push(['Female Participants', String(report.summary.total_female_participants)])
    sections.push(['LGBTQ+ Participants', String(report.summary.total_lgbtq_participants ?? 0)])
    sections.push(['Prefer Not to Say', String(report.summary.total_prefer_not_say_participants ?? 0)])
    sections.push(['Barangays Reached', String(report.summary.barangays_reached)])
    if (report.summary.total_budget > 0) {
      sections.push(['Total Budget', String(report.summary.total_budget)])
    }
    sections.push([])

    if (report.by_category.length > 0) {
      sections.push(['By Category', 'Count'])
      report.by_category.forEach(item => {
        sections.push([item.label ?? item.category ?? '—', String(item.count)])
      })
      sections.push([])
    }

    if (report.by_barangay.length > 0) {
      sections.push(['By Barangay', 'Count'])
      report.by_barangay.forEach(item => {
        sections.push([item.barangay ?? '—', String(item.count)])
      })
      sections.push([])
    }

    if (report.by_submitter_type.length > 0) {
      sections.push(['By Submitter Type', 'Count'])
      report.by_submitter_type.forEach(item => {
        sections.push([item.submitter_type ?? '—', String(item.count)])
      })
    }

    const csv = sections.map(r => r.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `report-${report.period_label.replace(/\s+/g, '-').toLowerCase()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6 print:space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 print:hidden">
        <div>
          <h1 className="page-title">Accomplishment Reports</h1>
          <p className="page-subtitle">Generate descriptive summaries of program submissions by period.</p>
        </div>
        {report && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={handleReportCSV} className="btn-secondary btn-sm flex items-center gap-1.5">
              <Download size={14} /> Download CSV
            </button>
            <button onClick={handlePrint} className="btn-secondary btn-sm flex items-center gap-1.5">
              <Download size={14} /> Print / Export
            </button>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="card p-5 space-y-4 print:hidden">
        <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <ChevronDown size={14} className="text-primary" /> Report Parameters
        </h2>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Period */}
          <div>
            <label className="label">Report Period</label>
            <select
              className="input"
              value={period}
              onChange={e => { setPeriod(e.target.value as any); setEnabled(false) }}
            >
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="annual">Annual</option>
            </select>
          </div>

          {/* Year */}
          <div>
            <label className="label">Year</label>
            <select
              className="input"
              value={year}
              onChange={e => { setYear(+e.target.value); setEnabled(false) }}
            >
              {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          {/* Month (monthly only) */}
          {period === 'monthly' && (
            <div>
              <label className="label">Month</label>
              <select
                className="input"
                value={month}
                onChange={e => { setMonth(+e.target.value); setEnabled(false) }}
              >
                {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
              </select>
            </div>
          )}

          {/* Quarter */}
          {period === 'quarterly' && (
            <div>
              <label className="label">Quarter</label>
              <select
                className="input"
                value={quarter}
                onChange={e => { setQuarter(+e.target.value); setEnabled(false) }}
              >
                <option value={1}>Q1 (Jan–Mar)</option>
                <option value={2}>Q2 (Apr–Jun)</option>
                <option value={3}>Q3 (Jul–Sep)</option>
                <option value={4}>Q4 (Oct–Dec)</option>
              </select>
            </div>
          )}

          {/* Barangay filter */}
          <div>
            <label className="label">Barangay (optional)</label>
            <input
              className="input"
              value={barangay}
              onChange={e => { setBarangay(e.target.value); setEnabled(false) }}
              placeholder="e.g., Barangay 1"
            />
          </div>

          {/* Category filter */}
          <div>
            <label className="label">Category (optional)</label>
            <select
              className="input"
              value={category}
              onChange={e => { setCategory(e.target.value); setEnabled(false) }}
            >
              {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
        </div>

        <div className="flex justify-end">
          <button onClick={handleGenerate} className="btn-primary">
            <FileText size={15} /> Generate Report
          </button>
        </div>
      </div>

      {/* Results */}
      {isLoading && <PageSpinner />}

      {isError && (
        <div className="card p-6 flex items-center gap-3 text-red-600 border-red-200">
          <AlertCircle size={18} />
          <p className="text-sm">Failed to generate report. Please try again.</p>
        </div>
      )}

      {report && !isLoading && (
        <div className="space-y-5 print:space-y-4" id="report-output">
          {/* Period label */}
          <div className="flex items-center gap-3 print:mb-2">
            <h2 className="text-xl font-bold text-gray-800">{report.period_label}</h2>
            {report.filters.barangay && (
              <span className="chip-primary text-xs flex items-center gap-1">
                <MapPin size={10} /> {report.filters.barangay}
              </span>
            )}
            {report.filters.category && (
              <span className="chip-primary text-xs flex items-center gap-1">
                <Tag size={10} /> {report.filters.category}
              </span>
            )}
          </div>

          {/* Summary stats */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <StatCard
              label="Total Submissions"
              value={report.summary.total_submissions}
              accent="text-gray-800"
            />
            <StatCard
              label="Approved / Active"
              value={report.summary.approved}
              accent="text-primary"
            />
            <StatCard
              label="Completed"
              value={report.summary.completed}
              accent="text-green-600"
            />
            <StatCard
              label="Participants Served"
              value={report.summary.total_participants.toLocaleString()}
              sub={report.summary.total_participants > 0
                ? `${report.summary.total_male_participants}M / ${report.summary.total_female_participants}F / ${report.summary.total_lgbtq_participants ?? 0} LGBTQ+ / ${report.summary.total_prefer_not_say_participants ?? 0} PNS`
                : undefined}
              accent="text-blue-600"
            />
            <StatCard
              label="Barangays Reached"
              value={report.summary.barangays_reached}
              accent="text-purple-600"
            />
          </div>

          {/* Budget */}
          {report.summary.total_budget > 0 && (
            <div className="card p-4 flex items-center gap-3">
              <TrendingUp size={20} className="text-green-500 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-500">Total Estimated Budget</p>
                <p className="text-xl font-bold text-gray-800">
                  ₱{report.summary.total_budget.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          )}

          {/* Narrative */}
          <div className="card p-5 bg-primary/3 border-l-4 border-primary/40">
            <div className="flex items-center gap-2 mb-2">
              <FileText size={16} className="text-primary" />
              <h3 className="text-sm font-semibold text-gray-700">Auto-Generated Summary</h3>
            </div>
            <p className="text-sm text-gray-700 leading-relaxed">{report.narrative}</p>
          </div>

          {/* Breakdowns */}
          <div className="grid md:grid-cols-2 gap-5">
            {/* By category */}
            {report.by_category.length > 0 && (
              <div className="card p-5 space-y-3">
                <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Layers size={14} className="text-primary" /> By Category
                </h3>
                <div className="space-y-2">
                  {report.by_category.map((item, i) => (
                    <BarRow
                      key={i}
                      label={item.label ?? item.category ?? '—'}
                      count={item.count}
                      max={Math.max(...report.by_category.map(b => b.count))}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* By barangay */}
            {report.by_barangay.length > 0 && (
              <div className="card p-5 space-y-3">
                <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Building2 size={14} className="text-primary" /> By Barangay (Top 10)
                </h3>
                <div className="space-y-2">
                  {report.by_barangay.map((item, i) => (
                    <BarRow
                      key={i}
                      label={item.barangay ?? '—'}
                      count={item.count}
                      max={Math.max(...report.by_barangay.map(b => b.count))}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* By submitter type */}
            {report.by_submitter_type.length > 0 && (
              <div className="card p-5 space-y-3 md:col-span-2 lg:col-span-1">
                <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Users size={14} className="text-primary" /> By Submitter Type
                </h3>
                <div className="space-y-2">
                  {report.by_submitter_type.map((item, i) => (
                    <BarRow
                      key={i}
                      label={item.submitter_type ?? '—'}
                      count={item.count}
                      max={Math.max(...report.by_submitter_type.map(b => b.count))}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Pending note */}
          {report.summary.pending > 0 && (
            <div className="card p-4 border-amber-200 bg-amber-50 flex items-center gap-3 text-amber-700">
              <AlertCircle size={16} className="flex-shrink-0" />
              <p className="text-sm">
                <strong>{report.summary.pending}</strong> submission{report.summary.pending !== 1 ? 's are' : ' is'} still pending admin review.
              </p>
            </div>
          )}

          {/* Empty state */}
          {report.summary.total_submissions === 0 && (
            <div className="card p-10 text-center">
              <BarChart2 size={40} className="text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">No submissions found for this period.</p>
              <p className="text-gray-400 text-xs mt-1">Try adjusting the filters or selecting a different period.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
