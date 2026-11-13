import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Users, Plus, Download, ChevronDown, ChevronUp, CheckCircle2, X, Filter } from 'lucide-react'
import toast from 'react-hot-toast'
import apiClient from '@/api/client'
import { PageSpinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatDate, cn, toArray } from '@/utils'
import { IntegrityBadge } from '@/components/ui/IntegrityBadge'
import { useYORPDecisionIntegrity } from '@/api/ledger'

interface YouthOrg {
  id: number
  name: string
  classification: string
  sub_classification?: string
  registration_category: string
  barangay: string
  is_compliant: boolean
  accomplishments?: string
  upcoming_events?: string
  requirements_submitted?: number
  requirements_total?: number
  status?: 'pending' | 'approved' | 'rejected'
  created_at?: string
}

interface NewOrgForm {
  name: string
  classification: string
  sub_classification: string
  registration_category: string
  barangay: string
}

const CLASSIFICATIONS = [
  { value: 'school_based', label: 'School-Based' },
  { value: 'community_based', label: 'Community-Based' },
  { value: 'faith_based', label: 'Faith-Based' },
]
const REG_CATEGORIES = [
  { value: 'lydo', label: 'Lydo Registered' },
  { value: 'nyc', label: 'NYC Registered' },
  { value: 'not_registered', label: 'Not Yet Registered' },
]
const classLabel = (v: string) => CLASSIFICATIONS.find(c => c.value === v)?.label ?? v
const regLabel = (v: string) => REG_CATEGORIES.find(c => c.value === v)?.label ?? v

const initialForm: NewOrgForm = {
  name: '', classification: '', sub_classification: '', registration_category: '', barangay: '',
}

interface RequirementRow { id: number; name: string; is_submitted: boolean; file: string | null }

interface OrgDetail {
  id: number
  name: string
  status: 'pending' | 'approved' | 'rejected'
  admin_notes: string
  registration_category: string
  contact_person: string
  contact_email: string
  contact_phone: string
  description: string
  requirements: RequirementRow[]
}

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
}

function useOrgDetail(orgId: number) {
  return useQuery<OrgDetail>({
    queryKey: ['admin-org-detail', orgId],
    queryFn: () => apiClient.get(`/youth-orgs/${orgId}/`).then(r => r.data),
  })
}

/** The documents an organization has uploaded, each opening in a new tab. */
function RequirementFiles({ orgId }: { orgId: number }) {
  const { data, isLoading, isError } = useOrgDetail(orgId)
  const reqs = data?.requirements ?? []
  if (isLoading) return <p className="text-xs text-gray-400 mt-2">Loading documents…</p>
  if (isError) return <p className="text-xs text-red-500 mt-2">Couldn't load the documents.</p>
  if (reqs.length === 0) return <p className="text-xs text-gray-400 mt-2">No requirement checklist yet.</p>
  return (
    <ul className="mt-3 space-y-1.5">
      {reqs.map(r => (
        <li key={r.id} className="flex items-center justify-between gap-2 text-xs">
          <span className={cn('truncate', r.is_submitted ? 'text-gray-700' : 'text-gray-400')}>
            {r.is_submitted ? '✓' : '○'} {r.name}
          </span>
          {r.is_submitted && r.file && (
            <a href={r.file} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline flex-shrink-0">
              View PDF
            </a>
          )}
        </li>
      ))}
    </ul>
  )
}

