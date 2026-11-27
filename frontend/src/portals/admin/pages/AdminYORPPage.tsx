import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Users, Plus, Download, ChevronDown, ChevronUp, CheckCircle2, X, Filter, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import apiClient from '@/api/client'
import { PageSpinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatDate, cn, toArray } from '@/utils'
import { IntegrityBadge } from '@/components/ui/IntegrityBadge'
import { useYORPDecisionIntegrity } from '@/api/ledger'
import { OrgApplicationsPanel } from '@/portals/youth/components/OrgJoin'

interface YouthOrg {
  id: number
  name: string
  classification: string
  sub_classification?: string
  registration_category: string
  barangay: string
  is_compliant: boolean
  accepting_members?: boolean
  application_mode?: 'in_app' | 'external' | 'contact'
  acronym?: string
  registration_number?: string
  has_officer_reviewer?: boolean
  accomplishments?: string
  upcoming_events?: string
  requirements_submitted?: number
  requirements_total?: number
  status?: 'pending' | 'approved' | 'rejected'
  created_at?: string
}

interface NewOrgForm {
  name: string
  acronym: string
  classification: string
  sub_classification: string
  registration_category: string
  barangay: string
  application_mode: 'in_app' | 'external' | 'contact'
  external_apply_url: string
}

// the kinds the public directory understands (SK councils have their own pages)
const SUBCLASSIFICATIONS = [
  { value: 'youth_org', label: 'Youth Organization (15–30)' },
  { value: 'youth_serving', label: 'Youth-Serving Organization' },
]
const subLabel = (v?: string) => SUBCLASSIFICATIONS.find(c => c.value === v)?.label ?? (v === 'sk_council' ? 'SK Council' : (v ?? '').replace('_', ' '))
const MODE_LABEL = { in_app: 'Applies in LYDOP', external: 'Applies by own link', contact: 'Contact only' } as const

const CLASSIFICATIONS = [
  { value: 'school_based', label: 'School-Based' },
  { value: 'community_based', label: 'Community-Based' },
  { value: 'faith_based', label: 'Faith-Based' },
]
const REG_CATEGORIES = [
  { value: 'lydo', label: 'YORP Registered (LYDO)' },
  { value: 'nyc', label: 'LYDO & NYC Verified' },
  { value: 'not_registered', label: 'Not Yet Registered' },
]
const classLabel = (v: string) => CLASSIFICATIONS.find(c => c.value === v)?.label ?? v
const regLabel = (v: string) => REG_CATEGORIES.find(c => c.value === v)?.label ?? v

