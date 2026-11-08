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

export default function AdminYORPPage() {
  const qc = useQueryClient()
  const [expanded, setExpanded] = useState<number | null>(null)
  const [filters, setFilters] = useState({ classification: '', sub_classification: '', registration_category: '', barangay: '' })
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState<NewOrgForm>(initialForm)

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

  const filtered = orgs.filter(o => {
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
                  </div>
                  <div>
                    <p className="font-medium text-gray-700 mb-2">Upcoming Events</p>
                    <p className="text-gray-500">{org.upcoming_events || 'No upcoming events.'}</p>
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
