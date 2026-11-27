import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Building2, Search, CheckCircle2, XCircle, Mail, Phone,
  MapPin, Users, X, Award, Calendar, ChevronRight, Plus,
  ShieldCheck, Clock, CheckCheck, Ban, Send, Info, ExternalLink,
} from 'lucide-react'
import toast from 'react-hot-toast'
import apiClient from '@/api/client'
import OrgCalendarWidget from '@/components/ui/OrgCalendarWidget'
import { QueryError } from '@/components/ui/QueryError'
import { cn } from '@/utils'
import { useAuthStore } from '@/store/authStore'
import { JoinFlow, OrgApplicationsPanel, clearRememberedNext } from '../components/OrgJoin'
import ManageOrganization from '../components/ManageOrganization'
import { accentOf } from '../orgAccent'
import OfficersEditor, { POSITIONS, type OfficerRow } from '../components/OfficersEditor'

/** What the signed-in person is: general youth, a youth organization leader, or an SK official. Leaders and SK officials do not recruit or join here. */
interface Viewer { isLeader: boolean; isSK: boolean; barangay: string }

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
  accepting_members?: boolean
  application_mode?: 'in_app' | 'external' | 'contact'
  external_apply_url?: string
  acronym?: string
  accent?: string
  is_mine?: boolean
  logo_url: string | null
}

