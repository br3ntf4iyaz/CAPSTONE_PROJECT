import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, X, FolderOpen } from 'lucide-react'
import toast from 'react-hot-toast'
import apiClient from '@/api/client'
import { PageSpinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatDate, cn, toArray } from '@/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

interface YouthProgram {
  id: number
  title: string
  category: string
  category_display: string
  status: string
  status_display: string
  submitter_type: string
  barangay: string
  description: string
  objectives: string
  target_beneficiaries: string
  male_participants: number
  female_participants: number
  start_date: string | null
  end_date: string | null
  location: string
  is_featured: boolean
  contact_person: string
  contact_email: string
  contact_phone: string
  created_at: string
}

interface ProgramFormData {
  title: string
  category: string
  status: string
  submitter_type: string
  barangay: string
  description: string
  objectives: string
  target_beneficiaries: string
  male_participants: number
  female_participants: number
  start_date: string
  end_date: string
  location: string
  is_featured: boolean
  contact_person: string
  contact_email: string
  contact_phone: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORY_OPTIONS = [
  { value: 'social_inclusion', label: 'Social Inclusion and Equity' },
  { value: 'health', label: 'Health' },
  { value: 'active_citizenship', label: 'Active Citizenship' },
  { value: 'peace_building', label: 'Peace Building and Security' },
  { value: 'education', label: 'Education' },
  { value: 'environment', label: 'Environment' },
  { value: 'governance', label: 'Governance' },
  { value: 'agriculture', label: 'Agriculture' },
  { value: 'global_mobility', label: 'Global Mobility' },
  { value: 'economic', label: 'Economic Environment' },
]

const STATUS_OPTIONS = [
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'ongoing', label: 'Ongoing' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]

const SUBMITTER_TYPE_OPTIONS = [
  { value: 'sk', label: 'SK (Sangguniang Kabataan)' },
  { value: 'youth_org', label: 'Youth Organization' },
]

const EMPTY_FORM: ProgramFormData = {
  title: '',
  category: 'education',
  status: 'upcoming',
  submitter_type: 'sk',
  barangay: '',
  description: '',
  objectives: '',
  target_beneficiaries: '',
  male_participants: 0,
  female_participants: 0,
  start_date: '',
  end_date: '',
  location: '',
  is_featured: false,
  contact_person: '',
  contact_email: '',
  contact_phone: '',
}

const PROGRAMS_URL = '/programs/'

// ── Program form modal ────────────────────────────────────────────────────────

interface ProgramModalProps {
  editProgram: YouthProgram | null
  onClose: () => void
  onSaved: () => void
}

function ProgramModal({ editProgram, onClose, onSaved }: ProgramModalProps) {
  const [form, setForm] = useState<ProgramFormData>(
    editProgram
      ? {
          title: editProgram.title,
          category: editProgram.category,
          status: editProgram.status,
          submitter_type: editProgram.submitter_type,
          barangay: editProgram.barangay,
          description: editProgram.description,
          objectives: editProgram.objectives,
          target_beneficiaries: editProgram.target_beneficiaries,
          male_participants: editProgram.male_participants,
          female_participants: editProgram.female_participants,
          start_date: editProgram.start_date ?? '',
          end_date: editProgram.end_date ?? '',
          location: editProgram.location,
          is_featured: editProgram.is_featured,
          contact_person: editProgram.contact_person,
          contact_email: editProgram.contact_email,
          contact_phone: editProgram.contact_phone,
        }
      : EMPTY_FORM
  )

  const setF = <K extends keyof ProgramFormData>(k: K, v: ProgramFormData[K]) =>
    setForm(p => ({ ...p, [k]: v }))

  const createM = useMutation({
    mutationFn: (data: ProgramFormData) => apiClient.post(PROGRAMS_URL, data),
    onSuccess: () => { toast.success('Program created'); onSaved(); onClose() },
    onError: (err: any) => toast.error(err?.response?.data?.detail ?? 'Failed to create program'),
  })

  const updateM = useMutation({
    mutationFn: (data: ProgramFormData) =>
      apiClient.patch(`${PROGRAMS_URL}${editProgram!.id}/`, data),
    onSuccess: () => { toast.success('Program updated'); onSaved(); onClose() },
    onError: (err: any) => toast.error(err?.response?.data?.detail ?? 'Failed to update program'),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const payload = {
      ...form,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
    }
    editProgram ? updateM.mutate(payload as ProgramFormData) : createM.mutate(payload as ProgramFormData)
  }

  const saving = createM.isPending || updateM.isPending

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6 overflow-y-auto">
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-2xl my-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">
            {editProgram ? 'Edit Program' : 'New Program'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">

          {/* Basic info */}
          <div>
            <label className="label">Title *</label>
            <input
              className="input w-full"
              value={form.title}
              onChange={e => setF('title', e.target.value)}
              required
              placeholder="Program title"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Category *</label>
              <select className="input w-full" value={form.category} onChange={e => setF('category', e.target.value)} required>
                {CATEGORY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Status *</label>
              <select className="input w-full" value={form.status} onChange={e => setF('status', e.target.value)} required>
                {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Submitter Type *</label>
              <select className="input w-full" value={form.submitter_type} onChange={e => setF('submitter_type', e.target.value)} required>
                {SUBMITTER_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Barangay</label>
              <input
                className="input w-full"
                value={form.barangay}
                onChange={e => setF('barangay', e.target.value)}
                placeholder="e.g. Barangay Ibabang Dupay"
              />
            </div>
          </div>

          <div>
            <label className="label">Description *</label>
            <textarea
              className="input w-full min-h-[80px] resize-y"
              value={form.description}
              onChange={e => setF('description', e.target.value)}
              required
              placeholder="Program description"
            />
          </div>

          <div>
            <label className="label">Objectives</label>
            <textarea
              className="input w-full min-h-[60px] resize-y"
              value={form.objectives}
              onChange={e => setF('objectives', e.target.value)}
              placeholder="Program objectives"
            />
          </div>

          <div>
            <label className="label">Target Beneficiaries</label>
            <textarea
              className="input w-full min-h-[60px] resize-y"
              value={form.target_beneficiaries}
              onChange={e => setF('target_beneficiaries', e.target.value)}
              placeholder="Who this program benefits"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Male Participants</label>
              <input
                type="number"
                min={0}
                className="input w-full"
                value={form.male_participants}
                onChange={e => setF('male_participants', Number(e.target.value))}
              />
            </div>
            <div>
              <label className="label">Female Participants</label>
              <input
                type="number"
                min={0}
                className="input w-full"
                value={form.female_participants}
                onChange={e => setF('female_participants', Number(e.target.value))}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Start Date</label>
              <input
                type="date"
                className="input w-full"
                value={form.start_date}
                onChange={e => setF('start_date', e.target.value)}
              />
            </div>
            <div>
              <label className="label">End Date</label>
              <input
                type="date"
                className="input w-full"
                value={form.end_date}
                onChange={e => setF('end_date', e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="label">Location / Venue</label>
            <input
              className="input w-full"
              value={form.location}
              onChange={e => setF('location', e.target.value)}
              placeholder="e.g. Barangay Hall, Lucena City"
            />
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              className="w-4 h-4 accent-primary-700"
              checked={form.is_featured}
              onChange={e => setF('is_featured', e.target.checked)}
            />
            <span className="text-sm font-medium text-gray-700">Featured (shown prominently on programs page)</span>
          </label>

          {/* Contact Information */}
          <div className="pt-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Contact Information</p>
            <div className="space-y-4">
              <div>
                <label className="label">Contact Person</label>
                <input
                  className="input w-full"
                  value={form.contact_person}
                  onChange={e => setF('contact_person', e.target.value)}
                  placeholder="Full name of the contact person"
                />
              </div>
              <div>
                <label className="label">Contact Email</label>
                <input
                  type="email"
                  className="input w-full"
                  value={form.contact_email}
                  onChange={e => setF('contact_email', e.target.value)}
                  placeholder="contact@example.com"
                />
              </div>
              <div>
                <label className="label">Contact Phone</label>
                <input
                  type="tel"
                  className="input w-full"
                  value={form.contact_phone}
                  onChange={e => setF('contact_phone', e.target.value)}
                  placeholder="+63 912 345 6789"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving…' : editProgram ? 'Save Changes' : 'Create Program'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AdminProgramsPage() {
  const qc = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [editProgram, setEditProgram] = useState<YouthProgram | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)

  const { data, isLoading } = useQuery<YouthProgram[]>({
    queryKey: ['admin-programs-list'],
    queryFn: () => apiClient.get(PROGRAMS_URL).then(r => toArray<YouthProgram>(r.data)),
  })
  const programs = data ?? []

  const deleteM = useMutation({
    mutationFn: (id: number) => apiClient.delete(`${PROGRAMS_URL}${id}/`),
    onSuccess: () => {
      toast.success('Program deleted')
      qc.invalidateQueries({ queryKey: ['admin-programs-list'] })
      setDeleteId(null)
    },
    onError: () => toast.error('Failed to delete program'),
  })

  function openCreate() { setEditProgram(null); setModalOpen(true) }
  function openEdit(p: YouthProgram) { setEditProgram(p); setModalOpen(true) }
  function handleSaved() { qc.invalidateQueries({ queryKey: ['admin-programs-list'] }) }

  if (isLoading) return <PageSpinner />

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Programs</h1>
          <p className="page-subtitle">Create and manage youth programs published on the portal</p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <Plus size={15} /> New Program
        </button>
      </div>

      <div className="table-wrap">
        {programs.length === 0 ? (
          <EmptyState
            icon={FolderOpen}
            title="No programs yet"
            description="Click 'New Program' to add the first one."
            className="py-12"
          />
        ) : (
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Category</th>
                <th>Status</th>
                <th>Type</th>
                <th>Barangay</th>
                <th>Contact</th>
                <th>Start Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {programs.map(prog => (
                <tr key={prog.id}>
                  <td className="font-medium max-w-[200px] truncate">
                    {prog.is_featured && (
                      <span className="inline-block mr-1.5 text-yellow-500 text-[10px] font-bold uppercase">★</span>
                    )}
                    {prog.title}
                  </td>
                  <td className="text-sm">{prog.category_display}</td>
                  <td>
                    <span className={cn(
                      'badge text-xs',
                      prog.status === 'ongoing' ? 'badge-green' :
                      prog.status === 'upcoming' ? 'badge-blue' :
                      prog.status === 'completed' ? 'badge-gray' : 'badge-red'
                    )}>
                      {prog.status_display}
                    </span>
                  </td>
                  <td className="text-sm text-ink-500">
                    {prog.submitter_type === 'sk' ? 'SK' : 'Youth Org'}
                  </td>
                  <td className="text-sm text-ink-500">{prog.barangay || '—'}</td>
                  <td className="text-sm text-ink-500">{prog.contact_person || '—'}</td>
                  <td className="text-sm text-ink-500">
                    {prog.start_date ? formatDate(prog.start_date) : '—'}
                  </td>
                  <td>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => openEdit(prog)}
                        className="p-1.5 text-gray-400 hover:text-primary-700 transition-colors"
                        aria-label="Edit"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => setDeleteId(prog.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
                        aria-label="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create/Edit modal */}
      {modalOpen && (
        <ProgramModal
          editProgram={editProgram}
          onClose={() => setModalOpen(false)}
          onSaved={handleSaved}
        />
      )}

      {/* Delete confirm */}
      {deleteId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-2">Delete Program</h2>
            <p className="text-sm text-gray-500 mb-6">This will permanently delete the program. This cannot be undone.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteId(null)} className="btn-secondary">Cancel</button>
              <button
                onClick={() => deleteM.mutate(deleteId)}
                disabled={deleteM.isPending}
                className="btn-danger"
              >
                {deleteM.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
