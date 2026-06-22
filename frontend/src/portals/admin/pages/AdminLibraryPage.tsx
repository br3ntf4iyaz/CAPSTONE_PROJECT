import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Library, Plus, Eye, EyeOff, Trash2, X, Upload, Download } from 'lucide-react'
import toast from 'react-hot-toast'
import apiClient from '@/api/client'
import { PageSpinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatDate, cn, toArray } from '@/utils'

interface Resource {
  id: number
  title: string
  description: string
  category: string
  resource_type: string
  law_number: string
  year_enacted: number | null
  tags: string
  is_published: boolean
  is_featured: boolean
  download_count: number
  created_at: string
  file_url?: string
  external_url?: string
}

const CATEGORIES = [
  { value: 'legal',      label: 'Laws & Acts' },
  { value: 'governance', label: 'Governance' },
  { value: 'education',  label: 'Education' },
  { value: 'health',     label: 'Health' },
  { value: 'financial',  label: 'Financial' },
  { value: 'leadership', label: 'Leadership' },
  { value: 'other',      label: 'Other' },
]
const RESOURCE_TYPES = [
  { value: 'document', label: 'Document (PDF)' },
  { value: 'link',     label: 'External Link' },
  { value: 'video',    label: 'Video' },
  { value: 'form',     label: 'Form / Template' },
]

const initialForm = {
  title: '', description: '', category: 'legal', resource_type: 'link',
  law_number: '', year_enacted: '', tags: '',
  external_url: '', is_published: false, is_featured: false,
}

