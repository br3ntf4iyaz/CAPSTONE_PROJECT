import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Briefcase, School as SchoolIcon, Award, Plus, Edit2, Trash2, X,
  Star, ExternalLink, CheckCircle2, XCircle,
} from 'lucide-react'
import toast from 'react-hot-toast'
import apiClient from '@/api/client'
import { PageSpinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatDate, cn, toArray } from '@/utils'

// ─── Jobs ─────────────────────────────────────────────────────────────────────
interface Job {
  id: number
  title: string
  company_or_org: string
  location: string
  job_type: string
  job_type_display?: string
  industry: string
  industry_display?: string
  salary_range?: string
  application_deadline?: string
  application_link?: string
  contact_email?: string
  description?: string
  requirements?: string
  is_active: boolean
  is_featured: boolean
}

const initialJobForm = {
  title: '',
  company_or_org: '',
  location: '',
  job_type: 'full_time',
  industry: 'government',
  salary_range: '',
  application_deadline: '',
  application_link: '',
  contact_email: '',
  description: '',
  requirements: '',
  is_featured: false,
  is_active: true,
}

// ─── Schools ──────────────────────────────────────────────────────────────────
interface School {
  id: number
  name: string
  slug: string
  school_type: string
  municipality: string
  province: string
  address: string
  phone: string
  email: string
  website: string
  program_count: number
  is_active: boolean
  is_featured: boolean
}

const initialSchoolForm = {
  name: '',
  school_type: 'public',
  municipality: '',
  province: '',
  address: '',
  phone: '',
  email: '',
  website: '',
  description: '',
  is_featured: false,
  is_active: true,
}

// ─── Scholarships ─────────────────────────────────────────────────────────────
interface Scholarship {
  id: number
  title: string
  provider: string
  provider_type: string
  description: string
  coverage: string
  amount: string
  deadline: string
  slots: string
  requirements: string[]
  application_url: string
  category: string
  is_published: boolean
  is_featured: boolean
}

const initialScholarshipForm = {
  title: '',
  provider: '',
  provider_type: 'government',
  description: '',
  coverage: '',
  amount: '',
  deadline: '',
  slots: '',
  requirements_text: '',
  application_url: '',
  category: 'tuition',
  is_published: true,
  is_featured: false,
}

const PROVIDER_TYPES = ['government', 'local_government', 'private', 'ngo']
const SCHOLARSHIP_CATEGORIES = [
  'tuition', 'stem', 'vocational', 'youth_leadership',
  'board_exam', 'private', 'loan', 'assistance', 'other',
]

const TYPE_BADGE: Record<string, string> = {
  government: 'badge-blue',
  local_government: 'badge-green',
  private: 'badge-purple',
  ngo: 'badge-gray',
}

// ─── Constants ────────────────────────────────────────────────────────────────
const JOB_TYPES = ['full_time', 'part_time', 'internship', 'contract']
const INDUSTRIES = ['government', 'private', 'ngo', 'education', 'health', 'tech', 'other']
const SCHOOL_TYPES = ['public', 'private', 'state_university', 'technical_vocational']

type Tab = 'jobs' | 'scholarships' | 'schools'