interface OrgDetail extends YouthOrg {
  mission?: string
  membership_requirements?: string
  how_to_join?: string
  facebook_url?: string
  can_manage?: boolean
  registration_number?: string
  registration_valid_until?: string | null
  source_url?: string
  has_officer_reviewer?: boolean
  officers?: { id: number; position: string; position_label: string; name: string; is_public: boolean }[]
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
// LYDO and the NYC register organizations under YORP (the Youth Organization Registration Program)
const REG_LABELS: Record<string, string> = {
  lydo:           'YORP Registered',
  nyc:            'LYDO & NYC Verified',
  not_registered: 'Not Yet Registered',
}
const REG_COLORS: Record<string, string> = {
  lydo:           'badge-blue',
  nyc:            'badge-green',
  not_registered: 'badge-gray',
}

const isOpen = (o: { accepting_members?: boolean }) => o.accepting_members !== false

/** Open or closed to new members. */
function MembershipBadge({ org }: { org: { accepting_members?: boolean } }) {
  return isOpen(org)
    ? <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />Open for Members</span>
    : <span className="inline-flex items-center gap-1 rounded-full border border-ink-200 bg-ink-50 px-2 py-0.5 text-[10px] font-semibold text-ink-600"><span className="h-1.5 w-1.5 rounded-full bg-ink-400" />Membership Closed</span>
}

// ── Org Detail Modal ───────────────────────────────────────────────────────────
function OrgDetailModal({ orgId, onClose, onJoin, onManage, viewer }: { orgId: number; onClose: () => void; onJoin: (o: { id: number; name: string }) => void; onManage: (id: number) => void; viewer: Viewer }) {
  const { data: org, isLoading } = useQuery<OrgDetail>({
    queryKey: ['org-detail', orgId],
    queryFn: () => apiClient.get(`/youth-orgs/${orgId}/`).then(r => r.data),
  })

  // one look for every section: a small capital title, then text of one size
  const Section = ({ title, aside, children }: { title: string; aside?: React.ReactNode; children: React.ReactNode }) => (
    <section className="border-t border-ink-100 pt-5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-[11px] font-bold uppercase tracking-[0.08em] text-ink-500">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  )
  const Fact = ({ icon: Icon, label, children }: { icon: typeof MapPin; label: string; children: React.ReactNode }) => (
    <div className="flex items-start gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600"><Icon size={16} /></span>
      <div className="min-w-0">
        <p className="text-xs text-ink-500">{label}</p>
        <div className="text-sm font-semibold leading-5 text-ink-900">{children}</div>
      </div>
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl" onClick={e => e.stopPropagation()}>
        {isLoading ? (
          <div className="p-10 text-center text-ink-500">Loading…</div>
        ) : org ? (
          <>
            {/* Header: stays in place, the content below scrolls under it */}
            <div className={cn('relative shrink-0 bg-gradient-to-br px-6 pb-6 pt-6 text-white', accentOf(org).header)}>
              <button onClick={onClose} aria-label="Close" className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/15 transition-colors hover:bg-white/25">
                <X size={16} />
              </button>
              <div className="flex items-start gap-4 pr-10">
                {org.logo_url ? (
                  <img src={org.logo_url} alt={org.name} className="h-14 w-14 shrink-0 rounded-2xl border-2 border-white/30 object-cover" />
                ) : (
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border-2 border-white/30 bg-white/20"><Users size={26} className="text-white" /></div>
                )}
                <div className="min-w-0">
                  <h2 className="font-display text-xl font-extrabold leading-snug">{org.name}{org.acronym ? <span className="ml-2 text-base font-bold text-white/80">({org.acronym})</span> : null}</h2>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span className="rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-semibold">{SUBCLASS_LABELS[org.sub_classification] ?? 'Youth Organization'}</span>
                    <span className="rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-semibold">{CLASS_LABELS[org.classification] ?? org.classification}</span>
                    {org.is_compliant && (
                      <span className="flex items-center gap-1 rounded-full bg-emerald-400/30 px-2.5 py-1 text-[11px] font-semibold"><CheckCheck size={11} /> Compliant</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto p-6">
              {/* Key facts */}
              <div className="grid gap-x-6 gap-y-4 rounded-2xl border border-ink-100 bg-ink-50/50 p-4 sm:grid-cols-2">
                <Fact icon={Award} label="Verification">
                  <p>{REG_LABELS[org.registration_category] ?? org.registration_category}</p>
                  {org.registration_number && <p className="mt-0.5 text-xs font-normal text-ink-600">Registration no. <span className="font-mono font-semibold">{org.registration_number}</span></p>}
                  {org.registration_valid_until && <p className="text-xs font-normal text-ink-600">Valid until {new Date(org.registration_valid_until).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}</p>}
                </Fact>
                {org.barangay && <Fact icon={MapPin} label="Barangay">{org.barangay}</Fact>}
                {org.contact_person && <Fact icon={Users} label="Key officer / contact person">{org.contact_person}</Fact>}
                {org.contact_email && <Fact icon={Mail} label="Email"><a href={'mailto:' + org.contact_email} className="break-all text-primary-700 hover:underline">{org.contact_email}</a></Fact>}
                {org.contact_phone && <Fact icon={Phone} label="Phone"><a href={'tel:' + org.contact_phone} className="text-primary-700 hover:underline">{org.contact_phone}</a></Fact>}
              </div>

              {(org.description || org.mission) && (
                <Section title="About">
                  {org.description && <p className="text-sm leading-6 text-ink-700">{org.description}</p>}
                  {org.mission && (
                    <>
                      <h4 className="mb-1 mt-3 text-sm font-bold text-ink-900">Mission and objectives</h4>
                      <p className="whitespace-pre-line text-sm leading-6 text-ink-700">{org.mission}</p>
                    </>
                  )}
                </Section>
              )}

              {(org.source_url || org.registration_category === 'not_registered') && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 text-[13px] leading-5 text-ink-700">
                  {org.registration_category === 'not_registered' && (
                    <>
                      <p className="font-bold text-ink-900">Not yet confirmed by LYDO</p>
                      <p className="mt-0.5">This listing is for information only and may change once LYDO confirms the details.</p>
                    </>
                  )}
                  {org.source_url && (
                    <p className={org.registration_category === 'not_registered' ? 'mt-2' : ''}>
                      <span className="font-bold text-ink-900">Source: </span>
                      <a href={org.source_url} target="_blank" rel="noopener noreferrer" className="break-all font-semibold text-primary-700 underline">{org.source_url}</a>
                    </p>
                  )}
                </div>
              )}

              {(org.officers?.length ?? 0) > 0 && (
                <Section title="Officers">
                  <ul className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                    {org.officers!.map(o => (
                      <li key={o.id}>
                        <p className="text-sm font-semibold leading-5 text-ink-900">{o.name}</p>
                        <p className="text-xs text-ink-500">{o.position_label}{!o.is_public && <span className="ml-1.5 rounded-full bg-ink-100 px-1.5 py-0.5 text-[10px] font-semibold text-ink-600">Private</span>}</p>
                      </li>
                    ))}
                  </ul>
                  {org.can_manage && <p className="mt-2 text-xs text-ink-500">Officers marked Private are visible only to you and LYDO.</p>}
                </Section>
              )}

              {/* Membership: how this organization takes members (the organization decides) */}
              <Section title="How to join" aside={<MembershipBadge org={org} />}>
                <div className="space-y-3">
                  <p className="text-[13px] leading-5 text-ink-600">LYDO registers and verifies youth organizations. Membership is decided by <strong className="text-ink-800">the organization itself</strong>, not by LYDO.</p>
                  {org.membership_requirements && (
                    <div>
                      <h4 className="mb-0.5 text-sm font-bold text-ink-900">Requirements</h4>
                      <p className="whitespace-pre-line text-sm leading-6 text-ink-700">{org.membership_requirements}</p>
                    </div>
                  )}
                  {org.how_to_join && (
                    <div>
                      <h4 className="mb-0.5 text-sm font-bold text-ink-900">Steps</h4>
                      <p className="whitespace-pre-line text-sm leading-6 text-ink-700">{org.how_to_join}</p>
                    </div>
                  )}
                  {org.facebook_url && (
                    <div className="flex flex-wrap gap-2">
                      <a href={org.facebook_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-[#1877F2]/30 px-3.5 py-1.5 text-xs font-semibold text-[#1877F2] hover:bg-[#1877F2]/5">Facebook page</a>
                    </div>
                  )}
                  {org.can_manage ? (
                    <div className="space-y-2">
                      <p className="inline-flex items-center gap-1.5 rounded-full border border-primary-200 bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-800"><ShieldCheck size={12} /> Your Organization</p>
                      <button type="button" onClick={() => onManage(org.id)} className="btn-primary w-full">Manage Organization</button>
                    </div>
                  ) : !isOpen(org) ? (
                    <p className="rounded-xl bg-ink-50 p-3 text-center text-sm font-semibold text-ink-600">Membership is closed right now.</p>
                  ) : org.application_mode === 'external' && org.external_apply_url ? (
                    <a href={org.external_apply_url} target="_blank" rel="noopener noreferrer" className="btn-primary flex w-full items-center justify-center gap-1.5">
                      Apply / Join via the organization&apos;s link <ExternalLink size={14} />
                    </a>
                  ) : org.application_mode === 'contact' ? (
                    org.how_to_join ? null : <p className="rounded-xl bg-primary-50 p-3 text-[13px] leading-5 text-primary-900">To join, please contact the organization directly using the details above.</p>
                  ) : (
                    <>
                      <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[13px] leading-5 text-amber-900">
                        {org.has_officer_reviewer === false
                          ? 'You can apply here in LYDOP. This organization has no officer account in LYDOP yet, so LYDO will pass your application on to the organization. LYDO does not approve memberships.'
                          : 'You can apply here in LYDOP. The officers of this organization review your application and decide whether to approve it. LYDO does not approve memberships.'}
                      </p>
                      <button type="button" onClick={() => onJoin({ id: org.id, name: org.name })} className="btn-primary w-full">Apply for membership in LYDOP</button>
                    </>
                  )}
                </div>
              </Section>
              {org.can_manage && <div className="-mx-6 border-t border-ink-100 pt-2"><OrgApplicationsPanel orgId={org.id} /></div>}

              <Section title={org.accomplishments.length > 0 ? 'Activities & accomplishments (' + org.accomplishments.length + ')' : 'Activities & accomplishments'}>
                {org.accomplishments.length === 0 ? (
                  <p className="text-sm text-ink-400">No activities recorded yet.</p>
                ) : (
                  <div className="space-y-3">
                    {org.accomplishments.map(a => (
                      <div key={a.id} className="flex gap-3">
                        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-accent-50"><Award size={14} className="text-accent-600" /></span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold leading-5 text-ink-900">{a.title}</p>
                          {a.date_achieved && (
                            <p className="mt-0.5 flex items-center gap-1 text-xs text-ink-400"><Calendar size={11} />{new Date(a.date_achieved).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                          )}
                          {a.description && <p className="mt-1 text-[13px] leading-5 text-ink-600">{a.description}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Section>
            </div>
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
    my_position: 'president', my_position_custom: '',
  })
  const [officers, setOfficers] = useState<OfficerRow[]>([])
  const [done, setDone] = useState(false)

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const submitMutation = useMutation({
    mutationFn: () => apiClient.post('/youth-orgs/', { ...form, officers_input: officers.filter(o => o.name.trim()) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-org-submissions'] })
      setDone(true)
    },
    onError: (err: any) => {
      // say which box is wrong, in plain words
      const d = err?.response?.data
      const LABEL: Record<string, string> = {
        name: 'Organization name', contact_email: 'Email', contact_phone: 'Phone', contact_person: 'Contact person', description: 'Description',
        barangay: 'Barangay', officers: 'Officers', my_position: 'Your position', classification: 'Classification', sub_classification: 'Type',
      }
      let msg: string | undefined
      if (d && typeof d === 'object') {
        if (d.detail) msg = String(d.detail)
        else {
          const [k, v] = Object.entries(d)[0] ?? []
          const first = Array.isArray(v) ? v[0] : v
          if (k && typeof first === 'string') msg = k === 'name' && /already exists/i.test(first) ? 'An organization with this name already exists. Use a different name.' : `${LABEL[k] ?? k}: ${first}`
        }
      }
      toast.error(msg ?? 'Submission failed. Please try again.')
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
          Your organization is now <strong>Pending Verification</strong>. Only you and LYDO can see it until LYDO approves it. You can follow it, and manage it, under <strong>My Organizations</strong> below.
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
              <label className="label">Your position in this organization</label>
              <select className="input" value={form.my_position} onChange={e => set('my_position', e.target.value)}>
                {POSITIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
          </div>
          {form.my_position === 'other' && (
            <input className="input" maxLength={60} value={form.my_position_custom} onChange={e => set('my_position_custom', e.target.value)} placeholder="Your title" aria-label="Your title" />
          )}

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

          <div>
            <p className="label">Other officers (optional)</p>
            <OfficersEditor value={officers} onChange={setOfficers} />
          </div>

          <div className="flex items-start gap-2 p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-600">
            <Info size={14} className="text-gray-400 flex-shrink-0 mt-0.5" />
            <span>LYDO verifies the organization. Afterwards, <strong>your officers</strong>, not LYDO, review and approve the members who apply through LYDOP. You can also choose to take members on your own link.</span>
          </div>

          <button
            type="button"
            disabled={!form.name.trim() || submitMutation.isPending}
            onClick={() => {
              const email = form.contact_email.trim()
              if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { toast.error('Email: enter a complete email address, like org@email.com.'); return }
              submitMutation.mutate()
            }}
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
  pending:  { label: 'Pending Verification', icon: Clock,        cls: 'text-amber-700 bg-amber-50 border-amber-200' },
  approved: { label: 'Verified / YORP Registered', icon: CheckCircle2, cls: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
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

/** What the leader submitted, read-only: shown on a rejected organization so they can see what was sent before deleting or registering again. */
function SubmittedDetails({ id }: { id: number }) {
  const { data: o, isLoading } = useQuery<{
    name: string; acronym: string; classification: string; sub_classification: string; barangay: string; description: string
    contact_person: string; contact_email: string; contact_phone: string; my_position: string; mission: string
    officers: { id: number; position_label: string; name: string; is_public: boolean }[]
  }>({ queryKey: ['manage-org', id], queryFn: () => apiClient.get(`/youth-orgs/${id}/manage/`).then(r => r.data) })
  if (isLoading) return <p className="mt-2 text-xs text-ink-500">Loading the details…</p>
  if (!o) return null
  const rows: [string, string | undefined][] = [
    ['Organization name', o.name + (o.acronym ? ` (${o.acronym})` : '')],
    ['Classification', CLASS_LABELS[o.classification] ?? o.classification],
    ['Type', SUBCLASS_LABELS[o.sub_classification] ?? o.sub_classification],
    ['Barangay', o.barangay],
    ['Your position', o.my_position],
    ['Contact person', o.contact_person],
    ['Email', o.contact_email],
    ['Phone', o.contact_phone],
  ]
  return (
    <div className="mt-2 rounded-xl border border-ink-100 bg-ink-50/50 p-3 text-sm">
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-500">What you submitted</p>
      <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1">
        {rows.filter(([, v]) => v).map(([k, v]) => (
          <div key={k} className="contents"><dt className="text-ink-500">{k}</dt><dd className="break-words font-medium text-ink-800">{v}</dd></div>
        ))}
      </dl>
      {o.description && <p className="mt-2 whitespace-pre-line text-ink-700"><span className="text-ink-500">Description: </span>{o.description}</p>}
      {o.officers.length > 0 && (
        <div className="mt-2">
          <p className="text-ink-500">Officers</p>
          <ul className="mt-0.5 space-y-0.5">
            {o.officers.map(x => <li key={x.id} className="text-ink-800"><span className="font-medium">{x.name}</span> <span className="text-xs text-ink-500">· {x.position_label}</span></li>)}
          </ul>
        </div>
      )}
    </div>
  )
}

function MySubmissions({ onManage }: { onManage: (id: number) => void }) {
  const qc = useQueryClient()
  const [confirmId, setConfirmId] = useState<number | null>(null)
  const remove = useMutation({
    mutationFn: (id: number) => apiClient.post(`/youth-orgs/${id}/delete-mine/`),
    onSuccess: () => { toast.success('Organization deleted'); setConfirmId(null); qc.invalidateQueries({ queryKey: ['my-org-submissions'] }) },
    onError: (e: any) => toast.error(e?.response?.data?.detail ?? 'Could not delete the organization.'),
  })
  const { data: subs = [] } = useQuery<MySubmission[]>({
    queryKey: ['my-org-submissions'],
    queryFn: () => apiClient.get('/youth-orgs/my-submissions/').then(r => {
      const d = r.data; return Array.isArray(d) ? d : (d.results ?? [])
    }).catch(() => []),
  })
  if (subs.length === 0) return null

  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-sm text-ink-700">My Organizations</h3>
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
            {s.status === 'pending' && <p className="mt-2 text-xs text-ink-500">Visible only to you and LYDO until it is verified.</p>}
            {s.status === 'rejected' && <SubmittedDetails id={s.id} />}
            {s.status === 'rejected' ? (
              confirmId === s.id ? (
                <div className="mt-2 space-y-2 rounded-xl border border-red-100 bg-red-50/60 p-3">
                  <p className="text-xs text-red-800">Delete <strong>{s.name}</strong> for good? This cannot be undone. You can register it again later if you wish.</p>
                  <div className="flex gap-2">
                    <button type="button" disabled={remove.isPending} onClick={() => remove.mutate(s.id)} className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">{remove.isPending ? 'Deleting…' : 'Yes, delete'}</button>
                    <button type="button" onClick={() => setConfirmId(null)} className="text-xs font-semibold text-ink-500">Keep it</button>
                  </div>
                </div>
              ) : (
                <button type="button" onClick={() => setConfirmId(s.id)} className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50">Delete this organization</button>
              )
            ) : (
              <button type="button" onClick={() => onManage(s.id)} className="btn-secondary btn-sm mt-2">Manage Organization</button>
            )}
            {s.status !== 'rejected' && <RequirementChecklist org={s} />}
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
  const [joinOrg, setJoinOrg] = useState<{ id: number; name: string } | null>(null)
  const [barangay, setBarangay] = useState('')
  const [openOnly, setOpenOnly] = useState(false)
  const [params, setParams] = useSearchParams()

  const auth = useAuthStore()
  const viewer: Viewer = {
    isLeader: auth.user?.youth_type === 'youth_org_leader',
    isSK: auth.user?.youth_type === 'sk',
    barangay: (auth.user?.profile?.barangay ?? '').trim().toLowerCase(),
  }
  const [manageId, setManageId] = useState<number | null>(null)
  const [mineOnly, setMineOnly] = useState(false)
  const inMyBarangay = (o: { barangay: string }) => !!viewer.barangay && o.barangay.trim().toLowerCase() === viewer.barangay
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

  // a link such as /organizations?org=5&join=1 (also what the sign-in page returns to) opens that organization,
  // and the apply form once the person is signed in
  useEffect(() => {
    const id = Number(params.get('org'))
    if (id) {
      setSelectedId(id)
      if (auth.isAuthenticated) clearRememberedNext()
      if (params.get('join') === '1' && auth.isAuthenticated) setJoinOrg({ id, name: orgs.find(o => o.id === id)?.name ?? 'this organization' })
      if (params.get('join') !== '1' || auth.isAuthenticated) setParams({}, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, auth.isAuthenticated])

  // every barangay of the city (from the SK directory, which is public), plus any other place an organization named
  const { data: cityBarangays = [] } = useQuery<string[]>({
    queryKey: ['barangay-names'],
    queryFn: () => apiClient.get('/sk-requirements/barangays/').then(r => (Array.isArray(r.data) ? r.data : r.data.results ?? []).map((b: { barangay_name: string }) => b.barangay_name)).catch(() => []),
    staleTime: 1000 * 60 * 30,
  })
  const barangays = useMemo(
    () => [...new Set([...cityBarangays, ...orgs.map(o => o.barangay)].filter(Boolean))].sort((x, y) => x.localeCompare(y, undefined, { numeric: true })),
    [cityBarangays, orgs],
  )

  const filtered = orgs.filter(o => {
    if (o.sub_classification === 'sk_council') return false
    if (classFilter && o.classification !== classFilter) return false
    if (barangay && o.barangay !== barangay) return false
    if (openOnly && !isOpen(o)) return false
    if (mineOnly && !(viewer.isSK ? inMyBarangay(o) : o.is_mine)) return false
    if (!search) return true
    const q = search.toLowerCase()
    return o.name.toLowerCase().includes(q) || o.barangay.toLowerCase().includes(q) || (o.acronym ?? '').toLowerCase().includes(q)
  })

  return (
    <div className="space-y-6">
      {selectedId && <OrgDetailModal orgId={selectedId} onClose={() => setSelectedId(null)} onJoin={o => setJoinOrg(o)} onManage={id => { setSelectedId(null); setManageId(id) }} viewer={viewer} />}
      {manageId && <ManageOrganization orgId={manageId} onClose={() => setManageId(null)} />}
      {joinOrg && <JoinFlow org={joinOrg} onClose={() => setJoinOrg(null)} />}
      {showSubmitForm && <SubmitOrgModal onClose={() => setShowSubmitForm(false)} />}

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="page-title">Youth Organization Directory</h1>
          <p className="page-subtitle">Youth organizations registered under YORP in Lucena City</p>
        </div>
        {auth.isAuthenticated && (
          isVerified ? (
            <button onClick={() => setShowSubmitForm(true)} className="btn-primary btn-sm flex-shrink-0">
              <Plus size={15} /> {viewer.isLeader ? 'Register / Create New Organization' : 'Register Your Org'}
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
          This directory features verified youth and youth-serving organizations registered under the Youth Organization Registration Program (YORP) in Lucena City.
          To apply for membership, please follow how each organization takes members: on its own link, by contacting it directly, or here in LYDOP where it allows.
          Want to register your organization? <strong>Coordinate with LYDO.</strong>
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1 min-w-0 space-y-4">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
            <input
              type="text"
              placeholder="Search by organization name or barangay…"
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

          <div className="flex flex-wrap items-center gap-3">
            <button type="button" role="switch" aria-checked={openOnly} onClick={() => setOpenOnly(v => !v)}
              className={cn('inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
                openOnly ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-ink-200 bg-white text-ink-600 hover:border-primary-300')}>
              <span className={cn('relative h-4 w-7 rounded-full transition-colors', openOnly ? 'bg-emerald-500' : 'bg-ink-300')}>
                <span className={cn('absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all', openOnly ? 'left-3.5' : 'left-0.5')} />
              </span>
              Open for Members only
            </button>
            {(viewer.isSK && viewer.barangay) || viewer.isLeader ? (
              <button type="button" role="switch" aria-checked={mineOnly} onClick={() => setMineOnly(v => !v)}
                className={cn('inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
                  mineOnly ? 'border-primary-300 bg-primary-50 text-primary-800' : 'border-ink-200 bg-white text-ink-600 hover:border-primary-300')}>
                {viewer.isSK ? 'In my barangay only' : 'My organizations only'}
              </button>
            ) : null}
            {barangays.length > 1 && (
              <select className="input w-auto text-sm" value={barangay} onChange={e => setBarangay(e.target.value)} aria-label="Filter by barangay">
                <option value="">All barangays</option>
                {barangays.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            )}
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
                <div
                  key={org.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedId(org.id)}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedId(org.id) } }}
                  className={cn('w-full rounded-2xl border border-l-4 shadow-sm p-4 hover:shadow-lg hover:-translate-y-0.5 transition-all text-left group cursor-pointer', accentOf(org).card)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      {org.logo_url ? (
                        <img
                          src={org.logo_url}
                          alt={org.name}
                          className="w-11 h-11 rounded-xl object-cover flex-shrink-0 border-2 border-primary-100 bg-white shadow-sm"
                        />
                      ) : (
                        <div className={cn('w-11 h-11 rounded-xl bg-gradient-to-br shadow-md flex items-center justify-center flex-shrink-0', accentOf(org).tile)}>
                          <Users size={20} className="text-white" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className={cn('font-bold text-sm truncate transition-colors', accentOf(org).name)}>{org.name}{org.acronym ? <span className="font-semibold text-ink-500"> ({org.acronym})</span> : null}</h3>
                          {org.is_compliant
                            ? <CheckCircle2 size={14} className="text-green-500 flex-shrink-0" />
                            : <XCircle size={14} className="text-ink-300 flex-shrink-0" />}
                        </div>
                        <p className="text-xs font-medium text-primary-700 mt-0.5">{org.barangay}</p>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          <span className={cn('badge text-[10px]', CLASS_COLORS[org.classification] ?? 'badge-gray')}>
                            {CLASS_LABELS[org.classification] ?? org.classification}
                          </span>
                          <span className={cn('badge text-[10px]', REG_COLORS[org.registration_category] ?? 'badge-gray')}>
                            {REG_LABELS[org.registration_category] ?? org.registration_category}
                          </span>
                          <MembershipBadge org={org} />
                          {org.is_mine && <span className="inline-flex items-center gap-1 rounded-full border border-primary-300 bg-primary-50 px-2 py-0.5 text-[10px] font-bold text-primary-800"><ShieldCheck size={10} /> Your Organization</span>}
                          {viewer.isSK && inMyBarangay(org) && <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800"><MapPin size={10} /> In your barangay</span>}
                        </div>
                        {org.description && (
                          <p className="text-xs text-ink-700 mt-2 line-clamp-1">{org.description}</p>
                        )}
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <span className={cn('rounded-full px-3.5 py-1 text-[11px] font-semibold text-white shadow-md', accentOf(org).button)}>View Profile</span>
                          {org.is_mine ? (
                            <button type="button" onClick={e => { e.stopPropagation(); setManageId(org.id) }}
                              className="rounded-full border-2 border-primary-300 bg-primary-50 px-3 py-1 text-[11px] font-semibold text-primary-800 hover:border-primary-500">
                              Manage Organization
                            </button>
                          ) : isOpen(org) && org.application_mode === 'external' && org.external_apply_url ? (
                            <a href={org.external_apply_url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                              className="inline-flex items-center gap-1 rounded-full border-2 border-primary-200 bg-white px-3 py-1 text-[11px] font-semibold text-primary-700 hover:border-primary-400">
                              Apply via link <ExternalLink size={11} />
                            </a>
                          ) : isOpen(org) && (org.application_mode ?? 'in_app') === 'in_app' ? (
                            <button type="button" onClick={e => { e.stopPropagation(); setJoinOrg({ id: org.id, name: org.name }) }}
                              className="rounded-full border-2 border-primary-200 bg-white px-3 py-1 text-[11px] font-semibold text-primary-700 hover:border-primary-400">
                              Apply in LYDOP
                            </button>
                          ) : (
                            <button type="button" onClick={e => { e.stopPropagation(); setSelectedId(org.id) }}
                              className="rounded-full border-2 border-primary-200 bg-white px-3 py-1 text-[11px] font-semibold text-primary-700 hover:border-primary-400">
                              Contact Org
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-ink-300 group-hover:text-primary-500 transition-colors flex-shrink-0 mt-1" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {auth.isAuthenticated && (
            <div className="pt-2">
              <MySubmissions onManage={setManageId} />
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
