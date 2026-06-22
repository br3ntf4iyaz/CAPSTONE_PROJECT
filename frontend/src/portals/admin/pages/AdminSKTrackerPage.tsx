import { useState, useRef, useEffect } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Upload, Calendar, CheckCircle2, AlertCircle, ChevronDown, Download, MessageSquare } from 'lucide-react'
import toast from 'react-hot-toast'
import apiClient from '@/api/client'
import { skFeedbackApi, SKFeedbackItem } from '@/api/skFeedback'
import { PageSpinner } from '@/components/ui/Spinner'
import { cn } from '@/utils'

// ── Types ──────────────────────────────────────────────────────────────────────

type MEStatus = 'yes' | 'partial' | 'no'
type DocStatus = 'submitted' | 'partial' | 'not_submitted'
type AssemblyStatus = 'conducted' | 'not_conducted' | 'pending'

interface MERecord {
  id: number; barangay: string; barangay_display: string; year: number
  me1_ppa: MEStatus; me1_gap: MEStatus; me2_policies: MEStatus; updated_at: string
}
interface DocRecord {
  id: number; barangay: string; barangay_display: string; year: number
  minutes_status: DocStatus; minutes_count: number | null
  sk_directory_status: DocStatus; youth_org_list_status: DocStatus; updated_at: string
}
interface AssemblyRecord {
  id: number; barangay: string; barangay_display: string; year: number
  kk_1st_sem: AssemblyStatus; kk_2nd_sem: AssemblyStatus; lnk: AssemblyStatus; updated_at: string
}

// ── Status cycle helpers ────────────────────────────────────────────────────────

const ME_CYCLE: MEStatus[] = ['no', 'partial', 'yes']
const DOC_CYCLE: DocStatus[] = ['not_submitted', 'partial', 'submitted']
const ASSEMBLY_CYCLE: AssemblyStatus[] = ['pending', 'not_conducted', 'conducted']

function nextME(s: MEStatus): MEStatus { return ME_CYCLE[(ME_CYCLE.indexOf(s) + 1) % ME_CYCLE.length] }
function nextDoc(s: DocStatus): DocStatus { return DOC_CYCLE[(DOC_CYCLE.indexOf(s) + 1) % DOC_CYCLE.length] }
function nextAssembly(s: AssemblyStatus): AssemblyStatus { return ASSEMBLY_CYCLE[(ASSEMBLY_CYCLE.indexOf(s) + 1) % ASSEMBLY_CYCLE.length] }

// ── Cell renderers ──────────────────────────────────────────────────────────────

function MECell({ status, onClick, loading }: { status: MEStatus; onClick: () => void; loading?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={cn(
        'w-full h-10 rounded flex items-center justify-center text-lg font-bold transition-all',
        status === 'yes' && 'bg-green-500 hover:bg-green-600',
        status === 'partial' && 'bg-yellow-400 hover:bg-yellow-500',
        status === 'no' && 'bg-red-500 hover:bg-red-600',
        loading && 'opacity-50 cursor-not-allowed',
      )}
      title={`Click to change (current: ${status})`}
    >
      {status === 'yes' && <span className="text-white text-sm">✓</span>}
      {status === 'partial' && <span className="text-white text-xs font-bold">½</span>}
      {status === 'no' && <span className="text-white text-sm">✗</span>}
    </button>
  )
}

function DocCell({ status, count, onClick, loading, showCount }: {
  status: DocStatus; count?: number | null; onClick: () => void; loading?: boolean; showCount?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={cn(
        'w-full h-10 rounded flex items-center justify-center text-sm font-bold transition-all',
        status === 'submitted' && 'bg-green-500 hover:bg-green-600',
        status === 'partial' && 'bg-yellow-400 hover:bg-yellow-500',
        status === 'not_submitted' && 'bg-red-500 hover:bg-red-600',
        loading && 'opacity-50 cursor-not-allowed',
      )}
      title={`Click to change (current: ${status})`}
    >
      {status === 'submitted' && <span className="text-white">✓</span>}
      {status === 'partial' && <span className="text-white">{showCount && count != null ? count : '½'}</span>}
      {status === 'not_submitted' && <span className="text-white">✗</span>}
    </button>
  )
}

