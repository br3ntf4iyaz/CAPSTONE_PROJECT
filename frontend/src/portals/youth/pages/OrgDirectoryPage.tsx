import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Building2, Search, CheckCircle2, XCircle, Mail, Phone,
  MapPin, Users, X, Award, Calendar, ChevronRight, Plus,
  ShieldCheck, Clock, CheckCheck, Ban, Send, Info,
} from 'lucide-react'
import toast from 'react-hot-toast'
import apiClient from '@/api/client'
import OrgCalendarWidget from '@/components/ui/OrgCalendarWidget'
import { QueryError } from '@/components/ui/QueryError'
import { cn } from '@/utils'
import { useAuthStore } from '@/store/authStore'

// ── Types ──────────────────────────────────────────────────────────────────────
interface YouthOrg {
  id: number
  name: string
  classification: string
  sub_classification: string
  registration_category: string
  barangay: string
  description: string
  contact_person: string
  is_compliant: boolean
  logo_url: string | null
}

interface OrgDetail extends YouthOrg {
  contact_email: string
  contact_phone: string
  is_active: boolean
  status: string
  admin_notes: string
  created_at: string
  accomplishments: { id: number; title: string; description: string; date_achieved: string | null }[]
}

interface MySubmission {
  id: number
  name: string
  classification: string
  barangay: string
  status: 'pending' | 'approved' | 'rejected'
  admin_notes: string
  created_at: string
  requirements: OrgRequirementItem[]
}

interface OrgRequirementItem {
  id: number
  name: string
  is_submitted: boolean
  submitted_at: string | null
  notes: string
}

// ── Constants ──────────────────────────────────────────────────────────────────
const CLASS_COLORS: Record<string, string> = {
  school_based:    'badge-blue',
  community_based: 'badge-green',
  faith_based:     'badge-purple',
}
const CLASS_LABELS: Record<string, string> = {
  school_based:    'School-Based',
  community_based: 'Community-Based',
  faith_based:     'Faith-Based',
}
const SUBCLASS_LABELS: Record<string, string> = {
  youth_org:     'Youth Organization (15–30)',
  youth_serving: 'Youth Serving Organization',
}
const REG_LABELS: Record<string, string> = {
  lydo:           'LYDO Registered',
  nyc:            'LYDO & NYC Registered',
  not_registered: 'Not Yet Registered',
}
const REG_COLORS: Record<string, string> = {
  lydo:           'badge-blue',
  nyc:            'badge-green',
  not_registered: 'badge-gray',
}