/** Contact details plus Approve / Reject for an organization's registration application. */
function DecisionBox({ orgId }: { orgId: number }) {
  const qc = useQueryClient()
  const { data: org } = useOrgDetail(orgId)
  const [notes, setNotes] = useState<string | null>(null)
  const [category, setCategory] = useState('lydo')

  const decide = useMutation({
    mutationFn: (action: 'approve' | 'reject') =>
      apiClient.post(`/youth-orgs/${orgId}/${action}/`, {
        admin_notes: (notes ?? org?.admin_notes ?? '').trim(),
        ...(action === 'approve' ? { registration_category: category } : {}),
      }),
    onSuccess: (_res, action) => {
      toast.success(action === 'approve' ? 'Organization approved. The submitter was notified.' : 'Application rejected. The submitter was notified.')
      qc.invalidateQueries({ queryKey: ['admin-youth-orgs'] })
      qc.invalidateQueries({ queryKey: ['admin-org-detail', orgId] })
      qc.invalidateQueries({ queryKey: ['ledger'] })
    },
    onError: (err: any) => {
      const d = err?.response?.data
      toast.error(d?.admin_notes?.[0] ?? d?.registration_category?.[0] ?? d?.detail ?? 'Could not save the decision.')
    },
  })

  if (!org) return null
  const value = notes ?? org.admin_notes ?? ''
  const reject = () => {
    if (!value.trim()) { toast.error('Please write the reason for not approving.'); return }
    decide.mutate('reject')
  }

  return (
    <div className="mt-1 border-t border-gray-200 pt-4 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <p className="font-medium text-gray-700">Registration decision</p>
        <span className={cn('inline-flex px-2 py-0.5 rounded-full border text-xs font-semibold capitalize', STATUS_BADGE[org.status] ?? STATUS_BADGE.pending)}>
          {org.status}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-gray-600">
        <p><span className="text-gray-400">Contact person: </span>{org.contact_person || '—'}</p>
        <p className="min-w-0 break-words"><span className="text-gray-400">Email: </span>{org.contact_email || '—'}</p>
        <p><span className="text-gray-400">Phone: </span>{org.contact_phone || '—'}</p>
      </div>
      {org.description && <p className="text-xs text-gray-600 whitespace-pre-line">{org.description}</p>}

      <label className="block">
        <span className="text-xs text-gray-500">Note to the organization (required when rejecting)</span>
        <textarea
          value={value}
          onChange={e => setNotes(e.target.value)}
          rows={2}
          maxLength={1000}
          className="input mt-1 w-full"
          placeholder="e.g. Complete documents, welcome! / Roster has fewer than 10 members."
        />
      </label>

      <div className="flex items-center gap-2 flex-wrap">
        <select value={category} onChange={e => setCategory(e.target.value)} className="input w-auto text-xs" aria-label="Registration category on approval">
          {REG_CATEGORIES.filter(c => c.value !== 'not_registered').map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <button onClick={() => decide.mutate('approve')} disabled={decide.isPending} className="btn-primary btn-sm text-xs">
          <CheckCircle2 size={13} /> {org.status === 'approved' ? 'Re-approve' : 'Approve'}
        </button>
        <button onClick={reject} disabled={decide.isPending} className="btn-secondary btn-sm text-xs text-red-600">
          <X size={13} /> {org.status === 'rejected' ? 'Reject again' : 'Reject'}
        </button>
      </div>
    </div>
  )
}

export default function AdminYORPPage() {
  const qc = useQueryClient()
  const [expanded, setExpanded] = useState<number | null>(null)
  const [filters, setFilters] = useState({ classification: '', sub_classification: '', registration_category: '', barangay: '' })
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState<NewOrgForm>(initialForm)
  const [statusTab, setStatusTab] = useState<string | null>(null)

  const { data: decisionIntegrity } = useYORPDecisionIntegrity()
  const { data: orgs = [], isLoading } = useQuery<YouthOrg[]>({
    queryKey: ['admin-youth-orgs'],
    queryFn: () => apiClient.get('/youth-orgs/').then(r => toArray<YouthOrg>(r.data)),
  })

  const markCompliant = useMutation({
    mutationFn: (id: number) => apiClient.post(`/youth-orgs/${id}/mark_compliant/`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-youth-orgs'] })
      toast.success('Marked as compliant')
    },
    onError: () => toast.error('Failed to update compliance'),
  })

  const createOrg = useMutation({
    mutationFn: (data: NewOrgForm) => apiClient.post('/youth-orgs/', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-youth-orgs'] })
      toast.success('Organization added')
      setShowModal(false)
      setForm(initialForm)
    },
    onError: () => toast.error('Failed to create organization'),
  })

  // Open on "Pending" when applications are waiting, so they are not missed.
  const counts = {
    pending: orgs.filter(o => o.status === 'pending').length,
    approved: orgs.filter(o => (o.status ?? 'approved') === 'approved').length,
    rejected: orgs.filter(o => o.status === 'rejected').length,
  }
  const activeTab = statusTab ?? (counts.pending > 0 ? 'pending' : 'all')

  const filtered = orgs.filter(o => {
    if (activeTab !== 'all' && (o.status ?? 'approved') !== activeTab) return false
    if (filters.classification && o.classification !== filters.classification) return false
    if (filters.sub_classification && !o.sub_classification?.toLowerCase().includes(filters.sub_classification.toLowerCase())) return false
    if (filters.registration_category && o.registration_category !== filters.registration_category) return false
    if (filters.barangay && !o.barangay?.toLowerCase().includes(filters.barangay.toLowerCase())) return false
    return true
  })

  const exportCSV = () => {
    const headers = ['ID', 'Name', 'Classification', 'Sub-Classification', 'Registration Category', 'Barangay', 'Compliant']
    const rows = filtered.map(o => [
      o.id, o.name, o.classification, o.sub_classification ?? '', o.registration_category, o.barangay, o.is_compliant ? 'Yes' : 'No'
    ])
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'youth-orgs.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  if (isLoading) return <PageSpinner />

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Youth Organization Registry (YORP)</h1>
          <p className="page-subtitle">{filtered.length} organizations</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCSV} className="btn-secondary btn-sm">
            <Download size={14} /> Export CSV
          </button>
          <button onClick={() => setShowModal(true)} className="btn-primary btn-sm">
            <Plus size={14} /> Add Organization
          </button>
        </div>
      </div>

      {/* Application status tabs */}
      <div className="flex gap-2 flex-wrap" role="tablist" aria-label="Application status">
        {([
          ['pending', 'Pending', counts.pending],
          ['approved', 'Approved', counts.approved],
          ['rejected', 'Rejected', counts.rejected],
          ['all', 'All', orgs.length],
        ] as const).map(([key, label, n]) => (
          <button
            key={key}
            role="tab"
            aria-selected={activeTab === key}
            onClick={() => setStatusTab(key)}
            className={cn(
              'px-3 py-1.5 rounded-full text-sm font-medium border transition-colors',
              activeTab === key ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300',
            )}
          >
            {label} <span className={cn('ml-1 text-xs', activeTab === key ? 'text-white/80' : 'text-gray-400')}>{n}</span>
            {key === 'pending' && n > 0 && activeTab !== 'pending' && <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-amber-500 align-middle" />}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={14} className="text-gray-400" />
          <span className="text-sm font-medium text-gray-700">Filter Organizations</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <select value={filters.classification} onChange={e => setFilters(f => ({ ...f, classification: e.target.value }))} className="input">
            <option value="">All Classifications</option>
            {CLASSIFICATIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <input
            value={filters.sub_classification}
            onChange={e => setFilters(f => ({ ...f, sub_classification: e.target.value }))}
            className="input" placeholder="Sub-classification…"
          />
          <select value={filters.registration_category} onChange={e => setFilters(f => ({ ...f, registration_category: e.target.value }))} className="input">
            <option value="">All Categories</option>
            {REG_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <input
            value={filters.barangay}
            onChange={e => setFilters(f => ({ ...f, barangay: e.target.value }))}
            className="input" placeholder="Barangay…"
          />
        </div>
      </div>

      {/* Two-column layout: org list + calendar */}
      <div className="flex flex-col xl:flex-row gap-5">
        <div className="flex-1 min-w-0">
      {filtered.length === 0 ? (
        <EmptyState icon={Users} title="No organizations found" description="Try adjusting your filters or add a new organization." />
      ) : (
        <div className="space-y-2">
          {filtered.map(org => (
            <div key={org.id} className="card overflow-hidden">
              {/* Row */}
              <div className="flex items-center gap-4 p-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-800">{org.name}</span>
                    {org.is_compliant && (
                      <span className="badge-green text-xs">Compliant</span>
                    )}
                    {org.status && org.status !== 'approved' && (
                      <span className={cn('inline-flex px-2 py-0.5 rounded-full border text-xs font-semibold capitalize', STATUS_BADGE[org.status])}>
                        {org.status}
                      </span>
                    )}
                    <IntegrityBadge result={decisionIntegrity?.results[String(org.id)]} intactLabel="Decision intact" />
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                    <span>{classLabel(org.classification)}</span>
                    {org.sub_classification && <span>· {org.sub_classification.replace('_', ' ')}</span>}
                    <span>· {regLabel(org.registration_category)}</span>
                    <span>· {org.barangay}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <label className="flex items-center gap-1.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={org.is_compliant}
                      onChange={() => markCompliant.mutate(org.id)}
                      className="w-4 h-4 rounded accent-green-600"
                    />
                    <span className="text-xs text-gray-600">Compliant</span>
                  </label>
                  <button
                    onClick={() => setExpanded(expanded === org.id ? null : org.id)}
                    className="btn-secondary btn-sm text-xs"
                  >
                    {expanded === org.id ? <><ChevronUp size={13} /> Hide</> : <><ChevronDown size={13} /> Details</>}
                  </button>
                </div>
              </div>

              {/* Expanded details */}
              {expanded === org.id && (
                <div className="border-t border-gray-100 bg-gray-50 p-4 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="font-medium text-gray-700 mb-2">Accomplishments</p>
                    <p className="text-gray-500">{org.accomplishments || 'No accomplishments recorded yet.'}</p>
                  </div>
                  <div>
                    <p className="font-medium text-gray-700 mb-2">Requirements</p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-green-500 h-2 rounded-full"
                          style={{
                            width: `${org.requirements_total
                              ? ((org.requirements_submitted ?? 0) / org.requirements_total) * 100
                              : 0}%`
                          }}
                        />
                      </div>
                      <span className="text-xs text-gray-500">
                        {org.requirements_submitted ?? 0}/{org.requirements_total ?? 10}
                      </span>
                    </div>
                    <RequirementFiles orgId={org.id} />
                  </div>
                  <div>
                    <p className="font-medium text-gray-700 mb-2">Upcoming Events</p>
                    <p className="text-gray-500">{org.upcoming_events || 'No upcoming events.'}</p>
                  </div>
                  <div className="sm:col-span-3">
                    <DecisionBox orgId={org.id} />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
        </div>{/* end flex-1 */}

      </div>{/* end two-column */}

      {/* Add Organization Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold">Add New Organization</h2>
              <button onClick={() => setShowModal(false)}><X size={18} className="text-gray-400" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="label">Organization Name</label>
                <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g., Barangay Youth Council" />
              </div>
              <div>
                <label className="label">Classification</label>
                <select className="input" value={form.classification} onChange={e => setForm(f => ({ ...f, classification: e.target.value }))}>
                  <option value="">Select…</option>
                  {CLASSIFICATIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Sub-Classification</label>
                <input className="input" value={form.sub_classification} onChange={e => setForm(f => ({ ...f, sub_classification: e.target.value }))} placeholder="Optional" />
              </div>
              <div>
                <label className="label">Registration Category</label>
                <select className="input" value={form.registration_category} onChange={e => setForm(f => ({ ...f, registration_category: e.target.value }))}>
                  <option value="">Select…</option>
                  {REG_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Barangay</label>
                <input className="input" value={form.barangay} onChange={e => setForm(f => ({ ...f, barangay: e.target.value }))} placeholder="Barangay name" />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className="btn-secondary btn-sm">Cancel</button>
              <button
                onClick={() => createOrg.mutate(form)}
                disabled={createOrg.isPending || !form.name || !form.classification}
                className="btn-primary btn-sm"
              >
                {createOrg.isPending ? 'Saving…' : 'Add Organization'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