function AssemblyCell({ status, onClick, loading }: { status: AssemblyStatus; onClick: () => void; loading?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={cn(
        'w-full h-10 rounded flex items-center justify-center text-sm font-bold transition-all',
        status === 'conducted' && 'bg-blue-600 hover:bg-blue-700',
        status === 'not_conducted' && 'bg-red-500 hover:bg-red-600',
        status === 'pending' && 'bg-gray-100 hover:bg-gray-200 border border-gray-200',
        loading && 'opacity-50 cursor-not-allowed',
      )}
      title={`Click to change (current: ${status})`}
    >
      {status === 'conducted' && <span className="text-white">✓</span>}
      {status === 'not_conducted' && <span className="text-white">✗</span>}
      {status === 'pending' && <span className="text-gray-400 text-xs">—</span>}
    </button>
  )
}

// ── Tab: ME Portal ─────────────────────────────────────────────────────────────

function downloadCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const escape = (v: any) => `"${String(v).replace(/"/g, '""')}"`
  const csv = [headers, ...rows].map(r => r.map(escape).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

function MEPortalTab({ year }: { year: number }) {
  const qc = useQueryClient()

  const { data: records = [], isLoading } = useQuery<MERecord[]>({
    queryKey: ['sk-me', year],
    queryFn: () => apiClient.get(`/compliance/sk-me/?year=${year}`).then(r => {
      const d = r.data; return Array.isArray(d) ? d : (d.results ?? [])
    }),
  })

  const [saving, setSaving] = useState<number | null>(null)

  const exportCSV = () => {
    downloadCSV(
      `me-portal-${year}.csv`,
      ['Barangay', 'ME 1 – PPAs', 'ME 1 – GAP', 'ME 2 Policies'],
      records.map(r => [r.barangay_display, r.me1_ppa, r.me1_gap, r.me2_policies]),
    )
  }

  async function updateCell(record: MERecord, field: keyof Pick<MERecord, 'me1_ppa' | 'me1_gap' | 'me2_policies'>) {
    const newVal = nextME(record[field])
    setSaving(record.id)
    try {
      await apiClient.patch(`/compliance/sk-me/${record.id}/`, { [field]: newVal })
      await qc.invalidateQueries({ queryKey: ['sk-me', year] })
    } catch { toast.error('Failed to update') }
    finally { setSaving(null) }
  }

  if (isLoading) return <PageSpinner />

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-xs">
          <div className="w-4 h-4 rounded bg-green-500" /> <span>Encoded (Yes)</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <div className="w-4 h-4 rounded bg-yellow-400" /> <span>Partial</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <div className="w-4 h-4 rounded bg-red-500" /> <span>Not Encoded (No)</span>
        </div>
        <span className="text-xs text-ink-400 ml-2">Click any cell to cycle through statuses</span>
        <button onClick={exportCSV} className="ml-auto btn-secondary btn-sm text-xs flex items-center gap-1">
          <Download size={12} /> Export CSV
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-300 px-3 py-2 text-left font-bold w-40">BARANGAY</th>
              <th className="border border-gray-300 px-3 py-2 text-center font-bold">ME 1 – PPAs<br/><span className="font-normal text-xs">(Programs, Projects, Activities)</span></th>
              <th className="border border-gray-300 px-3 py-2 text-center font-bold">ME 1 – GAP<br/><span className="font-normal text-xs">(General Administration Program)</span></th>
              <th className="border border-gray-300 px-3 py-2 text-center font-bold">ME 2<br/><span className="font-normal text-xs">POLICIES</span></th>
            </tr>
          </thead>
          <tbody>
            {records.map(r => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="border border-gray-300 px-3 py-1 font-semibold text-xs">{r.barangay_display}</td>
                <td className="border border-gray-300 px-2 py-1 w-28">
                  <MECell status={r.me1_ppa} onClick={() => updateCell(r, 'me1_ppa')} loading={saving === r.id} />
                </td>
                <td className="border border-gray-300 px-2 py-1 w-28">
                  <MECell status={r.me1_gap} onClick={() => updateCell(r, 'me1_gap')} loading={saving === r.id} />
                </td>
                <td className="border border-gray-300 px-2 py-1 w-28">
                  <MECell status={r.me2_policies} onClick={() => updateCell(r, 'me2_policies')} loading={saving === r.id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Tab: Document Submissions ──────────────────────────────────────────────────

function DocumentSubmissionsTab({ year }: { year: number }) {
  const qc = useQueryClient()
  const [editingCount, setEditingCount] = useState<number | null>(null)
  const [countVal, setCountVal] = useState('')

  const { data: records = [], isLoading } = useQuery<DocRecord[]>({
    queryKey: ['sk-docs', year],
    queryFn: () => apiClient.get(`/compliance/sk-documents/?year=${year}`).then(r => {
      const d = r.data; return Array.isArray(d) ? d : (d.results ?? [])
    }),
  })

  const [saving, setSaving] = useState<number | null>(null)

  const exportCSV = () => {
    downloadCSV(
      `sk-documents-${year}.csv`,
      ['Barangay', 'Minutes Status', 'Minutes Count', 'SK Directory', 'Youth Org List'],
      records.map(r => [r.barangay_display, r.minutes_status, r.minutes_count ?? '', r.sk_directory_status, r.youth_org_list_status]),
    )
  }

  async function updateCell(record: DocRecord, field: keyof Pick<DocRecord, 'minutes_status' | 'sk_directory_status' | 'youth_org_list_status'>) {
    const newVal = nextDoc(record[field] as DocStatus)
    const extra: Partial<DocRecord> = {}
    if (field === 'minutes_status' && newVal === 'partial') {
      extra.minutes_count = record.minutes_count
    }
    setSaving(record.id)
    try {
      await apiClient.patch(`/compliance/sk-documents/${record.id}/`, { [field]: newVal, ...extra })
      await qc.invalidateQueries({ queryKey: ['sk-docs', year] })
    } catch { toast.error('Failed to update') }
    finally { setSaving(null) }
  }

  async function saveCount(record: DocRecord) {
    const count = parseInt(countVal)
    if (isNaN(count) || count < 0) { toast.error('Enter a valid number'); return }
    setSaving(record.id)
    try {
      await apiClient.patch(`/compliance/sk-documents/${record.id}/`, { minutes_count: count })
      await qc.invalidateQueries({ queryKey: ['sk-docs', year] })
      setEditingCount(null)
    } catch { toast.error('Failed to update') }
    finally { setSaving(null) }
  }

  if (isLoading) return <PageSpinner />

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-xs"><div className="w-4 h-4 rounded bg-green-500" /> <span>Submitted</span></div>
        <div className="flex items-center gap-2 text-xs"><div className="w-4 h-4 rounded bg-yellow-400" /> <span>Partially Submitted (click # to set count)</span></div>
        <div className="flex items-center gap-2 text-xs"><div className="w-4 h-4 rounded bg-red-500" /> <span>No Submission</span></div>
        <button onClick={exportCSV} className="ml-auto btn-secondary btn-sm text-xs flex items-center gap-1">
          <Download size={12} /> Export CSV
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-300 px-3 py-2 text-left font-bold w-40">BARANGAY</th>
              <th className="border border-gray-300 px-3 py-2 text-center font-bold">Minutes of Meetings</th>
              <th className="border border-gray-300 px-3 py-2 text-center font-bold">SK Directory</th>
              <th className="border border-gray-300 px-3 py-2 text-center font-bold">List of Youth Org</th>
            </tr>
          </thead>
          <tbody>
            {records.map(r => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="border border-gray-300 px-3 py-1 font-semibold text-xs">{r.barangay_display}</td>
                <td className="border border-gray-300 px-2 py-1 w-32">
                  {r.minutes_status === 'partial' && editingCount === r.id ? (
                    <div className="flex gap-1">
                      <input
                        type="number" min={0} className="input text-xs py-1 px-1 w-14"
                        value={countVal} onChange={e => setCountVal(e.target.value)}
                        autoFocus onKeyDown={e => { if (e.key === 'Enter') saveCount(r); if (e.key === 'Escape') setEditingCount(null) }}
                      />
                      <button onClick={() => saveCount(r)} className="text-xs bg-green-500 text-white rounded px-1.5">✓</button>
                      <button onClick={() => setEditingCount(null)} className="text-xs bg-gray-200 rounded px-1.5">✗</button>
                    </div>
                  ) : (
                    <div className="relative">
                      <DocCell
                        status={r.minutes_status} count={r.minutes_count}
                        onClick={() => updateCell(r, 'minutes_status')}
                        loading={saving === r.id} showCount
                      />
                      {r.minutes_status === 'partial' && (
                        <button
                          onClick={() => { setEditingCount(r.id); setCountVal(String(r.minutes_count ?? '')) }}
                          className="absolute inset-0 flex items-center justify-center text-white text-sm font-bold"
                          title="Click to set count"
                        >
                          {r.minutes_count != null ? r.minutes_count : '?'}
                        </button>
                      )}
                    </div>
                  )}
                </td>
                <td className="border border-gray-300 px-2 py-1 w-28">
                  <DocCell status={r.sk_directory_status} onClick={() => updateCell(r, 'sk_directory_status')} loading={saving === r.id} />
                </td>
                <td className="border border-gray-300 px-2 py-1 w-28">
                  <DocCell status={r.youth_org_list_status} onClick={() => updateCell(r, 'youth_org_list_status')} loading={saving === r.id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Tab: KK Assembly & LNK ─────────────────────────────────────────────────────

function AssemblyTab({ year }: { year: number }) {
  const qc = useQueryClient()

  const { data: records = [], isLoading } = useQuery<AssemblyRecord[]>({
    queryKey: ['sk-assembly', year],
    queryFn: () => apiClient.get(`/compliance/sk-assembly/?year=${year}`).then(r => {
      const d = r.data; return Array.isArray(d) ? d : (d.results ?? [])
    }),
  })

  const [saving, setSaving] = useState<number | null>(null)

  const exportCSV = () => {
    downloadCSV(
      `kk-assembly-${year}.csv`,
      ['Barangay', 'KK Assembly 1st Sem', 'KK Assembly 2nd Sem', 'LNK'],
      records.map(r => [r.barangay_display, r.kk_1st_sem, r.kk_2nd_sem, r.lnk]),
    )
  }

  async function updateCell(record: AssemblyRecord, field: keyof Pick<AssemblyRecord, 'kk_1st_sem' | 'kk_2nd_sem' | 'lnk'>) {
    const newVal = nextAssembly(record[field])
    setSaving(record.id)
    try {
      await apiClient.patch(`/compliance/sk-assembly/${record.id}/`, { [field]: newVal })
      await qc.invalidateQueries({ queryKey: ['sk-assembly', year] })
    } catch { toast.error('Failed to update') }
    finally { setSaving(null) }
  }

  if (isLoading) return <PageSpinner />

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-xs"><div className="w-4 h-4 rounded bg-blue-600" /> <span>Conducted</span></div>
        <div className="flex items-center gap-2 text-xs"><div className="w-4 h-4 rounded bg-red-500" /> <span>Not Conducted</span></div>
        <div className="flex items-center gap-2 text-xs"><div className="w-4 h-4 rounded bg-gray-100 border border-gray-300" /> <span>Pending</span></div>
        <span className="text-xs text-ink-400 ml-2">Click any cell to cycle through statuses</span>
        <button onClick={exportCSV} className="ml-auto btn-secondary btn-sm text-xs flex items-center gap-1">
          <Download size={12} /> Export CSV
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-300 px-3 py-2 text-left font-bold w-40">BARANGAY</th>
              <th className="border border-gray-300 px-3 py-2 text-center font-bold">KK Assembly<br/><span className="font-normal text-xs">1st Semester</span></th>
              <th className="border border-gray-300 px-3 py-2 text-center font-bold">KK Assembly<br/><span className="font-normal text-xs">2nd Semester</span></th>
              <th className="border border-gray-300 px-3 py-2 text-center font-bold">LNK<br/><span className="font-normal text-xs">(Linggo ng Kabataan) {year}</span></th>
            </tr>
          </thead>
          <tbody>
            {records.map(r => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="border border-gray-300 px-3 py-1 font-semibold text-xs">{r.barangay_display}</td>
                <td className="border border-gray-300 px-2 py-1 w-28">
                  <AssemblyCell status={r.kk_1st_sem} onClick={() => updateCell(r, 'kk_1st_sem')} loading={saving === r.id} />
                </td>
                <td className="border border-gray-300 px-2 py-1 w-28">
                  <AssemblyCell status={r.kk_2nd_sem} onClick={() => updateCell(r, 'kk_2nd_sem')} loading={saving === r.id} />
                </td>
                <td className="border border-gray-300 px-2 py-1 w-28">
                  <AssemblyCell status={r.lnk} onClick={() => updateCell(r, 'lnk')} loading={saving === r.id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Tab: DILG Requirements ─────────────────────────────────────────────────────

type ReqStatus = 'pending' | 'submitted' | 'overdue'

interface BarangayOption {
  id: number
  barangay_name: string
  sk_chairperson: string
  is_active: boolean
}

interface Requirement {
  id: number
  requirement_type: string
  requirement_display: string
  status: ReqStatus
  due_date: string | null
  submitted_at: string | null
  notes: string | null
  file: string | null
}

const REQUIREMENT_LABELS: Record<string, string> = {
  cbydp: 'Comprehensive Barangay Youth Development Plan (CBYDP)',
  abyip: 'Annual Barangay Youth Investment Program',
  annual_budget: 'Annual Budget Plan',
  quarterly_cash: 'Quarterly Cash-in-Bank and Other Financial Transactions',
  monthly_pr: 'Monthly Itemized List of Purchase Requests',
  annex_h: 'Annex H',
  policies: 'Policies (Resolutions and Ordinances)',
  policies_papa: 'Policies of Papa (Parent Policies)',
  policies_gap: 'Policies of Gap (Gap Policies)',
  minutes: 'Minutes of the Meeting',
  kk_assembly: 'Conduct of KK Assembly',
  linggo_kabataan: 'Conduct of Linggo ng Kabataan',
  coa_submissions: 'Commission on Audit (COA) Submissions',
}

function StatusBadge({ status }: { status: ReqStatus }) {
  if (status === 'submitted') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
        <CheckCircle2 size={11} /> Submitted
      </span>
    )
  }
  if (status === 'overdue') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
        <AlertCircle size={11} /> Overdue
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
      <ChevronDown size={11} /> Pending
    </span>
  )
}

function DILGRequirementsTab() {
  const qc = useQueryClient()
  const [selectedBarangayId, setSelectedBarangayId] = useState<number | null>(null)
  const [editingDueDateId, setEditingDueDateId] = useState<number | null>(null)
  const [dueDateVal, setDueDateVal] = useState('')
  const [markSubmitId, setMarkSubmitId] = useState<number | null>(null)
  const [submitNotes, setSubmitNotes] = useState('')
  const [submitFile, setSubmitFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Fetch barangay list
  const { data: barangays = [], isLoading: loadingBarangays } = useQuery<BarangayOption[]>({
    queryKey: ['dilg-barangays'],
    queryFn: () => apiClient.get('/sk-requirements/barangays/').then(r => {
      const d = r.data; return Array.isArray(d) ? d : (d.results ?? [])
    }),
  })

  // Auto-select first barangay once loaded (useEffect replaces v4 onSuccess)
  useEffect(() => {
    if (barangays.length > 0 && selectedBarangayId === null) {
      setSelectedBarangayId(barangays[0].id)
    }
  }, [barangays, selectedBarangayId])

  // Auto-select first barangay once loaded
  const effectiveBarangayId = selectedBarangayId ?? (barangays[0]?.id ?? null)

  // Fetch requirements for selected barangay
  const { data: requirements = [], isLoading: loadingReqs } = useQuery<Requirement[]>({
    queryKey: ['dilg-requirements', effectiveBarangayId],
    queryFn: () => apiClient.get(`/sk-requirements/requirements/?barangay=${effectiveBarangayId}`).then(r => {
      const d = r.data; return Array.isArray(d) ? d : (d.results ?? [])
    }),
    enabled: effectiveBarangayId !== null,
  })

  // Bulk create mutation
  const bulkCreate = useMutation({
    mutationFn: () => apiClient.post('/sk-requirements/requirements/bulk_create_for_barangay/', { barangay_id: effectiveBarangayId }),
    onSuccess: () => {
      toast.success('Requirements initialized successfully')
      qc.invalidateQueries({ queryKey: ['dilg-requirements', effectiveBarangayId] })
    },
    onError: () => toast.error('Failed to initialize requirements'),
  })

  // Set due date mutation
  const setDueDate = useMutation({
    mutationFn: ({ id, due_date }: { id: number; due_date: string }) =>
      apiClient.patch(`/sk-requirements/requirements/${id}/set_due_date/`, { due_date }),
    onSuccess: (_data, { id, due_date }) => {
      toast.success('Due date updated')
      qc.setQueryData(['dilg-requirements', effectiveBarangayId], (old: Requirement[] = []) =>
        old.map(r => r.id === id ? { ...r, due_date } : r)
      )
      setEditingDueDateId(null)
    },
    onError: () => toast.error('Failed to update due date'),
  })

  // Mark submitted mutation
  const markSubmitted = useMutation({
    mutationFn: ({ id, notes, file }: { id: number; notes: string; file: File | null }) => {
      const form = new FormData()
      if (notes) form.append('notes', notes)
      if (file) form.append('file', file)
      return apiClient.post(`/sk-requirements/requirements/${id}/mark_submitted/`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
    },
    onSuccess: (_data, { id }) => {
      toast.success('Marked as submitted')
      qc.setQueryData(['dilg-requirements', effectiveBarangayId], (old: Requirement[] = []) =>
        old.map(r => r.id === id ? { ...r, status: 'submitted' as ReqStatus } : r)
      )
      setMarkSubmitId(null)
      setSubmitNotes('')
      setSubmitFile(null)
    },
    onError: () => toast.error('Failed to mark as submitted'),
  })

  const submittedCount = requirements.filter(r => r.status === 'submitted').length
  const totalCount = requirements.length

  if (loadingBarangays) return <PageSpinner />

  return (
    <div className="space-y-5">
      {/* Barangay selector */}
      <div className="flex items-center gap-3 flex-wrap">
        <label className="text-sm font-medium text-ink-700">Barangay:</label>
        <select
          className="input text-sm py-1.5 px-3 min-w-[220px]"
          value={effectiveBarangayId ?? ''}
          onChange={e => {
            setSelectedBarangayId(Number(e.target.value))
            setMarkSubmitId(null)
            setEditingDueDateId(null)
          }}
        >
          {barangays.map(b => (
            <option key={b.id} value={b.id}>{b.barangay_name}</option>
          ))}
        </select>
        {requirements.length === 0 && !loadingReqs && effectiveBarangayId !== null && (
          <button
            onClick={() => bulkCreate.mutate()}
            disabled={bulkCreate.isPending}
            className="btn-primary btn-sm flex items-center gap-1.5"
          >
            <Upload size={13} />
            {bulkCreate.isPending ? 'Initializing…' : 'Initialize Requirements'}
          </button>
        )}
      </div>

      {/* Progress summary */}
      {requirements.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-ink-700">Submission Progress</span>
            <span className="text-sm font-semibold text-ink-900">{submittedCount} / {totalCount} submitted</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2.5">
            <div
              className="bg-green-500 h-2.5 rounded-full transition-all duration-300"
              style={{ width: totalCount > 0 ? `${(submittedCount / totalCount) * 100}%` : '0%' }}
            />
          </div>
        </div>
      )}

      {/* Requirements table */}
      {loadingReqs ? (
        <PageSpinner />
      ) : requirements.length === 0 ? (
        <div className="text-center py-12 text-ink-400 text-sm">
          No requirements found for this barangay. Click "Initialize Requirements" to create them.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 px-3 py-2 text-left font-bold">#</th>
                <th className="border border-gray-300 px-3 py-2 text-left font-bold">Requirement</th>
                <th className="border border-gray-300 px-3 py-2 text-center font-bold w-32">Status</th>
                <th className="border border-gray-300 px-3 py-2 text-center font-bold w-36">Due Date</th>
                <th className="border border-gray-300 px-3 py-2 text-center font-bold w-40">Action</th>
              </tr>
            </thead>
            <tbody>
              {requirements.map((req, idx) => (
                <tr
                  key={req.id}
                  className={cn(
                    'hover:bg-gray-50 transition-colors',
                    req.status === 'overdue' && 'border-l-4 border-l-red-500 bg-red-50/40',
                  )}
                >
                  <td className="border border-gray-300 px-3 py-2 text-ink-400 text-xs">{idx + 1}</td>
                  <td className="border border-gray-300 px-3 py-2">
                    <span className="font-medium text-ink-800 text-xs leading-snug">
                      {REQUIREMENT_LABELS[req.requirement_type] ?? req.requirement_display ?? req.requirement_type}
                    </span>
                  </td>
                  <td className="border border-gray-300 px-2 py-2 text-center">
                    <StatusBadge status={req.status} />
                  </td>

                  {/* Due date cell */}
                  <td className="border border-gray-300 px-2 py-2 text-center">
                    {editingDueDateId === req.id ? (
                      <div className="flex items-center gap-1 justify-center">
                        <input
                          type="date"
                          className="input text-xs py-0.5 px-1.5 w-32"
                          value={dueDateVal}
                          onChange={e => setDueDateVal(e.target.value)}
                          autoFocus
                          onKeyDown={e => {
                            if (e.key === 'Enter' && dueDateVal) setDueDate.mutate({ id: req.id, due_date: dueDateVal })
                            if (e.key === 'Escape') setEditingDueDateId(null)
                          }}
                        />
                        <button
                          onClick={() => dueDateVal && setDueDate.mutate({ id: req.id, due_date: dueDateVal })}
                          disabled={!dueDateVal || setDueDate.isPending}
                          className="text-xs bg-green-500 text-white rounded px-1.5 py-0.5 disabled:opacity-40"
                        >✓</button>
                        <button onClick={() => setEditingDueDateId(null)} className="text-xs bg-gray-200 rounded px-1.5 py-0.5">✗</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setEditingDueDateId(req.id); setDueDateVal(req.due_date ?? '') }}
                        className="inline-flex items-center gap-1 text-xs text-ink-500 hover:text-primary-600 transition-colors group"
                        title="Click to set due date"
                      >
                        <Calendar size={12} className="group-hover:text-primary-600" />
                        {req.due_date
                          ? new Date(req.due_date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
                          : <span className="text-ink-300 italic">Not set</span>
                        }
                      </button>
                    )}
                  </td>

                  {/* Mark submitted action */}
                  <td className="border border-gray-300 px-2 py-2">
                    {markSubmitId === req.id ? (
                      <div className="space-y-1.5">
                        <textarea
                          placeholder="Notes (optional)"
                          className="input text-xs py-1 px-1.5 w-full resize-none"
                          rows={2}
                          value={submitNotes}
                          onChange={e => setSubmitNotes(e.target.value)}
                        />
                        <div className="flex items-center gap-1">
                          <label className="flex-1 flex items-center gap-1 text-xs text-ink-500 cursor-pointer hover:text-primary-600">
                            <Upload size={11} />
                            {submitFile ? submitFile.name : 'Attach file'}
                            <input
                              ref={fileInputRef}
                              type="file"
                              className="hidden"
                              onChange={e => setSubmitFile(e.target.files?.[0] ?? null)}
                            />
                          </label>
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => markSubmitted.mutate({ id: req.id, notes: submitNotes, file: submitFile })}
                            disabled={markSubmitted.isPending}
                            className="flex-1 text-xs bg-green-500 hover:bg-green-600 text-white rounded py-0.5 disabled:opacity-40"
                          >
                            {markSubmitted.isPending ? 'Saving…' : 'Confirm'}
                          </button>
                          <button
                            onClick={() => { setMarkSubmitId(null); setSubmitNotes(''); setSubmitFile(null) }}
                            className="text-xs bg-gray-200 hover:bg-gray-300 rounded px-2 py-0.5"
                          >Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setMarkSubmitId(req.id); setSubmitNotes(''); setSubmitFile(null) }}
                        disabled={req.status === 'submitted'}
                        className={cn(
                          'w-full text-xs rounded py-1 px-2 font-medium transition-colors',
                          req.status === 'submitted'
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-primary-600 hover:bg-primary-700 text-white',
                        )}
                      >
                        {req.status === 'submitted' ? 'Submitted' : 'Mark Submitted'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Tab: Feedback ──────────────────────────────────────────────────────────────

const FEEDBACK_STATUS_LABELS: Record<string, string> = {
  received: 'Received',
  acknowledged: 'Acknowledged',
  resolved: 'Resolved',
}

const CATEGORY_COLORS: Record<string, string> = {
  concern: 'bg-red-100 text-red-700',
  suggestion: 'bg-blue-100 text-blue-700',
  praise: 'bg-green-100 text-green-700',
}

const STATUS_COLORS: Record<string, string> = {
  received: 'bg-amber-100 text-amber-700',
  acknowledged: 'bg-blue-100 text-blue-700',
  resolved: 'bg-green-100 text-green-700',
}

function FeedbackTab() {
  const qc = useQueryClient()
  const [filterBarangayId, setFilterBarangayId] = useState<number | ''>('')
  const [expandedId, setExpandedId] = useState<number | null>(null)

  interface BarangayOption { id: number; barangay_name: string }
  const { data: barangays = [] } = useQuery<BarangayOption[]>({
    queryKey: ['feedback-barangay-options'],
    queryFn: () => apiClient.get('/sk-requirements/barangays/').then(r => {
      const d = r.data; return Array.isArray(d) ? d : (d.results ?? [])
    }),
  })

  const { data: feedbackList = [], isLoading } = useQuery<SKFeedbackItem[]>({
    queryKey: ['sk-feedback', filterBarangayId],
    queryFn: () => skFeedbackApi.list(filterBarangayId || undefined),
  })

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: 'received' | 'acknowledged' | 'resolved' }) =>
      skFeedbackApi.updateStatus(id, status),
    onSuccess: (updated) => {
      qc.setQueryData(['sk-feedback', filterBarangayId], (old: SKFeedbackItem[] = []) =>
        old.map(f => f.id === updated.id ? updated : f)
      )
      toast.success('Status updated')
    },
    onError: () => toast.error('Failed to update status'),
  })

  if (isLoading) return <PageSpinner />

  return (
    <div className="space-y-4">
      {/* Filter row */}
      <div className="flex items-center gap-3 flex-wrap">
        <label className="text-sm font-medium text-ink-700">Filter by Barangay:</label>
        <select
          className="input text-sm py-1.5 px-3 min-w-[220px]"
          value={filterBarangayId}
          onChange={e => setFilterBarangayId(e.target.value ? Number(e.target.value) : '')}
        >
          <option value="">All Barangays</option>
          {barangays.map(b => (
            <option key={b.id} value={b.id}>{b.barangay_name}</option>
          ))}
        </select>
        <span className="text-sm text-ink-500">{feedbackList.length} item{feedbackList.length !== 1 ? 's' : ''}</span>
      </div>

      {feedbackList.length === 0 ? (
        <div className="text-center py-16 text-ink-400">
          <MessageSquare size={36} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No feedback received yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {feedbackList.map(fb => (
            <div key={fb.id} className="bg-white border border-ink-200 rounded-xl overflow-hidden">
              {/* Header row */}
              <button
                className="w-full flex items-start gap-3 p-4 text-left hover:bg-paper-50 transition-colors"
                onClick={() => setExpandedId(expandedId === fb.id ? null : fb.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', CATEGORY_COLORS[fb.category] ?? 'bg-gray-100 text-gray-700')}>
                      {fb.category_display}
                    </span>
                    <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', STATUS_COLORS[fb.status] ?? 'bg-gray-100 text-gray-700')}>
                      {fb.status_display}
                    </span>
                    {fb.rating && (
                      <span className="text-xs text-amber-500 font-semibold">{'★'.repeat(fb.rating)}</span>
                    )}
                  </div>
                  <p className="font-semibold text-sm text-ink-900 truncate">{fb.subject}</p>
                  <p className="text-xs text-ink-500 mt-0.5">
                    {fb.barangay_name} · {fb.submitter_name} · {new Date(fb.created_at).toLocaleDateString()}
                  </p>
                </div>
                <ChevronDown
                  size={16}
                  className={cn('text-ink-400 flex-shrink-0 mt-1 transition-transform', expandedId === fb.id && 'rotate-180')}
                />
              </button>

              {/* Expanded content */}
              {expandedId === fb.id && (
                <div className="px-4 pb-4 space-y-3 border-t border-ink-100 pt-3">
                  <p className="text-sm text-ink-800 whitespace-pre-line">{fb.message}</p>
                  {fb.image_url && (
                    <a href={fb.image_url} target="_blank" rel="noopener noreferrer">
                      <img
                        src={fb.image_url}
                        alt="attachment"
                        className="w-full max-h-64 object-cover rounded-xl border border-ink-200 hover:opacity-90 transition-opacity"
                      />
                    </a>
                  )}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-ink-500 font-medium">Update status:</span>
                    {(['received', 'acknowledged', 'resolved'] as const).map(s => (
                      <button
                        key={s}
                        disabled={fb.status === s || updateStatus.isPending}
                        onClick={() => updateStatus.mutate({ id: fb.id, status: s })}
                        className={cn(
                          'text-xs font-medium px-3 py-1 rounded-lg border transition-colors',
                          fb.status === s
                            ? 'bg-primary-600 text-white border-primary-600 cursor-default'
                            : 'bg-white text-ink-600 border-ink-200 hover:border-primary-400 hover:text-primary-700',
                          updateStatus.isPending && 'opacity-50 cursor-not-allowed',
                        )}
                      >
                        {FEEDBACK_STATUS_LABELS[s]}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Page root ──────────────────────────────────────────────────────────────────

type Tab = 'me' | 'docs' | 'assembly' | 'dilg' | 'feedback'

const TABS: { key: Tab; label: string }[] = [
  { key: 'me', label: 'ME Portal Encoding' },
  { key: 'docs', label: 'Document Submissions' },
  { key: 'assembly', label: 'KK Assembly & LNK' },
  { key: 'dilg', label: 'DILG Requirements' },
  { key: 'feedback', label: 'Youth Feedback' },
]

export default function AdminSKTrackerPage() {
  const [activeTab, setActiveTab] = useState<Tab>('me')
  const [year, setYear] = useState(new Date().getFullYear())

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">SK Compliance Tracker</h1>
          <p className="page-subtitle">Monitor SK councils' compliance across all 33 Lucena City barangays</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setYear(y => y - 1)} className="btn-secondary btn-sm p-1.5"><ChevronLeft size={14} /></button>
          <span className="text-sm font-semibold w-12 text-center">{year}</span>
          <button onClick={() => setYear(y => y + 1)} className="btn-secondary btn-sm p-1.5"><ChevronRight size={14} /></button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px',
              activeTab === tab.key
                ? 'border-primary-600 text-primary-700'
                : 'border-transparent text-ink-500 hover:text-ink-700',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'me' && <MEPortalTab year={year} />}
      {activeTab === 'docs' && <DocumentSubmissionsTab year={year} />}
      {activeTab === 'assembly' && <AssemblyTab year={year} />}
      {activeTab === 'dilg' && <DILGRequirementsTab />}
      {activeTab === 'feedback' && <FeedbackTab />}
    </div>
  )
}