// ── Org Detail Modal ───────────────────────────────────────────────────────────
function OrgDetailModal({ orgId, onClose }: { orgId: number; onClose: () => void }) {
  const { data: org, isLoading } = useQuery<OrgDetail>({
    queryKey: ['org-detail', orgId],
    queryFn: () => apiClient.get(`/youth-orgs/${orgId}/`).then(r => r.data),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {isLoading ? (
          <div className="p-10 text-center text-ink-500">Loading…</div>
        ) : org ? (
          <>
            {/* Header */}
            <div className="relative bg-gradient-to-br from-primary-600 to-primary-800 px-6 pt-8 pb-10 text-white">
              <button onClick={onClose} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors">
                <X size={16} />
              </button>
              {org.logo_url ? (
                <img
                  src={org.logo_url}
                  alt={org.name}
                  className="w-14 h-14 rounded-2xl object-cover border-2 border-white/30 mb-4"
                />
              ) : (
                <div className="w-14 h-14 rounded-2xl bg-white/20 border-2 border-white/30 flex items-center justify-center mb-4">
                  <Users size={26} className="text-white" />
                </div>
              )}
              <h2 className="font-display font-extrabold text-xl leading-tight mb-1">{org.name}</h2>
              <div className="flex flex-wrap gap-2 mt-2">
                <span className="text-xs font-semibold bg-white/20 px-2.5 py-1 rounded-full">
                  {CLASS_LABELS[org.classification] ?? org.classification}
                </span>
                {org.is_compliant && (
                  <span className="text-xs font-semibold bg-emerald-400/30 px-2.5 py-1 rounded-full flex items-center gap-1">
                    <CheckCheck size={11} /> Compliant
                  </span>
                )}
              </div>
            </div>

            {/* Info cards */}
            <div className="-mt-5 mx-4 bg-white rounded-2xl border border-ink-100 shadow-sm p-4 space-y-3">
              {org.barangay && (
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-8 h-8 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0">
                    <MapPin size={14} className="text-primary-600" />
                  </div>
                  <div>
                    <p className="text-xs text-ink-500">Barangay</p>
                    <p className="font-semibold text-ink-900">{org.barangay}</p>
                  </div>
                </div>
              )}
              {org.contact_person && (
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-8 h-8 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0">
                    <Users size={14} className="text-primary-600" />
                  </div>
                  <div>
                    <p className="text-xs text-ink-500">Contact Person</p>
                    <p className="font-semibold text-ink-900">{org.contact_person}</p>
                  </div>
                </div>
              )}
              {org.contact_email && (
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-8 h-8 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0">
                    <Mail size={14} className="text-primary-600" />
                  </div>
                  <div>
                    <p className="text-xs text-ink-500">Email</p>
                    <a href={`mailto:${org.contact_email}`} className="font-semibold text-primary-700 hover:underline">{org.contact_email}</a>
                  </div>
                </div>
              )}
              {org.contact_phone && (
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-8 h-8 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0">
                    <Phone size={14} className="text-primary-600" />
                  </div>
                  <div>
                    <p className="text-xs text-ink-500">Phone</p>
                    <a href={`tel:${org.contact_phone}`} className="font-semibold text-primary-700 hover:underline">{org.contact_phone}</a>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3 text-sm">
                <div className="w-8 h-8 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0">
                  <Award size={14} className="text-primary-600" />
                </div>
                <div>
                  <p className="text-xs text-ink-500">Registration</p>
                  <p className="font-semibold text-ink-900">{REG_LABELS[org.registration_category] ?? org.registration_category}</p>
                </div>
              </div>
            </div>

            {/* Description */}
            {org.description && (
              <div className="px-4 pt-4">
                <p className="text-xs font-semibold text-ink-500 uppercase tracking-wide mb-2">About</p>
                <p className="text-sm text-ink-700 leading-relaxed">{org.description}</p>
              </div>
            )}

            {/* Accomplishments / Activities */}
            {org.accomplishments.length > 0 && (
              <div className="px-4 pt-5 pb-6">
                <p className="text-xs font-semibold text-ink-500 uppercase tracking-wide mb-3">
                  Activities & Accomplishments ({org.accomplishments.length})
                </p>
                <div className="space-y-3">
                  {org.accomplishments.map(a => (
                    <div key={a.id} className="flex gap-3">
                      <div className="w-8 h-8 rounded-xl bg-accent-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Award size={14} className="text-accent-600" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-ink-900">{a.title}</p>
                        {a.date_achieved && (
                          <p className="text-xs text-ink-400 flex items-center gap-1 mt-0.5">
                            <Calendar size={11} />
                            {new Date(a.date_achieved).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}
                          </p>
                        )}
                        {a.description && <p className="text-xs text-ink-600 mt-1 leading-relaxed">{a.description}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {org.accomplishments.length === 0 && (
              <div className="px-4 pt-4 pb-6 text-center text-ink-400 text-sm">
                <Award size={28} className="mx-auto mb-2 opacity-30" />
                No activities recorded yet.
              </div>
            )}
          </>
        ) : (
          <div className="p-10 text-center text-ink-500">Organization not found.</div>
        )}
      </div>
    </div>
  )
}

// ── Submission Form Modal ──────────────────────────────────────────────────────
const CLASSIFICATIONS = [
  { value: 'school_based',    label: 'School-Based' },
  { value: 'community_based', label: 'Community-Based' },
  { value: 'faith_based',     label: 'Faith-Based' },
]
const SUBCLASSIFICATIONS = [
  { value: 'youth_org',     label: 'Youth Organization (15–30)' },
  { value: 'youth_serving', label: 'Youth Serving Organization (Mixed Ages)' },
]
const REG_CATS = [
  { value: 'lydo',           label: 'LYDO Registered' },
  { value: 'nyc',            label: 'NYC Registered' },
  { value: 'not_registered', label: 'Not Yet Registered' },
]

function SubmitOrgModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    name: '', classification: 'community_based', sub_classification: 'youth_org',
    registration_category: 'not_registered', barangay: '',
    description: '', contact_person: '', contact_email: '', contact_phone: '',
  })
  const [done, setDone] = useState(false)

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const submitMutation = useMutation({
    mutationFn: () => apiClient.post('/youth-orgs/', form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-org-submissions'] })
      setDone(true)
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.name?.[0]
        ?? err?.response?.data?.detail
        ?? 'Submission failed. Please try again.'
      toast.error(msg)
    },
  })

  if (done) return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 text-center" onClick={e => e.stopPropagation()}>
        <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 size={32} className="text-emerald-600" />
        </div>
        <h2 className="font-display font-extrabold text-xl text-ink-900 mb-2">Submitted!</h2>
        <p className="text-sm text-ink-600 mb-6">
          Your organization has been submitted for admin review. You'll see its status in <strong>My Submissions</strong> below.
        </p>
        <button onClick={onClose} className="btn-primary w-full">Done</button>
      </div>
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-ink-100 px-6 py-4 flex items-center justify-between rounded-t-3xl">
          <h2 className="font-display font-bold text-lg text-ink-900">Register Your Organization</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-ink-100 hover:bg-ink-200 flex items-center justify-center transition-colors">
            <X size={16} />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
            Your submission will be reviewed by LYDO admins before appearing in the directory.
          </div>

          <div>
            <label className="label">Organization Name <span className="text-alert-500">*</span></label>
            <input className="input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Lucena Youth Advocates" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Classification</label>
              <select className="input" value={form.classification} onChange={e => set('classification', e.target.value)}>
                {CLASSIFICATIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Type</label>
              <select className="input" value={form.sub_classification} onChange={e => set('sub_classification', e.target.value)}>
                {SUBCLASSIFICATIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Barangay</label>
              <input className="input" value={form.barangay} onChange={e => set('barangay', e.target.value)} placeholder="e.g. Barangay 5" />
            </div>
            <div>
              <label className="label">Registration Status</label>
              <select className="input" value={form.registration_category} onChange={e => set('registration_category', e.target.value)}>
                {REG_CATS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="label">Description</label>
            <textarea className="input resize-none" rows={3} value={form.description} onChange={e => set('description', e.target.value)} placeholder="What does your organization do?" />
          </div>

          <div>
            <label className="label">Contact Person</label>
            <input className="input" value={form.contact_person} onChange={e => set('contact_person', e.target.value)} placeholder="Full name" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" value={form.contact_email} onChange={e => set('contact_email', e.target.value)} placeholder="org@email.com" />
            </div>
            <div>
              <label className="label">Phone</label>
              <input className="input" type="tel" value={form.contact_phone} onChange={e => set('contact_phone', e.target.value)} placeholder="09XX-XXX-XXXX" />
            </div>
          </div>

          <div className="flex items-start gap-2 p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-600">
            <Info size={14} className="text-gray-400 flex-shrink-0 mt-0.5" />
            <span>Note: Approval of membership applications is handled directly by the organization and is not managed through this system.</span>
          </div>

          <button
            type="button"
            disabled={!form.name.trim() || submitMutation.isPending}
            onClick={() => submitMutation.mutate()}
            className="btn-primary w-full"
          >
            <Send size={15} />
            {submitMutation.isPending ? 'Submitting…' : 'Submit for Review'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── My Submissions Panel ───────────────────────────────────────────────────────
const STATUS_CONFIG = {
  pending:  { label: 'Under Review', icon: Clock,        cls: 'text-amber-700 bg-amber-50 border-amber-200' },
  approved: { label: 'Approved',     icon: CheckCircle2, cls: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  rejected: { label: 'Rejected',     icon: Ban,          cls: 'text-red-700 bg-red-50 border-red-200' },
}

/** The documents LYDO needs for YORP registration, with an upload button for each. */
function RequirementChecklist({ org }: { org: MySubmission }) {
  const qc = useQueryClient()
  const [uploadingId, setUploadingId] = useState<number | null>(null)
  const reqs = org.requirements ?? []
  const done = reqs.filter(r => r.is_submitted).length
  const locked = org.status === 'rejected'

  const upload = useMutation({
    mutationFn: ({ reqId, file }: { reqId: number; file: File }) => {
      const fd = new FormData()
      fd.append('file', file)
      return apiClient.post(`/youth-orgs/${org.id}/requirements/${reqId}/upload/`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
    },
    onMutate: ({ reqId }) => setUploadingId(reqId),
    onSuccess: () => {
      toast.success('Document uploaded.')
      qc.invalidateQueries({ queryKey: ['my-org-submissions'] })
    },
    onError: (err: any) => {
      const d = err?.response?.data
      toast.error(d?.file?.[0] ?? d?.detail ?? 'Upload failed. Please try again.')
    },
    onSettled: () => setUploadingId(null),
  })

  if (reqs.length === 0) return null
  return (
    <div className="mt-3 border-t border-ink-100 pt-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-ink-700">Required documents</p>
        <span className="text-xs text-ink-500">{done} of {reqs.length} submitted</span>
      </div>
      <div className="h-1.5 bg-ink-100 rounded-full overflow-hidden mb-3">
        <div className="h-full bg-green-500 transition-all" style={{ width: `${(done / reqs.length) * 100}%` }} />
      </div>
      <ul className="space-y-2">
        {reqs.map(r => (
          <li key={r.id} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex items-center gap-2 min-w-0">
              {r.is_submitted
                ? <CheckCircle2 size={15} className="text-green-600 flex-shrink-0" />
                : <Clock size={15} className="text-amber-500 flex-shrink-0" />}
              <span className="truncate text-ink-800">{r.name}</span>
            </span>
            {!locked && (
              <label className={cn('btn-secondary btn-sm text-xs cursor-pointer flex-shrink-0', uploadingId === r.id && 'opacity-60 pointer-events-none')}>
                {uploadingId === r.id ? 'Uploading…' : r.is_submitted ? 'Replace PDF' : 'Upload PDF'}
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  className="sr-only"
                  onChange={e => {
                    const file = e.target.files?.[0]
                    e.target.value = ''
                    if (!file) return
                    if (file.size > 10 * 1024 * 1024) { toast.error('File must be 10 MB or smaller.'); return }
                    upload.mutate({ reqId: r.id, file })
                  }}
                />
              </label>
            )}
          </li>
        ))}
      </ul>
      <p className="text-[11px] text-ink-400 mt-2">PDF only, up to 10 MB each.</p>
    </div>
  )
}

function MySubmissions() {
  const { data: subs = [] } = useQuery<MySubmission[]>({
    queryKey: ['my-org-submissions'],
    queryFn: () => apiClient.get('/youth-orgs/my-submissions/').then(r => {
      const d = r.data; return Array.isArray(d) ? d : (d.results ?? [])
    }).catch(() => []),
  })
  if (subs.length === 0) return null

  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-sm text-ink-700">My Submissions</h3>
      {subs.map(s => {
        const cfg = STATUS_CONFIG[s.status] ?? STATUS_CONFIG.pending
        const Icon = cfg.icon
        return (
          <div key={s.id} className="card p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-sm text-ink-900">{s.name}</p>
                <p className="text-xs text-ink-500 mt-0.5">{s.barangay} · {CLASS_LABELS[s.classification]}</p>
              </div>
              <span className={cn('inline-flex items-center gap-1.5 text-xs font-semibold border px-2.5 py-1 rounded-full flex-shrink-0', cfg.cls)}>
                <Icon size={11} /> {cfg.label}
              </span>
            </div>
            {s.admin_notes && (
              <p className="text-xs text-ink-600 bg-ink-50 rounded-lg px-3 py-2 mt-2">{s.admin_notes}</p>
            )}
            <RequirementChecklist org={s} />
          </div>
        )
      })}
    </div>
  )
}

const FILTER_TABS = [
  { value: '',               label: 'All' },
  { value: 'community_based', label: 'Community' },
  { value: 'school_based',    label: 'School' },
  { value: 'faith_based',     label: 'Faith' },
]

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function OrgDirectoryPage() {
  const [search, setSearch] = useState('')
  const [classFilter, setClassFilter] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [showSubmitForm, setShowSubmitForm] = useState(false)

  const auth = useAuthStore()
  const { data: verification } = useQuery<{ is_verified: boolean }>({
    queryKey: ['verification-status'],
    queryFn: () => apiClient.get('/verification/').then(r => r.data).catch(() => ({ is_verified: false })),
    enabled: !!auth.isAuthenticated,
  })
  const isVerified = verification?.is_verified ?? false

  const { data: orgs = [], isLoading, isError, refetch } = useQuery<YouthOrg[]>({
    queryKey: ['youth-orgs-directory'],
    queryFn: () =>
      apiClient.get('/youth-orgs/').then(r => {
        const d = r.data
        return Array.isArray(d) ? d : (d.results ?? [])
      }),
  })

  const filtered = orgs.filter(o => {
    if (o.sub_classification === 'sk_council') return false
    if (classFilter && o.classification !== classFilter) return false
    if (!search) return true
    return (
      o.name.toLowerCase().includes(search.toLowerCase()) ||
      o.barangay.toLowerCase().includes(search.toLowerCase())
    )
  })

  return (
    <div className="space-y-6">
      {selectedId && <OrgDetailModal orgId={selectedId} onClose={() => setSelectedId(null)} />}
      {showSubmitForm && <SubmitOrgModal onClose={() => setShowSubmitForm(false)} />}

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="page-title">Youth Organization Directory</h1>
          <p className="page-subtitle">Explore registered youth organizations in Lucena City</p>
        </div>
        {auth.isAuthenticated && (
          isVerified ? (
            <button onClick={() => setShowSubmitForm(true)} className="btn-primary btn-sm flex-shrink-0">
              <Plus size={15} /> Register Your Org
            </button>
          ) : (
            <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
              <ShieldCheck size={14} />
              <span>Verify your ID to register an organization</span>
            </div>
          )
        )}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3 items-start">
        <svg className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
        </svg>
        <p className="text-sm text-blue-700">
          If you are interested in being listed in the Youth Organization Directory, please coordinate with <strong>LYDO</strong> for verification and registration.
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1 min-w-0 space-y-4">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
            <input
              type="text"
              placeholder="Search organizations or barangay…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input pl-9"
            />
          </div>

          {/* Classification filter chips */}
          <div className="flex gap-2 flex-wrap">
            {FILTER_TABS.map(tab => (
              <button
                key={tab.value}
                onClick={() => setClassFilter(tab.value)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors',
                  classFilter === tab.value
                    ? 'bg-primary-700 text-white border-primary-700'
                    : 'bg-white text-ink-600 border-ink-200 hover:border-primary-300 hover:text-primary-700',
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <p className="text-xs text-ink-500">
            {isLoading ? 'Loading…' : `${filtered.length} organization${filtered.length !== 1 ? 's' : ''} found`}
          </p>

          {isLoading ? (
            <div className="space-y-3">
              {[1,2,3].map(i => <div key={i} className="skeleton h-24 w-full rounded-xl" />)}
            </div>
          ) : isError ? (
            <QueryError onRetry={() => refetch()} />
          ) : filtered.length === 0 ? (
            <div className="card p-12 text-center text-ink-500">
              <Building2 size={36} className="mx-auto mb-3 opacity-30" />
              <p>No organizations found.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(org => (
                <button
                  key={org.id}
                  onClick={() => setSelectedId(org.id)}
                  className="w-full card p-4 hover:shadow-md hover:border-primary-200 transition-all text-left group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      {org.logo_url ? (
                        <img
                          src={org.logo_url}
                          alt={org.name}
                          className="w-10 h-10 rounded-xl object-cover flex-shrink-0 border border-ink-100"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center flex-shrink-0">
                          <Users size={18} className="text-primary-600" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-ink-900 text-sm truncate group-hover:text-primary-700 transition-colors">{org.name}</h3>
                          {org.is_compliant
                            ? <CheckCircle2 size={14} className="text-green-500 flex-shrink-0" />
                            : <XCircle size={14} className="text-ink-300 flex-shrink-0" />}
                        </div>
                        <p className="text-xs text-ink-500 mt-0.5">{org.barangay}</p>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          <span className={cn('badge text-[10px]', CLASS_COLORS[org.classification] ?? 'badge-gray')}>
                            {CLASS_LABELS[org.classification] ?? org.classification}
                          </span>
                          <span className={cn('badge text-[10px]', REG_COLORS[org.registration_category] ?? 'badge-gray')}>
                            {REG_LABELS[org.registration_category] ?? org.registration_category}
                          </span>
                        </div>
                        {org.description && (
                          <p className="text-xs text-ink-500 mt-2 line-clamp-1">{org.description}</p>
                        )}
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-ink-300 group-hover:text-primary-500 transition-colors flex-shrink-0 mt-1" />
                  </div>
                </button>
              ))}
            </div>
          )}

          {auth.isAuthenticated && (
            <div className="pt-2">
              <MySubmissions />
            </div>
          )}
        </div>

        <div className="w-full lg:w-72 flex-shrink-0">
          <OrgCalendarWidget title="Org Events & Activities" />
        </div>
      </div>
    </div>
  )
}