export default function AdminJobsSchoolsPage() {
  const qc = useQueryClient()
  const [activeTab, setActiveTab] = useState<Tab>('jobs')

  // ── Jobs state ──────────────────────────────────────────────────────────────
  const [showJobModal, setShowJobModal] = useState(false)
  const [editJob, setEditJob] = useState<Job | null>(null)
  const [jobForm, setJobForm] = useState({ ...initialJobForm })

  // ── Schools state ────────────────────────────────────────────────────────────
  const [showSchoolModal, setShowSchoolModal] = useState(false)
  const [editSchool, setEditSchool] = useState<School | null>(null)
  const [schoolForm, setSchoolForm] = useState({ ...initialSchoolForm })

  // ── Scholarships state ────────────────────────────────────────────────────────
  const [showScholarshipModal, setShowScholarshipModal] = useState(false)
  const [editScholarship, setEditScholarship] = useState<Scholarship | null>(null)
  const [scholarshipForm, setScholarshipForm] = useState({ ...initialScholarshipForm })

  // ─── Jobs queries ─────────────────────────────────────────────────────────
  const { data: jobs = [], isLoading: jobsLoading } = useQuery<Job[]>({
    queryKey: ['admin-jobs'],
    queryFn: () => apiClient.get('/jobs/').then(r => toArray<Job>(r.data)),
    enabled: activeTab === 'jobs',
  })

  const createJob = useMutation({
    mutationFn: (data: typeof jobForm) => apiClient.post('/jobs/', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-jobs'] }); toast.success('Job listing added'); closeJobModal() },
    onError: () => toast.error('Failed to add job'),
  })

  const updateJob = useMutation({
    mutationFn: ({ id, data }: { id: number; data: typeof jobForm }) => apiClient.patch(`/jobs/${id}/`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-jobs'] }); toast.success('Job updated'); closeJobModal() },
    onError: () => toast.error('Failed to update job'),
  })

  const deleteJob = useMutation({
    mutationFn: (id: number) => apiClient.delete(`/jobs/${id}/`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-jobs'] }); toast.success('Job deleted') },
    onError: () => toast.error('Failed to delete job'),
  })

  const openJobCreate = () => { setEditJob(null); setJobForm({ ...initialJobForm }); setShowJobModal(true) }
  const openJobEdit = (j: Job) => {
    setEditJob(j)
    setJobForm({
      title: j.title,
      company_or_org: j.company_or_org,
      location: j.location,
      job_type: j.job_type,
      industry: j.industry,
      salary_range: j.salary_range ?? '',
      application_deadline: j.application_deadline ?? '',
      application_link: j.application_link ?? '',
      contact_email: j.contact_email ?? '',
      description: j.description ?? '',
      requirements: j.requirements ?? '',
      is_featured: j.is_featured,
      is_active: j.is_active,
    })
    setShowJobModal(true)
  }
  const closeJobModal = () => { setShowJobModal(false); setEditJob(null); setJobForm({ ...initialJobForm }) }

  const handleJobSubmit = () => {
    if (!jobForm.title || !jobForm.company_or_org) { toast.error('Title and company are required'); return }
    if (editJob) updateJob.mutate({ id: editJob.id, data: jobForm })
    else createJob.mutate(jobForm)
  }

  // ─── Schools queries ──────────────────────────────────────────────────────
  const { data: schools = [], isLoading: schoolsLoading } = useQuery<School[]>({
    queryKey: ['admin-schools'],
    queryFn: () => apiClient.get('/schools/').then(r => toArray<School>(r.data)),
    enabled: activeTab === 'schools',
  })

  const createSchool = useMutation({
    mutationFn: (data: typeof schoolForm) => apiClient.post('/schools/', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-schools'] }); toast.success('School added'); closeSchoolModal() },
    onError: () => toast.error('Failed to add school'),
  })

  const updateSchool = useMutation({
    mutationFn: ({ id, data }: { id: number; data: typeof schoolForm }) => apiClient.patch(`/schools/${id}/`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-schools'] }); toast.success('School updated'); closeSchoolModal() },
    onError: () => toast.error('Failed to update school'),
  })

  const openSchoolCreate = () => { setEditSchool(null); setSchoolForm({ ...initialSchoolForm }); setShowSchoolModal(true) }
  const openSchoolEdit = (s: School) => {
    setEditSchool(s)
    setSchoolForm({
      name: s.name,
      school_type: s.school_type,
      municipality: s.municipality,
      province: s.province,
      address: s.address,
      phone: s.phone,
      email: s.email,
      website: s.website,
      description: '',
      is_featured: s.is_featured,
      is_active: s.is_active,
    })
    setShowSchoolModal(true)
  }
  const closeSchoolModal = () => { setShowSchoolModal(false); setEditSchool(null); setSchoolForm({ ...initialSchoolForm }) }

  const handleSchoolSubmit = () => {
    if (!schoolForm.name) { toast.error('School name is required'); return }
    if (editSchool) updateSchool.mutate({ id: editSchool.id, data: schoolForm })
    else createSchool.mutate(schoolForm)
  }

  // ─── Scholarship queries ───────────────────────────────────────────────────
  const { data: scholarships = [], isLoading: scholarshipsLoading } = useQuery<Scholarship[]>({
    queryKey: ['admin-scholarships'],
    queryFn: () => apiClient.get('/scholarships/').then(r => toArray<Scholarship>(r.data)),
    enabled: activeTab === 'scholarships',
  })

  const createScholarship = useMutation({
    mutationFn: (data: object) => apiClient.post('/scholarships/', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-scholarships'] }); toast.success('Scholarship added'); closeScholarshipModal() },
    onError: () => toast.error('Failed to add scholarship'),
  })

  const updateScholarship = useMutation({
    mutationFn: ({ id, data }: { id: number; data: object }) => apiClient.patch(`/scholarships/${id}/`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-scholarships'] }); toast.success('Scholarship updated'); closeScholarshipModal() },
    onError: () => toast.error('Failed to update scholarship'),
  })

  const deleteScholarship = useMutation({
    mutationFn: (id: number) => apiClient.delete(`/scholarships/${id}/`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-scholarships'] }); toast.success('Scholarship deleted') },
    onError: () => toast.error('Failed to delete scholarship'),
  })

  const openScholarshipCreate = () => { setEditScholarship(null); setScholarshipForm({ ...initialScholarshipForm }); setShowScholarshipModal(true) }
  const openScholarshipEdit = (s: Scholarship) => {
    setEditScholarship(s)
    setScholarshipForm({
      title: s.title,
      provider: s.provider,
      provider_type: s.provider_type,
      description: s.description,
      coverage: s.coverage,
      amount: s.amount,
      deadline: s.deadline,
      slots: s.slots,
      requirements_text: s.requirements.join('\n'),
      application_url: s.application_url,
      category: s.category,
      is_published: s.is_published,
      is_featured: s.is_featured,
    })
    setShowScholarshipModal(true)
  }
  const closeScholarshipModal = () => { setShowScholarshipModal(false); setEditScholarship(null); setScholarshipForm({ ...initialScholarshipForm }) }

  const handleScholarshipSubmit = () => {
    if (!scholarshipForm.title || !scholarshipForm.provider) { toast.error('Title and provider are required'); return }
    const payload = {
      title: scholarshipForm.title,
      provider: scholarshipForm.provider,
      provider_type: scholarshipForm.provider_type,
      description: scholarshipForm.description,
      coverage: scholarshipForm.coverage,
      amount: scholarshipForm.amount,
      deadline: scholarshipForm.deadline,
      slots: scholarshipForm.slots,
      requirements: scholarshipForm.requirements_text.split('\n').map(l => l.trim()).filter(Boolean),
      application_url: scholarshipForm.application_url,
      category: scholarshipForm.category,
      is_published: scholarshipForm.is_published,
      is_featured: scholarshipForm.is_featured,
    }
    if (editScholarship) updateScholarship.mutate({ id: editScholarship.id, data: payload })
    else createScholarship.mutate(payload)
  }

  const isLoading = (activeTab === 'jobs' && jobsLoading) || (activeTab === 'schools' && schoolsLoading) || (activeTab === 'scholarships' && scholarshipsLoading)

  const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: 'jobs', label: 'Jobs', icon: Briefcase },
    { key: 'scholarships', label: 'Scholarships', icon: Award },
    { key: 'schools', label: 'Schools', icon: SchoolIcon },
  ]

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Jobs, Scholarships &amp; Schools</h1>
        <p className="page-subtitle">Manage job listings, scholarship references, and the school directory</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-gray-200 overflow-x-auto no-scrollbar" role="tablist">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={cn(
              'flex items-center gap-1.5 px-5 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex-shrink-0',
              activeTab === key
                ? 'border-primary-700 text-primary-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {isLoading ? <PageSpinner /> : (
        <>
          {/* ── Jobs Tab ──────────────────────────────────────────────────── */}
          {activeTab === 'jobs' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">{jobs.length} listing{jobs.length !== 1 ? 's' : ''} total</p>
                <button onClick={openJobCreate} className="btn-primary btn-sm flex items-center gap-1.5">
                  <Plus size={14} /> Add Job
                </button>
              </div>

              <div className="table-wrap">
                {jobs.length === 0 ? (
                  <EmptyState icon={Briefcase} title="No job listings" description="Add job opportunities for youth." className="py-12" />
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th>Title / Company</th>
                        <th>Type</th>
                        <th>Industry</th>
                        <th>Location</th>
                        <th>Deadline</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {jobs.map(j => (
                        <tr key={j.id}>
                          <td>
                            <div className="flex items-center gap-2">
                              {j.is_featured && <Star size={12} className="text-amber-500 flex-shrink-0" fill="currentColor" />}
                              <div>
                                <p className="font-medium text-sm">{j.title}</p>
                                <p className="text-xs text-gray-500">{j.company_or_org}</p>
                              </div>
                            </div>
                          </td>
                          <td className="text-xs capitalize">{j.job_type?.replace('_', ' ')}</td>
                          <td className="text-xs capitalize">{j.industry?.replace('_', ' ')}</td>
                          <td className="text-xs text-gray-500">{j.location}</td>
                          <td className="text-xs text-gray-500">{j.application_deadline ? formatDate(j.application_deadline) : '\u2014'}</td>
                          <td>
                            <span className={j.is_active ? 'badge-green' : 'badge-gray'}>
                              {j.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td>
                            <div className="flex items-center gap-1.5">
                              <button onClick={() => openJobEdit(j)} className="btn-secondary btn-sm text-xs p-1.5" title="Edit"><Edit2 size={13} /></button>
                              <button
                                onClick={() => window.confirm(`Delete "${j.title}"?`) && deleteJob.mutate(j.id)}
                                className="btn-danger btn-sm text-xs p-1.5"
                                title="Delete"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* ── Scholarships Tab ──────────────────────────────────────────── */}
          {activeTab === 'scholarships' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">{scholarships.length} scholarship program{scholarships.length !== 1 ? 's' : ''}</p>
                <button onClick={openScholarshipCreate} className="btn-primary btn-sm flex items-center gap-1.5">
                  <Plus size={14} /> Add Scholarship
                </button>
              </div>

              <div className="table-wrap">
                {scholarships.length === 0 ? (
                  <EmptyState icon={Award} title="No scholarships" description="Add scholarship listings for youth." className="py-12" />
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th>Program</th>
                        <th>Provider</th>
                        <th>Type</th>
                        <th>Amount</th>
                        <th>Deadline</th>
                        <th>Featured</th>
                        <th>Link</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scholarships.map(s => (
                        <tr key={s.id}>
                          <td>
                            <p className="font-medium text-sm leading-snug">{s.title}</p>
                            <p className="text-xs text-gray-400 mt-0.5 capitalize">{s.category.replace('_', ' ')}</p>
                          </td>
                          <td className="text-xs text-gray-600">{s.provider}</td>
                          <td>
                            <span className={cn('badge text-[10px]', TYPE_BADGE[s.provider_type] ?? 'badge-gray')}>
                              {s.provider_type.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="text-xs text-green-700 font-medium">{s.amount}</td>
                          <td className="text-xs text-gray-500">{s.deadline || 'Rolling'}</td>
                          <td className="text-center">
                            {s.is_featured
                              ? <CheckCircle2 size={14} className="text-green-500 inline" />
                              : <XCircle size={14} className="text-gray-300 inline" />}
                          </td>
                          <td>
                            {s.application_url ? (
                              <a href={s.application_url} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:text-primary-800">
                                <ExternalLink size={13} />
                              </a>
                            ) : (
                              <span className="text-gray-300">&mdash;</span>
                            )}
                          </td>
                          <td>
                            <div className="flex items-center gap-1.5">
                              <button onClick={() => openScholarshipEdit(s)} className="btn-secondary btn-sm text-xs p-1.5" title="Edit"><Edit2 size={13} /></button>
                              <button
                                onClick={() => window.confirm(`Delete "${s.title}"?`) && deleteScholarship.mutate(s.id)}
                                className="btn-danger btn-sm text-xs p-1.5"
                                title="Delete"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* ── Schools Tab ───────────────────────────────────────────────── */}
          {activeTab === 'schools' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">{schools.length} school{schools.length !== 1 ? 's' : ''} in directory</p>
                <button onClick={openSchoolCreate} className="btn-primary btn-sm flex items-center gap-1.5">
                  <Plus size={14} /> Add School
                </button>
              </div>

              <div className="table-wrap">
                {schools.length === 0 ? (
                  <EmptyState icon={SchoolIcon} title="No schools" description="Add schools to the directory." className="py-12" />
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Type</th>
                        <th>Location</th>
                        <th>Programs</th>
                        <th>Contact</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {schools.map(s => (
                        <tr key={s.id}>
                          <td>
                            <div className="flex items-center gap-2">
                              {s.is_featured && <Star size={12} className="text-amber-500 flex-shrink-0" fill="currentColor" />}
                              <p className="font-medium text-sm">{s.name}</p>
                            </div>
                          </td>
                          <td className="text-xs capitalize">{s.school_type?.replace('_', ' ')}</td>
                          <td className="text-xs text-gray-500">{[s.municipality, s.province].filter(Boolean).join(', ') || '\u2014'}</td>
                          <td className="text-center text-sm">{s.program_count}</td>
                          <td className="text-xs text-gray-500">{s.phone || s.email || '\u2014'}</td>
                          <td>
                            <span className={s.is_active ? 'badge-green' : 'badge-gray'}>
                              {s.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td>
                            <button onClick={() => openSchoolEdit(s)} className="btn-secondary btn-sm text-xs p-1.5" title="Edit">
                              <Edit2 size={13} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Job Modal ──────────────────────────────────────────────────────────── */}
      {showJobModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6" onClick={closeJobModal}>
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold">{editJob ? 'Edit Job Listing' : 'Add Job Listing'}</h2>
              <button onClick={closeJobModal} aria-label="Close" className="p-1 rounded hover:bg-gray-100">
                <X size={18} className="text-gray-400" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="label">Job Title *</label>
                <input className="input" value={jobForm.title} onChange={e => setJobForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g., Junior Software Developer" />
              </div>
              <div>
                <label className="label">Company / Organization *</label>
                <input className="input" value={jobForm.company_or_org} onChange={e => setJobForm(f => ({ ...f, company_or_org: e.target.value }))} placeholder="Organization name" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Job Type</label>
                  <select className="input" value={jobForm.job_type} onChange={e => setJobForm(f => ({ ...f, job_type: e.target.value }))}>
                    {JOB_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Industry</label>
                  <select className="input" value={jobForm.industry} onChange={e => setJobForm(f => ({ ...f, industry: e.target.value }))}>
                    {INDUSTRIES.map(i => <option key={i} value={i}>{i.replace('_', ' ')}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="label">Location</label>
                <input className="input" value={jobForm.location} onChange={e => setJobForm(f => ({ ...f, location: e.target.value }))} placeholder="e.g., Lucena City / Remote" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Salary Range</label>
                  <input className="input" value={jobForm.salary_range} onChange={e => setJobForm(f => ({ ...f, salary_range: e.target.value }))} placeholder="e.g., PHP 18,000/month" />
                </div>
                <div>
                  <label className="label">Application Deadline</label>
                  <input type="date" className="input" value={jobForm.application_deadline} onChange={e => setJobForm(f => ({ ...f, application_deadline: e.target.value }))} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Application Link</label>
                  <input type="url" className="input" value={jobForm.application_link} onChange={e => setJobForm(f => ({ ...f, application_link: e.target.value }))} placeholder="https://…" />
                </div>
                <div>
                  <label className="label">Contact Email</label>
                  <input type="email" className="input" value={jobForm.contact_email} onChange={e => setJobForm(f => ({ ...f, contact_email: e.target.value }))} placeholder="hr@company.com" />
                </div>
              </div>

              <div>
                <label className="label">Description</label>
                <textarea className="input min-h-[80px]" value={jobForm.description} onChange={e => setJobForm(f => ({ ...f, description: e.target.value }))} placeholder="Job description…" />
              </div>
              <div>
                <label className="label">Requirements</label>
                <textarea className="input min-h-[60px]" value={jobForm.requirements} onChange={e => setJobForm(f => ({ ...f, requirements: e.target.value }))} placeholder="Qualifications and requirements…" />
              </div>

              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                  <input type="checkbox" checked={jobForm.is_featured} onChange={e => setJobForm(f => ({ ...f, is_featured: e.target.checked }))} className="rounded" />
                  Mark as Featured
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                  <input type="checkbox" checked={jobForm.is_active} onChange={e => setJobForm(f => ({ ...f, is_active: e.target.checked }))} className="rounded" />
                  Active (visible to youth)
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button onClick={closeJobModal} className="btn-secondary btn-sm">Cancel</button>
              <button
                onClick={handleJobSubmit}
                disabled={createJob.isPending || updateJob.isPending}
                className="btn-primary btn-sm"
              >
                {(createJob.isPending || updateJob.isPending) ? 'Saving…' : editJob ? 'Save Changes' : 'Add Job'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Scholarship Modal ──────────────────────────────────────────────────── */}
      {showScholarshipModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6" onClick={closeScholarshipModal}>
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold">{editScholarship ? 'Edit Scholarship' : 'Add Scholarship'}</h2>
              <button onClick={closeScholarshipModal} aria-label="Close" className="p-1 rounded hover:bg-gray-100">
                <X size={18} className="text-gray-400" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="label">Title *</label>
                <input className="input" value={scholarshipForm.title} onChange={e => setScholarshipForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g., CHED UniFAST Scholarship" />
              </div>
              <div>
                <label className="label">Provider / Organization *</label>
                <input className="input" value={scholarshipForm.provider} onChange={e => setScholarshipForm(f => ({ ...f, provider: e.target.value }))} placeholder="e.g., Commission on Higher Education" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Provider Type</label>
                  <select className="input" value={scholarshipForm.provider_type} onChange={e => setScholarshipForm(f => ({ ...f, provider_type: e.target.value }))}>
                    {PROVIDER_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Category</label>
                  <select className="input" value={scholarshipForm.category} onChange={e => setScholarshipForm(f => ({ ...f, category: e.target.value }))}>
                    {SCHOLARSHIP_CATEGORIES.map(c => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Coverage</label>
                  <input className="input" value={scholarshipForm.coverage} onChange={e => setScholarshipForm(f => ({ ...f, coverage: e.target.value }))} placeholder="e.g., Full tuition + allowance" />
                </div>
                <div>
                  <label className="label">Amount</label>
                  <input className="input" value={scholarshipForm.amount} onChange={e => setScholarshipForm(f => ({ ...f, amount: e.target.value }))} placeholder="e.g., PHP 60,000/year" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Deadline</label>
                  <input className="input" value={scholarshipForm.deadline} onChange={e => setScholarshipForm(f => ({ ...f, deadline: e.target.value }))} placeholder="e.g., 2026-06-30 or Rolling" />
                </div>
                <div>
                  <label className="label">Slots</label>
                  <input className="input" value={scholarshipForm.slots} onChange={e => setScholarshipForm(f => ({ ...f, slots: e.target.value }))} placeholder="e.g., 200 slots / Nationwide" />
                </div>
              </div>

              <div>
                <label className="label">Description</label>
                <textarea className="input min-h-[70px]" value={scholarshipForm.description} onChange={e => setScholarshipForm(f => ({ ...f, description: e.target.value }))} placeholder="Brief description of the scholarship…" />
              </div>

              <div>
                <label className="label">Requirements <span className="text-gray-400 font-normal">(one per line)</span></label>
                <textarea
                  className="input min-h-[80px] font-mono text-sm"
                  value={scholarshipForm.requirements_text}
                  onChange={e => setScholarshipForm(f => ({ ...f, requirements_text: e.target.value }))}
                  placeholder={"Must be a Filipino citizen\nFamily income below PHP 400,000/year"}
                />
              </div>

              <div>
                <label className="label">Application URL</label>
                <input type="url" className="input" value={scholarshipForm.application_url} onChange={e => setScholarshipForm(f => ({ ...f, application_url: e.target.value }))} placeholder="https://…  (leave blank if no direct link)" />
              </div>

              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                  <input type="checkbox" checked={scholarshipForm.is_featured} onChange={e => setScholarshipForm(f => ({ ...f, is_featured: e.target.checked }))} className="rounded" />
                  Mark as Featured
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                  <input type="checkbox" checked={scholarshipForm.is_published} onChange={e => setScholarshipForm(f => ({ ...f, is_published: e.target.checked }))} className="rounded" />
                  Published (visible to youth)
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button onClick={closeScholarshipModal} className="btn-secondary btn-sm">Cancel</button>
              <button
                onClick={handleScholarshipSubmit}
                disabled={createScholarship.isPending || updateScholarship.isPending}
                className="btn-primary btn-sm"
              >
                {(createScholarship.isPending || updateScholarship.isPending) ? 'Saving…' : editScholarship ? 'Save Changes' : 'Add Scholarship'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── School Modal ───────────────────────────────────────────────────────── */}
      {showSchoolModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6" onClick={closeSchoolModal}>
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold">{editSchool ? 'Edit School' : 'Add School'}</h2>
              <button onClick={closeSchoolModal} aria-label="Close" className="p-1 rounded hover:bg-gray-100">
                <X size={18} className="text-gray-400" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="label">School Name *</label>
                <input className="input" value={schoolForm.name} onChange={e => setSchoolForm(f => ({ ...f, name: e.target.value }))} placeholder="Full official school name" />
              </div>
              <div>
                <label className="label">School Type</label>
                <select className="input" value={schoolForm.school_type} onChange={e => setSchoolForm(f => ({ ...f, school_type: e.target.value }))}>
                  {SCHOOL_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Municipality</label>
                  <input className="input" value={schoolForm.municipality} onChange={e => setSchoolForm(f => ({ ...f, municipality: e.target.value }))} placeholder="e.g., Lucena City" />
                </div>
                <div>
                  <label className="label">Province</label>
                  <input className="input" value={schoolForm.province} onChange={e => setSchoolForm(f => ({ ...f, province: e.target.value }))} placeholder="e.g., Quezon" />
                </div>
              </div>

              <div>
                <label className="label">Address</label>
                <input className="input" value={schoolForm.address} onChange={e => setSchoolForm(f => ({ ...f, address: e.target.value }))} placeholder="Full address" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Phone</label>
                  <input className="input" value={schoolForm.phone} onChange={e => setSchoolForm(f => ({ ...f, phone: e.target.value }))} placeholder="(042) 000-0000" />
                </div>
                <div>
                  <label className="label">Email</label>
                  <input type="email" className="input" value={schoolForm.email} onChange={e => setSchoolForm(f => ({ ...f, email: e.target.value }))} placeholder="info@school.edu.ph" />
                </div>
              </div>

              <div>
                <label className="label">Website</label>
                <input type="url" className="input" value={schoolForm.website} onChange={e => setSchoolForm(f => ({ ...f, website: e.target.value }))} placeholder="https://…" />
              </div>

              <div>
                <label className="label">Description</label>
                <textarea className="input min-h-[60px]" value={schoolForm.description} onChange={e => setSchoolForm(f => ({ ...f, description: e.target.value }))} placeholder="Brief school description…" />
              </div>

              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                  <input type="checkbox" checked={schoolForm.is_featured} onChange={e => setSchoolForm(f => ({ ...f, is_featured: e.target.checked }))} className="rounded" />
                  Featured School
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                  <input type="checkbox" checked={schoolForm.is_active} onChange={e => setSchoolForm(f => ({ ...f, is_active: e.target.checked }))} className="rounded" />
                  Active (visible to youth)
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button onClick={closeSchoolModal} className="btn-secondary btn-sm">Cancel</button>
              <button
                onClick={handleSchoolSubmit}
                disabled={createSchool.isPending || updateSchool.isPending}
                className="btn-primary btn-sm"
              >
                {(createSchool.isPending || updateSchool.isPending) ? 'Saving…' : editSchool ? 'Save Changes' : 'Add School'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