export default function AdminLibraryPage() {
  const qc = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ ...initialForm })
  const [fileInput, setFileInput] = useState<File | null>(null)
  const [filterCategory, setFilterCategory] = useState('')
  const [filterType, setFilterType] = useState('')

  const { data: resources = [], isLoading } = useQuery<Resource[]>({
    queryKey: ['admin-resources'],
    queryFn: () => apiClient.get('/resources/').then(r => toArray<Resource>(r.data)),
  })

  const createResource = useMutation({
    mutationFn: async (data: typeof form & { file?: File }) => {
      const fd = new FormData()
      Object.entries(data).forEach(([k, v]) => {
        if (k === 'file' && v instanceof File) fd.append('file', v)
        else if (typeof v === 'boolean') fd.append(k, String(v))
        else if (v !== undefined && v !== null) fd.append(k, String(v))
      })
      return apiClient.post('/resources/', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-resources'] })
      toast.success('Resource added')
      closeModal()
    },
    onError: () => toast.error('Failed to add resource'),
  })

  const togglePublished = useMutation({
    mutationFn: ({ id, is_published }: { id: number; is_published: boolean }) =>
      apiClient.patch(`/resources/${id}/`, { is_published }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-resources'] })
      toast.success('Published status updated')
    },
    onError: () => toast.error('Failed to update'),
  })

  const deleteResource = useMutation({
    mutationFn: (id: number) => apiClient.delete(`/resources/${id}/`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-resources'] })
      toast.success('Resource deleted')
    },
    onError: () => toast.error('Failed to delete'),
  })

  const closeModal = () => { setShowModal(false); setForm({ ...initialForm }); setFileInput(null) }

  const handleSubmit = () => {
    if (!form.title) { toast.error('Title is required'); return }
    createResource.mutate({ ...form, file: fileInput ?? undefined })
  }

  const confirmDelete = (r: Resource) => {
    if (window.confirm(`Delete "${r.title}"?`)) deleteResource.mutate(r.id)
  }

  const filtered = resources.filter(r => {
    if (filterCategory && r.category !== filterCategory) return false
    if (filterType && r.resource_type !== filterType) return false
    return true
  })

  if (isLoading) return <PageSpinner />

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Library Management</h1>
          <p className="page-subtitle">{filtered.length} of {resources.length} resources</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary btn-sm">
          <Plus size={15} /> Add Resource
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="input max-w-[160px]">
          <option value="">All Categories</option>
          {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="input max-w-[160px]">
          <option value="">All Types</option>
          {RESOURCE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        {(filterCategory || filterType) && (
          <button onClick={() => { setFilterCategory(''); setFilterType('') }} className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1">
            <X size={13} /> Clear
          </button>
        )}
      </div>

      <div className="table-wrap">
        {filtered.length === 0 ? (
          <EmptyState icon={Library} title="No resources found" description="Add resources like laws, plans, and ordinances." className="py-12" />
        ) : (
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Category</th>
                <th>Type</th>
                <th>Published</th>
                <th>Downloads</th>
                <th>Uploaded</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id}>
                  <td>
                    <div>
                      {r.law_number && <p className="text-[10px] font-bold text-primary-700 mb-0.5">{r.law_number}{r.year_enacted ? ` · ${r.year_enacted}` : ''}</p>}
                      <p className="font-medium">{r.title}</p>
                      {r.description && <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[220px]">{r.description}</p>}
                    </div>
                  </td>
                  <td className="capitalize">{CATEGORIES.find(c => c.value === r.category)?.label ?? r.category}</td>
                  <td>
                    <span className="badge-blue uppercase text-xs">{r.resource_type}</span>
                  </td>
                  <td>
                    <button
                      onClick={() => togglePublished.mutate({ id: r.id, is_published: !r.is_published })}
                      className={cn('p-1.5 rounded-lg transition-colors', r.is_published ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-400 hover:bg-gray-200')}
                    >
                      {r.is_published ? <Eye size={14} /> : <EyeOff size={14} />}
                    </button>
                  </td>
                  <td className="text-center">{r.download_count ?? 0}</td>
                  <td className="text-xs text-gray-500">{formatDate(r.created_at)}</td>
                  <td>
                    <div className="flex items-center gap-1.5">
                      {(r.file_url || r.external_url) && (
                        <a
                          href={r.file_url ?? r.external_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-secondary btn-sm text-xs p-1.5"
                          title="Download/View"
                        >
                          <Download size={13} />
                        </a>
                      )}
                      <button onClick={() => confirmDelete(r)} className="btn-danger btn-sm text-xs p-1.5">
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

      {/* Add Resource Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6" onClick={closeModal}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold">Add Resource</h2>
              <button onClick={closeModal} aria-label="Close dialog" className="p-1 rounded hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"><X size={18} className="text-gray-400" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="label">Title *</label>
                <input className="input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Sangguniang Kabataan Reform Act of 2015" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Law / Reference Number</label>
                  <input className="input" value={form.law_number} onChange={e => setForm(f => ({ ...f, law_number: e.target.value }))} placeholder="e.g. RA 10742" />
                </div>
                <div>
                  <label className="label">Year Enacted</label>
                  <input className="input" type="number" min="1900" max="2099" value={form.year_enacted} onChange={e => setForm(f => ({ ...f, year_enacted: e.target.value }))} placeholder="e.g. 2016" />
                </div>
              </div>
              <div>
                <label className="label">Description</label>
                <textarea className="input min-h-[70px]" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Brief summary of what this law or resource covers…" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Category</label>
                  <select className="input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Resource Type</label>
                  <select className="input" value={form.resource_type} onChange={e => setForm(f => ({ ...f, resource_type: e.target.value }))}>
                    {RESOURCE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Tags <span className="text-ink-400 font-normal">(comma-separated)</span></label>
                <input className="input" value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} placeholder="e.g. SK, youth, governance, DILG" />
              </div>
              <div>
                <label className="label">External URL <span className="text-ink-400 font-normal">(Official Gazette or source)</span></label>
                <input
                  className="input"
                  type="url"
                  value={form.external_url}
                  onChange={e => setForm(f => ({ ...f, external_url: e.target.value }))}
                  placeholder="https://www.officialgazette.gov.ph/…"
                />
              </div>
              <div>
                <label className="label">Or Upload File <span className="text-ink-400 font-normal">(PDF, max 10 MB)</span></label>
                <div className="border-2 border-dashed border-gray-200 rounded-lg p-4 text-center hover:border-primary-400 transition-colors">
                  <Upload size={20} className="mx-auto text-gray-400 mb-2" />
                  <input
                    type="file"
                    onChange={e => setFileInput(e.target.files?.[0] ?? null)}
                    className="text-sm text-gray-600 w-full"
                    accept=".pdf,.doc,.docx,.xlsx,.pptx"
                  />
                  {fileInput && <p className="text-xs text-green-600 mt-1">{fileInput.name}</p>}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.is_published}
                    onChange={e => setForm(f => ({ ...f, is_published: e.target.checked }))}
                    className="w-4 h-4 accent-primary-700"
                  />
                  <span className="text-sm text-gray-700">Publish immediately</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.is_featured}
                    onChange={e => setForm(f => ({ ...f, is_featured: e.target.checked }))}
                    className="w-4 h-4 accent-primary-700"
                  />
                  <span className="text-sm text-gray-700">Mark as featured</span>
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={closeModal} className="btn-secondary btn-sm">Cancel</button>
              <button onClick={handleSubmit} disabled={createResource.isPending} className="btn-primary btn-sm">
                {createResource.isPending ? 'Uploading…' : 'Add Resource'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