const initialForm: NewOrgForm = {
  name: '', acronym: '', classification: '', sub_classification: 'youth_org', registration_category: '', barangay: '',
  application_mode: 'contact', external_apply_url: '',
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
  is_active: boolean
  mission?: string
  membership_requirements?: string
  how_to_join?: string
  facebook_url?: string
  accepting_members?: boolean
  application_mode?: 'in_app' | 'external' | 'contact'
  external_apply_url?: string
  acronym?: string
  registration_number?: string
  registration_valid_until?: string | null
  officers?: { id: number; position_label: string; name: string; is_public: boolean }[]
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

/** What the public sees on the organization's profile, and whether it is listed. Nothing private goes here. */
function PublicProfileEditor({ org }: { org: OrgDetail }) {
  const qc = useQueryClient()
  const [f, setF] = useState({
    mission: org.mission ?? '', membership_requirements: org.membership_requirements ?? '', how_to_join: org.how_to_join ?? '',
    facebook_url: org.facebook_url ?? '', accepting_members: org.accepting_members ?? true, is_active: org.is_active,
    application_mode: org.application_mode ?? 'in_app', external_apply_url: org.external_apply_url ?? '', acronym: org.acronym ?? '',
    registration_number: org.registration_number ?? '', registration_valid_until: org.registration_valid_until ?? '',
  })
  const save = useMutation({
    mutationFn: () => apiClient.patch(`/youth-orgs/${org.id}/`, { ...f, registration_valid_until: f.registration_valid_until || null }),
    onSuccess: () => {
      toast.success('Public profile saved.')
      qc.invalidateQueries({ queryKey: ['admin-youth-orgs'] })
      qc.invalidateQueries({ queryKey: ['admin-org-detail', org.id] })
    },
    onError: (err: any) => {
      const d = err?.response?.data
      toast.error(d?.external_apply_url?.[0] ?? d?.facebook_url?.[0] ?? d?.detail ?? 'Could not save the public profile.')
    },
  })
  return (
    <div className="space-y-2 rounded-xl border border-gray-200 bg-white p-3">
      <p className="font-medium text-gray-700">Public profile</p>
      <p className="text-xs text-gray-500">Shown to everyone, even visitors without an account. An organization is listed publicly only when it is approved and active.</p>
      <div className="grid gap-2 sm:grid-cols-3">
        <label className="block"><span className="text-xs text-gray-500">Acronym (optional)</span>
          <input className="input mt-1 w-full" maxLength={30} value={f.acronym} onChange={e => setF(p => ({ ...p, acronym: e.target.value }))} /></label>
        <label className="block"><span className="text-xs text-gray-500">YORP registration number</span>
          <input className="input mt-1 w-full" maxLength={60} value={f.registration_number} onChange={e => setF(p => ({ ...p, registration_number: e.target.value }))} /></label>
        <label className="block"><span className="text-xs text-gray-500">Registration valid until</span>
          <input type="date" className="input mt-1 w-full" value={f.registration_valid_until ?? ''} onChange={e => setF(p => ({ ...p, registration_valid_until: e.target.value }))} /></label>
      </div>
      <div className="rounded-lg border border-primary-100 bg-primary-50/40 p-2.5 space-y-2">
        <label className="block"><span className="text-xs font-medium text-gray-700">How people apply to this organization</span>
          <select className="input mt-1 w-full" value={f.application_mode} onChange={e => setF(p => ({ ...p, application_mode: e.target.value as 'in_app' | 'external' | 'contact' }))}>
            <option value="in_app">In-App Application: the organization&apos;s officers review it in LYDOP</option>
            <option value="external">External link: the organization&apos;s own form or page</option>
            <option value="contact">Contact only: people reach out directly</option>
          </select></label>
        {f.application_mode === 'in_app' && <p className="text-xs text-gray-600">The organization&apos;s officers (the account that registered it) review and approve these applications, not LYDO. Without an officer account, LYDO only passes them on.</p>}
        {f.application_mode === 'external' && (
          <label className="block"><span className="text-xs text-gray-500">Link where people apply (Google Form, Facebook, website)</span>
            <input className="input mt-1 w-full" value={f.external_apply_url} onChange={e => setF(p => ({ ...p, external_apply_url: e.target.value }))} placeholder="https://forms.gle/..." /></label>
        )}
      </div>
      <label className="block"><span className="text-xs text-gray-500">Mission and objectives</span>
        <textarea className="input mt-1 w-full" rows={2} maxLength={1500} value={f.mission} onChange={e => setF(p => ({ ...p, mission: e.target.value }))} /></label>
      <label className="block"><span className="text-xs text-gray-500">Membership requirements</span>
        <textarea className="input mt-1 w-full" rows={2} maxLength={1000} value={f.membership_requirements} onChange={e => setF(p => ({ ...p, membership_requirements: e.target.value }))} /></label>
      <label className="block"><span className="text-xs text-gray-500">How to join</span>
        <textarea className="input mt-1 w-full" rows={2} maxLength={1000} value={f.how_to_join} onChange={e => setF(p => ({ ...p, how_to_join: e.target.value }))} /></label>
      <label className="block"><span className="text-xs text-gray-500">Facebook page (optional, only a link the organization gave)</span>
        <input className="input mt-1 w-full" value={f.facebook_url} onChange={e => setF(p => ({ ...p, facebook_url: e.target.value }))} placeholder="https://www.facebook.com/..." /></label>
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-gray-700">
        <label className="flex items-center gap-2"><input type="checkbox" checked={f.accepting_members} onChange={e => setF(p => ({ ...p, accepting_members: e.target.checked }))} /> Accepting new members</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={f.is_active} disabled={org.status !== 'approved'} onChange={e => setF(p => ({ ...p, is_active: e.target.checked }))} /> Listed publicly {org.status !== 'approved' && <span className="text-xs text-gray-400">(after approval)</span>}</label>
      </div>
      <button type="button" onClick={() => save.mutate()} disabled={save.isPending} className="btn-primary btn-sm text-xs">{save.isPending ? 'Saving…' : 'Save public profile'}</button>
    </div>
  )
}

/** Contact details plus Approve / Reject for an organization's registration application. */
function DecisionBox({ orgId }: { orgId: number }) {
  const qc = useQueryClient()
  const { data: org } = useOrgDetail(orgId)
  const [notes, setNotes] = useState<string | null>(null)
  const [category, setCategory] = useState('lydo')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const remove = useMutation({
    mutationFn: () => apiClient.delete(`/youth-orgs/${orgId}/`),
    onSuccess: () => {
      toast.success('Organization deleted.')
      qc.invalidateQueries({ queryKey: ['admin-youth-orgs'] })
      qc.invalidateQueries({ queryKey: ['youth-orgs-directory'] })
    },
    onError: () => toast.error('Could not delete the organization.'),
  })

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
      <div className="rounded-xl border border-gray-200 bg-white p-3">
        <p className="mb-1 text-xs font-medium text-gray-700">Officers (you see all of them; the public sees only the marked ones)</p>
        {(org.officers?.length ?? 0) === 0 ? <p className="text-xs text-gray-500">No officers listed yet.</p> : (
          <ul className="grid gap-x-4 gap-y-1 sm:grid-cols-2 text-xs">
            {org.officers!.map(o => (
              <li key={o.id}><span className="font-semibold text-gray-800">{o.name}</span> <span className="text-gray-500">· {o.position_label}</span> <span className={o.is_public ? 'text-emerald-700' : 'text-gray-500'}>{o.is_public ? '(public)' : '(private)'}</span></li>
            ))}
          </ul>
        )}
      </div>

      <PublicProfileEditor key={`${org.id}-${org.status}-${org.is_active}`} org={org} />

      <div className="rounded-xl border border-red-100 bg-red-50/50 p-3">
        {!confirmDelete ? (
          <button type="button" onClick={() => setConfirmDelete(true)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-red-700"><Trash2 size={14} /> Delete this organization…</button>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-red-800">Delete <strong>{org.name}</strong> for good? Its officers, documents and membership applications are deleted with it. This cannot be undone. The deletion is kept in the audit log.</p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmDelete(false)} className="btn-secondary btn-sm text-xs">Keep it</button>
              <button type="button" onClick={() => remove.mutate()} disabled={remove.isPending} className="btn-sm bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 text-xs">{remove.isPending ? 'Deleting…' : 'Yes, delete'}</button>
            </div>
          </div>
        )}
      </div>

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
    onError: (e: any) => toast.error(e?.response?.data?.external_apply_url?.[0] ?? e?.response?.data?.name?.[0] ?? 'Failed to create organization'),
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
    const headers = ['ID', 'Name', 'Classification', 'Sub-Classification', 'Registration Category', 'Barangay', 'Compliant', 'Membership', 'How people apply', 'YORP Registration No.']
    const rows = filtered.map(o => [
      o.id, `"${o.name.replace(/"/g, '""')}"`, o.classification, o.sub_classification ?? '', o.registration_category, o.barangay, o.is_compliant ? 'Yes' : 'No',
      o.accepting_members === false ? 'Closed' : 'Open', o.application_mode ?? 'in_app', o.registration_number ?? ''
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
          <select value={filters.sub_classification} onChange={e => setFilters(f => ({ ...f, sub_classification: e.target.value }))} className="input">
            <option value="">All Types</option>
            {SUBCLASSIFICATIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            <option value="sk_council">SK Council</option>
          </select>
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
                    <span className="font-semibold text-gray-800">{org.name}{org.acronym ? <span className="font-normal text-gray-500"> ({org.acronym})</span> : null}</span>
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
                    {org.sub_classification && <span>· {subLabel(org.sub_classification)}</span>}
                    <span>· {regLabel(org.registration_category)}</span>
                    <span>· {org.barangay}</span>
                  </div>
                  {org.sub_classification !== 'sk_council' && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                      <span className={cn('rounded-full border px-2 py-0.5 font-semibold', org.accepting_members === false ? 'border-gray-200 bg-gray-50 text-gray-600' : 'border-emerald-200 bg-emerald-50 text-emerald-800')}>
                        {org.accepting_members === false ? 'Membership closed' : 'Open for members'}
                      </span>
                      <span className="rounded-full border border-primary-200 bg-primary-50 px-2 py-0.5 font-semibold text-primary-800">{MODE_LABEL[org.application_mode ?? 'in_app']}</span>
                      {(org.application_mode ?? 'in_app') === 'in_app' && org.has_officer_reviewer === false && (
                        <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 font-semibold text-amber-800" title="No officer account is linked to this organization, so nobody reviews applications made in LYDOP. Choose another way to apply, or link an officer account.">No officer account to review applications</span>
                      )}
                    </div>
                  )}
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
                  {org.status === 'approved' && (
                    <div className="sm:col-span-3 rounded-xl border border-gray-200 bg-white">
                      <OrgApplicationsPanel orgId={org.id} />
                    </div>
                  )}
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
                <label className="label">Acronym (optional)</label>
                <input className="input" maxLength={30} value={form.acronym} onChange={e => setForm(f => ({ ...f, acronym: e.target.value }))} placeholder="e.g. LYA" />
              </div>
              <div>
                <label className="label">Type</label>
                <select className="input" value={form.sub_classification} onChange={e => setForm(f => ({ ...f, sub_classification: e.target.value }))}>
                  {SUBCLASSIFICATIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
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
              <div>
                <label className="label">How people apply</label>
                <select className="input" value={form.application_mode} onChange={e => setForm(f => ({ ...f, application_mode: e.target.value as NewOrgForm['application_mode'] }))}>
                  <option value="contact">Contact only: people reach out directly</option>
                  <option value="external">The organization&apos;s own link (Google Form, Facebook)</option>
                  <option value="in_app">In LYDOP: needs an officer account to review</option>
                </select>
                {form.application_mode === 'in_app' && <p className="mt-1 text-xs text-amber-700">An organization you add yourself has no officer account yet, so nobody in the organization can review applications made in LYDOP. LYDO only passes them on.</p>}
              </div>
              {form.application_mode === 'external' && (
                <div>
                  <label className="label">Link where people apply</label>
                  <input className="input" value={form.external_apply_url} onChange={e => setForm(f => ({ ...f, external_apply_url: e.target.value }))} placeholder="https://forms.gle/..." />
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className="btn-secondary btn-sm">Cancel</button>
              <button
                onClick={() => createOrg.mutate(form)}
                disabled={createOrg.isPending || !form.name || !form.classification || (form.application_mode === 'external' && !form.external_apply_url.trim())}
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
